#!/usr/bin/env node

/**
 * Global Video Intelligence Pass — Phase 11
 *
 * Analyses the full assembled draft for strategic improvements:
 *   - Hook strength: score first 15s for engagement
 *   - Energy drop / retention risk: find low-energy zones with no visual change
 *   - Overload zones: too many overlays in a short window
 *   - CTA placement: suggest optimal call-to-action timing
 *   - Shorts/clips candidates: find self-contained 30-60s segments
 *
 * Reads: semantic_chunks.json, high-retention-plan.json, transcript.json
 * Writes: global_analysis.json
 *
 * Usage:
 *   node scripts/global_video_analysis.mjs \
 *     --project-id <id> [--project-dir <dir>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// ── Config ───────────────────────────────────────────────────────────────────

const CONFIG = {
  hookWindowSec: 15,
  hookMinOverlays: 1,
  hookMinWordDensity: 2.0,  // words/sec

  retentionRiskWindowSec: 10, // Flag if > 10s with no visual change
  overloadWindowSec: 10,
  overloadMaxOverlays: 4,

  shortsMinSec: 30,
  shortsMaxSec: 60,
  shortsMinChunks: 3,

  ctaPlacementPercent: [0.33, 0.66, 0.9], // Suggest CTA at these video positions
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

// ── Analysis Functions ───────────────────────────────────────────────────────

/**
 * Score the hook (first 15 seconds) for engagement.
 */
function analyseHook(chunks, decisions) {
  const hookEndUs = CONFIG.hookWindowSec * 1_000_000;
  const hookChunks = chunks.filter(c => c.startUs < hookEndUs);
  const hookDecisions = decisions.filter(d => d.startUs < hookEndUs && !d.cut);

  if (hookChunks.length === 0) {
    return { score: 0, message: 'No content in first 15 seconds', suggestions: ['Add an engaging opening'] };
  }

  let score = 50; // Base score
  const suggestions = [];

  // Check overlay density in hook
  const overlayCount = hookDecisions.filter(d => d.template || d.imageQuery || d.videoQuery).length;
  if (overlayCount >= CONFIG.hookMinOverlays) {
    score += 20;
  } else {
    suggestions.push('Add a visual overlay (template/image) in the first 15 seconds to grab attention');
  }

  // Check word density — engaging hooks are information-dense
  const hookText = hookChunks.map(c => c.text || '').join(' ');
  const hookWords = countWords(hookText);
  const hookDurationSec = Math.min(CONFIG.hookWindowSec, (hookChunks[hookChunks.length - 1]?.endUs || 0) / 1_000_000);
  const wps = hookDurationSec > 0 ? hookWords / hookDurationSec : 0;

  if (wps >= CONFIG.hookMinWordDensity) {
    score += 15;
  } else {
    suggestions.push('Hook speech is slow — consider tightening the opening or adding a teaser');
  }

  // Check if hook has a template (visual impact)
  if (hookDecisions.some(d => d.template)) {
    score += 15;
  } else {
    suggestions.push('Consider adding a title card or key stat in the first few seconds');
  }

  return {
    score: Math.min(100, score),
    hookDurationSec,
    hookChunkCount: hookChunks.length,
    overlayCount,
    wordsPerSecond: Math.round(wps * 10) / 10,
    suggestions,
  };
}

/**
 * Find retention risk zones — long stretches with no visual change.
 */
