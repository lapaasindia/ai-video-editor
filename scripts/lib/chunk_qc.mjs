#!/usr/bin/env node

/**
 * Chunk QC Scorer — Phase 9 (Agentic QC Loop)
 *
 * Scores each chunk's edit plan quality:
 *   - Timing alignment: overlay duration vs speech duration
 *   - Readability: text overlay word count vs display duration
 *   - Visual clutter: number of simultaneous overlays
 *   - Context relevance: does the visual match the speech topic?
 *   - Pacing: duration distribution relative to neighbors
 *
 * Each chunk gets a score 0-100. Below threshold triggers re-plan.
 *
 * Reads: semantic_chunks.json, high-retention-plan.json
 * Writes: chunk_qc_report.json
 *
 * Usage:
 *   node scripts/lib/chunk_qc.mjs \
 *     --project-id <id> [--project-dir <dir>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execFile = promisify(execFileCb);

// ── Config ───────────────────────────────────────────────────────────────────

const QC_CONFIG = {
  passThreshold: 70,       // Chunks scoring >= 70 pass
  maxIterations: 3,        // Max re-plan attempts per chunk
  weights: {
    timing: 0.20,
    readability: 0.18,
    clutter: 0.12,
    relevance: 0.20,
    pacing: 0.12,
    toneMatch: 0.18,
  },
  // Readability: max words per second of overlay display
  maxReadableWps: 3.5,
  // Clutter: max simultaneous overlay elements
  maxOverlayElements: 2,
  // Timing: acceptable overlay-to-speech duration ratio
  minOverlayRatio: 0.3,
  maxOverlayRatio: 0.9,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// ── Scoring Functions ────────────────────────────────────────────────────────

/**
 * Timing alignment score: does the overlay fit well within the chunk duration?
 */
function scoreTiming(chunk, decision) {
  if (!decision || decision.cut) return 100; // Cut chunks don't need timing

  const chunkDurationSec = (chunk.endUs - chunk.startUs) / 1_000_000;
  let overlayDurationSec = 0;

  // Template duration (typically 3s)
  if (decision.template) overlayDurationSec += 3;
  // Image/video B-roll (typically chunk duration)
  if (decision.imageQuery || decision.videoQuery) overlayDurationSec += chunkDurationSec * 0.5;

  if (chunkDurationSec <= 0) return 50;

  const ratio = overlayDurationSec / chunkDurationSec;

  if (ratio >= QC_CONFIG.minOverlayRatio && ratio <= QC_CONFIG.maxOverlayRatio) {
    return 100;
  } else if (ratio < QC_CONFIG.minOverlayRatio) {
    // Under-filled — visual gaps
    return Math.max(30, Math.round(100 * (ratio / QC_CONFIG.minOverlayRatio)));
  } else {
    // Over-filled — too cramped
    return Math.max(30, Math.round(100 * (QC_CONFIG.maxOverlayRatio / ratio)));
  }
}

/**
 * Readability score: can the viewer read the text overlay in time?
 */
function scoreReadability(chunk, decision) {
  if (!decision || decision.cut) return 100;

  const overlayText = decision.overlayText || '';
  if (!overlayText) return 90; // No text to read — slightly lower because we could show something

  const wordCount = countWords(overlayText);
  const displayDurationSec = Math.min(3, (chunk.endUs - chunk.startUs) / 1_000_000);

  if (displayDurationSec <= 0) return 50;

  const wps = wordCount / displayDurationSec;

  if (wps <= QC_CONFIG.maxReadableWps) {
    return 100;
  } else {
    // Penalize proportionally
    return Math.max(20, Math.round(100 * (QC_CONFIG.maxReadableWps / wps)));
  }
}

/**
 * Visual clutter score: how many overlay elements are active simultaneously?
 */
function scoreClutter(decision) {
  if (!decision || decision.cut) return 100;

  let elements = 0;
  if (decision.template) elements++;
  if (decision.imageQuery) elements++;
  if (decision.videoQuery) elements++;
  if (decision.overlayText) elements++;

  if (elements <= QC_CONFIG.maxOverlayElements) {
    return 100;
  } else {
    // Penalize for each extra element
    return Math.max(30, 100 - (elements - QC_CONFIG.maxOverlayElements) * 25);
  }
}

/**
 * Context relevance score: does the visual relate to the speech?
 * Uses keyword overlap between chunk text and asset queries/overlay text.
 */