function findRetentionRisks(chunks, decisions) {
  const risks = [];
  const kept = decisions.filter(d => !d.cut);

  if (kept.length === 0) return risks;

  // Build a timeline of visual events
  const events = [];
  for (const d of kept) {
    if (d.template || d.imageQuery || d.videoQuery || d.overlayText) {
      events.push({ startUs: d.startUs, endUs: d.endUs });
    }
  }

  if (events.length === 0) {
    risks.push({
      startUs: kept[0].startUs,
      endUs: kept[kept.length - 1].endUs,
      durationSec: Math.round(((kept[kept.length - 1].endUs - kept[0].startUs) / 1_000_000)),
      severity: 'high',
      message: 'Entire video has no visual overlays — high retention risk',
    });
    return risks;
  }

  // Sort events and find gaps
  events.sort((a, b) => a.startUs - b.startUs);
  const riskThresholdUs = CONFIG.retentionRiskWindowSec * 1_000_000;

  for (let i = 1; i < events.length; i++) {
    const gap = events[i].startUs - events[i - 1].endUs;
    if (gap > riskThresholdUs) {
      risks.push({
        startUs: events[i - 1].endUs,
        endUs: events[i].startUs,
        durationSec: Math.round(gap / 1_000_000),
        severity: gap > riskThresholdUs * 2 ? 'high' : 'medium',
        message: `${Math.round(gap / 1_000_000)}s gap without visual change`,
      });
    }
  }

  return risks;
}

/**
 * Find overload zones — too many overlays stacked in a short window.
 */
function findOverloadZones(decisions) {
  const zones = [];
  const kept = decisions.filter(d => !d.cut);
  const windowUs = CONFIG.overloadWindowSec * 1_000_000;

  for (let i = 0; i < kept.length; i++) {
    const windowEnd = kept[i].startUs + windowUs;
    const inWindow = kept.filter(d =>
      d.startUs >= kept[i].startUs && d.startUs < windowEnd
    );

    let overlayCount = 0;
    for (const d of inWindow) {
      if (d.template) overlayCount++;
      if (d.imageQuery) overlayCount++;
      if (d.videoQuery) overlayCount++;
      if (d.overlayText) overlayCount++;
    }

    if (overlayCount > CONFIG.overloadMaxOverlays) {
      // Avoid duplicate zone reports
      const alreadyReported = zones.some(z =>
        Math.abs(z.startUs - kept[i].startUs) < windowUs
      );
      if (!alreadyReported) {
        zones.push({
          startUs: kept[i].startUs,
          endUs: windowEnd,
          overlayCount,
          severity: overlayCount > CONFIG.overloadMaxOverlays * 1.5 ? 'high' : 'medium',
          message: `${overlayCount} overlay elements in ${CONFIG.overloadWindowSec}s window`,
        });
      }
    }
  }

  return zones;
}

/**
 * Suggest CTA placement points.
 */
function suggestCtaPlacements(chunks) {
  if (chunks.length === 0) return [];

  const totalDurationUs = chunks[chunks.length - 1].endUs - chunks[0].startUs;
  const placements = [];

  for (const pct of CONFIG.ctaPlacementPercent) {
    const targetUs = chunks[0].startUs + Math.round(totalDurationUs * pct);

    // Find nearest chunk boundary
    const nearest = chunks.reduce((best, c) => {
      const dist = Math.abs(c.startUs - targetUs);
      return dist < Math.abs(best.startUs - targetUs) ? c : best;
    }, chunks[0]);

    placements.push({
      targetPercent: Math.round(pct * 100),
      targetTimeSec: Math.round(targetUs / 1_000_000),
      nearestChunkIndex: nearest.index,
      nearestChunkStartSec: Math.round(nearest.startUs / 1_000_000),
      suggestion: pct < 0.5
        ? 'Mid-video CTA: "Subscribe for more" or engagement prompt'
        : pct < 0.8
        ? 'Reinforcement CTA: "Like if you agree" or share prompt'
        : 'End CTA: "Follow for updates" or call to action',
    });
  }

  return placements;
}

/**
 * Find potential Shorts/Clips candidates — self-contained 30-60s segments.
 */
function findShortsCandiates(chunks) {
  const candidates = [];
  if (chunks.length < CONFIG.shortsMinChunks) return candidates;

  for (let i = 0; i <= chunks.length - CONFIG.shortsMinChunks; i++) {
    // Try windows of 3-8 consecutive chunks
    for (let len = CONFIG.shortsMinChunks; len <= Math.min(8, chunks.length - i); len++) {
      const window = chunks.slice(i, i + len);
      const durationSec = (window[window.length - 1].endUs - window[0].startUs) / 1_000_000;

      if (durationSec >= CONFIG.shortsMinSec && durationSec <= CONFIG.shortsMaxSec) {
        // Check if this window forms a self-contained topic
        const text = window.map(c => c.text || '').join(' ');
        const wordCount = countWords(text);

        candidates.push({
          startChunk: window[0].index,
          endChunk: window[window.length - 1].index,
          startUs: window[0].startUs,
          endUs: window[window.length - 1].endUs,
          durationSec: Math.round(durationSec),
          chunkCount: len,
          wordCount,
          preview: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        });
        break; // Only one candidate per start position
      }
    }
  }

  // Keep top 5 by word density (information-rich = better shorts)
  return candidates
    .sort((a, b) => (b.wordCount / b.durationSec) - (a.wordCount / a.durationSec))
    .slice(0, 5);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = readArg('--project-id');
  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const chunksPath = path.join(projectDir, 'semantic_chunks.json');
  const hrPlanPath = path.join(projectDir, 'high-retention-plan.json');
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const outputPath = path.join(projectDir, 'global_analysis.json');

  let chunks = [];
  let decisions = [];

  if (await exists(chunksPath)) {
    const sc = await readJson(chunksPath);
    chunks = sc.chunks || [];
  }

  if (await exists(hrPlanPath)) {
    const hr = await readJson(hrPlanPath);
    decisions = hr.decisions || [];
  }

  // Fallback: build chunks from transcript segments
  if (chunks.length === 0 && await exists(transcriptPath)) {
    const tr = await readJson(transcriptPath);
    chunks = (tr.segments || []).map((s, i) => ({
      index: i,
      startUs: s.startUs,
      endUs: s.endUs,
      text: s.text || '',
    }));
  }

  if (chunks.length === 0) {
    const result = { ok: true, projectId, message: 'No content to analyse' };
    await writeJson(outputPath, result);
    await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
    return;
  }

  console.error(`[GlobalAnalysis] Analysing ${chunks.length} chunks, ${decisions.length} decisions...`);

  const hook = analyseHook(chunks, decisions);
  const retentionRisks = findRetentionRisks(chunks, decisions);
  const overloadZones = findOverloadZones(decisions);
  const ctaPlacements = suggestCtaPlacements(chunks);
  const shortsCandidates = findShortsCandiates(chunks);

  const totalDurationSec = chunks.length > 0
    ? Math.round((chunks[chunks.length - 1].endUs - chunks[0].startUs) / 1_000_000)
    : 0;

  const result = {
    ok: true,
    projectId,
    analysedAt: new Date().toISOString(),
    config: CONFIG,
    totalDurationSec,
    totalChunks: chunks.length,
    hook,
    retentionRisks: {
      count: retentionRisks.length,
      totalRiskSec: retentionRisks.reduce((s, r) => s + r.durationSec, 0),
      zones: retentionRisks,
    },
    overloadZones: {
      count: overloadZones.length,
      zones: overloadZones,
    },
    ctaPlacements,
    shortsCandidates: {
      count: shortsCandidates.length,
      candidates: shortsCandidates,
    },
  };

  await writeJson(outputPath, result);

  console.error(`[GlobalAnalysis] Done:`);
  console.error(`  Hook score: ${hook.score}/100`);
  console.error(`  Retention risks: ${retentionRisks.length} zones (${retentionRisks.reduce((s, r) => s + r.durationSec, 0)}s total)`);
  console.error(`  Overload zones: ${overloadZones.length}`);
  console.error(`  CTA placements: ${ctaPlacements.length}`);
  console.error(`  Shorts candidates: ${shortsCandidates.length}`);

  await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