function scoreRelevance(chunk, decision) {
  if (!decision || decision.cut) return 100;

  const chunkWords = new Set(
    (chunk.text || '').toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );

  if (chunkWords.size === 0) return 50;

  // Collect all visual-related text
  const visualWords = [
    decision.imageQuery || '',
    decision.videoQuery || '',
    decision.overlayText || '',
    decision.template?.headline || '',
    decision.template?.subline || '',
  ].join(' ').toLowerCase().split(/\s+/).filter(w => w.length > 3);

  if (visualWords.length === 0) return 60; // No visual content to compare

  // Measure overlap
  const matches = visualWords.filter(w => chunkWords.has(w)).length;
  const overlapRatio = matches / Math.max(1, visualWords.length);

  // Even low overlap is somewhat acceptable (visual metaphors, etc.)
  return Math.min(100, Math.round(40 + overlapRatio * 60));
}

// ── Tone-to-intent mapping for template style matching ──────────────────────

const INTENT_TEMPLATE_AFFINITY = {
  data:        ['stat', 'number', 'chart', 'graph', 'metric', 'counter', 'data', 'info', 'compare'],
  explanation: ['explain', 'step', 'how', 'process', 'guide', 'tutorial', 'breakdown', 'detail'],
  story:       ['story', 'narrative', 'journey', 'timeline', 'quote', 'testimonial', 'personal'],
  example:     ['example', 'case', 'demo', 'showcase', 'highlight', 'feature', 'before', 'after'],
  opinion:     ['opinion', 'take', 'hot', 'debate', 'vs', 'rank', 'review', 'react', 'commentary'],
};

/**
 * Tone match score: does the visual style match the chunk's classified intent?
 * Checks template ID, overlay text style, and asset queries against intent keywords.
 */
function scoreToneMatch(chunk, decision) {
  if (!decision || decision.cut) return 100;

  const intent = (chunk.intent || 'general').toLowerCase();
  if (intent === 'general') return 75; // No intent classified — neutral score

  const affinityWords = INTENT_TEMPLATE_AFFINITY[intent] || [];
  if (affinityWords.length === 0) return 75;

  // Collect all visual/style-related text from the decision
  const visualText = [
    decision.template || '',
    typeof decision.template === 'object' ? (decision.template.id || '') : '',
    decision.overlayText || '',
    decision.imageQuery || '',
    decision.videoQuery || '',
  ].join(' ').toLowerCase();

  if (!visualText.trim()) return 60; // No visual content at all

  // Count how many affinity keywords appear in visual text
  const matches = affinityWords.filter(kw => visualText.includes(kw)).length;
  const matchRatio = matches / affinityWords.length;

  // Also check for tone clashes — e.g., "data" chunk with "story" template
  let clashPenalty = 0;
  for (const [otherIntent, otherWords] of Object.entries(INTENT_TEMPLATE_AFFINITY)) {
    if (otherIntent === intent) continue;
    const clashMatches = otherWords.filter(kw => visualText.includes(kw)).length;
    if (clashMatches >= 2 && matches === 0) {
      clashPenalty = 20; // Strong mismatch
      break;
    }
  }

  return Math.max(20, Math.min(100, Math.round(50 + matchRatio * 50 - clashPenalty)));
}

/**
 * Pacing score: is this chunk's duration balanced with neighbors?
 */
function scorePacing(chunk, allChunks) {
  if (allChunks.length <= 1) return 100;

  const avgDuration = allChunks.reduce((s, c) => s + (c.endUs - c.startUs), 0) / allChunks.length;
  const chunkDuration = chunk.endUs - chunk.startUs;

  if (avgDuration <= 0) return 50;

  const ratio = chunkDuration / avgDuration;

  // Acceptable range: 0.5x to 2x average
  if (ratio >= 0.5 && ratio <= 2.0) {
    return 100;
  } else if (ratio < 0.5) {
    return Math.max(40, Math.round(ratio * 200));
  } else {
    return Math.max(40, Math.round(100 * (2.0 / ratio)));
  }
}

/**
 * Compute overall QC score for a chunk.
 */
function scoreChunk(chunk, decision, allChunks) {
  const scores = {
    timing: scoreTiming(chunk, decision),
    readability: scoreReadability(chunk, decision),
    clutter: scoreClutter(decision),
    relevance: scoreRelevance(chunk, decision),
    pacing: scorePacing(chunk, allChunks),
    toneMatch: scoreToneMatch(chunk, decision),
  };

  const weighted = Object.entries(scores).reduce((total, [key, score]) => {
    return total + score * (QC_CONFIG.weights[key] || 0);
  }, 0);

  const overall = Math.round(weighted);
  const passed = overall >= QC_CONFIG.passThreshold;

  // Identify the weakest dimension for improvement hints
  const weakest = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
  const improvementHint = !passed && weakest
    ? `Improve ${weakest[0]} (${weakest[1]}/100)`
    : null;

  return {
    chunkIndex: chunk.index,
    startUs: chunk.startUs,
    endUs: chunk.endUs,
    scores,
    overall,
    passed,
    improvementHint,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = readArg('--project-id');
  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const chunksPath = path.join(projectDir, 'semantic_chunks.json');
  const hrPlanPath = path.join(projectDir, 'high-retention-plan.json');
  const outputPath = path.join(projectDir, 'chunk_qc_report.json');

  // Load chunks — prefer semantic chunks, fall back to HR plan decisions
  let chunks = [];
  if (await exists(chunksPath)) {
    const sc = await readJson(chunksPath);
    chunks = sc.chunks || [];
  }

  // Load HR decisions
  let decisions = [];
  if (await exists(hrPlanPath)) {
    const hr = await readJson(hrPlanPath);
    decisions = hr.decisions || [];
  }

  if (chunks.length === 0 && decisions.length === 0) {
    const result = { ok: true, projectId, totalChunks: 0, scores: [] };
    await writeJson(outputPath, result);
    await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
    return;
  }

  // If we have decisions but no semantic chunks, use decisions as chunks
  if (chunks.length === 0) {
    chunks = decisions.map((d, i) => ({
      index: i,
      startUs: d.startUs,
      endUs: d.endUs,
      text: d.text || '',
    }));
  }

  console.error(`[ChunkQC] Scoring ${chunks.length} chunks...`);

  // Attempt low-res preview rendering for each chunk (non-blocking)
  const previewDir = path.join(projectDir, 'chunk_previews');
  let previewsRendered = 0;
  try {
    // Discover source video path
    const transcriptPath = path.join(projectDir, 'transcript.json');
    let sourcePath = '';
    if (await exists(transcriptPath)) {
      const t = await readJson(transcriptPath);
      sourcePath = t.inputPath || t.transcript?.inputPath || '';
    }
    if (sourcePath && (await exists(sourcePath))) {
      await fs.mkdir(previewDir, { recursive: true });
      const renderScript = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'render_pipeline.mjs');
      for (const chunk of chunks) {
        const previewPath = path.join(previewDir, `preview-chunk-${chunk.index}.mp4`);
        try {
          await execFile('node', [
            renderScript, '--preview-chunk',
            '--source', sourcePath,
            '--start-us', String(chunk.startUs),
            '--end-us', String(chunk.endUs),
            '--output', previewPath,
          ], { timeout: 30_000, maxBuffer: 1024 * 1024 });
          previewsRendered++;
        } catch (e) {
          console.error(`[ChunkQC] Preview render for chunk ${chunk.index} failed: ${e.message}`);
        }
      }
      console.error(`[ChunkQC] Rendered ${previewsRendered}/${chunks.length} chunk previews`);
    } else {
      console.error('[ChunkQC] Source video not found — skipping preview renders');
    }
  } catch (e) {
    console.error(`[ChunkQC] Preview rendering failed (non-blocking): ${e.message}`);
  }

  // Match decisions to chunks by index or time overlap
  const scores = chunks.map((chunk) => {
    const decision = decisions.find(d =>
      d.chunkIndex === chunk.index ||
      (d.startUs <= chunk.endUs && d.endUs >= chunk.startUs)
    ) || null;

    return scoreChunk(chunk, decision, chunks);
  });

  const passed = scores.filter(s => s.passed).length;
  const failed = scores.filter(s => !s.passed).length;
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, c) => s + c.overall, 0) / scores.length)
    : 0;

  const result = {
    ok: true,
    projectId,
    scoredAt: new Date().toISOString(),
    config: QC_CONFIG,
    totalChunks: scores.length,
    summary: {
      passed,
      failed,
      avgScore,
      passRate: scores.length > 0 ? Math.round((passed / scores.length) * 100) : 0,
      previewsRendered,
    },
    scores,
  };

  await writeJson(outputPath, result);

  console.error(`[ChunkQC] Done: ${passed} passed, ${failed} failed, avg score ${avgScore}/100`);
  for (const s of scores.filter(s => !s.passed)) {
    console.error(`  ⚠ Chunk ${s.chunkIndex}: ${s.overall}/100 — ${s.improvementHint}`);
  }

  await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
