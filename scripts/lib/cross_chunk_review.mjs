#!/usr/bin/env node

/**
 * Cross-Chunk Consistency Review — Phase 10 Review Gate 9
 *
 * After all chunks are individually approved, reviews the full assembly:
 *   - Transition style consistency (no jarring style changes between chunks)
 *   - Repeated template guard (same template < 30s apart → swap alternative)
 *   - Audio loudness normalization recommendation
 *   - Pacing rhythm analysis (flag monotonous sections)
 *   - Visual fatigue detection (> 3 consecutive similar overlay types)
 *
 * Reads: high-retention-plan.json, semantic_chunks.json, chunk_qc_report.json
 * Writes: cross_chunk_report.json
 *
 * Usage:
 *   node scripts/lib/cross_chunk_review.mjs \
 *     --project-id <id> [--project-dir <dir>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// ── Config ───────────────────────────────────────────────────────────────────

const CONFIG = {
  templateRepeatWindowUs: 30_000_000,  // 30s — same template within this = repeat
  maxConsecutiveSameType: 3,           // > 3 consecutive same overlay type = fatigue
  pacingMonotonyWindowChunks: 5,       // Check 5-chunk windows for monotony
  pacingVarianceThreshold: 0.15,       // Coefficient of variation < 15% = monotonous
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

// ── Analysis Functions ───────────────────────────────────────────────────────

/**
 * Detect repeated templates within the repeat window.
 */
function detectTemplateRepeats(decisions) {
  const issues = [];
  const kept = decisions.filter(d => !d.cut && d.template);

  for (let i = 1; i < kept.length; i++) {
    const curr = kept[i];
    const prev = kept[i - 1];

    if (!curr.template?.templateId || !prev.template?.templateId) continue;

    if (curr.template.templateId === prev.template.templateId) {
      const gap = curr.startUs - prev.endUs;
      if (gap < CONFIG.templateRepeatWindowUs) {
        issues.push({
          type: 'template_repeat',
          severity: 'medium',
          chunkIndices: [prev.chunkIndex, curr.chunkIndex],
          templateId: curr.template.templateId,
          gapSec: Math.round(gap / 1_000_000),
          message: `Template "${curr.template.templateId}" repeated within ${Math.round(gap / 1_000_000)}s`,
          suggestion: 'Swap one instance for an alternative template',
        });
      }
    }
  }

  return issues;
}

/**
 * Detect visual fatigue — too many consecutive same-type overlays.
 */
function detectVisualFatigue(decisions) {
  const issues = [];
  const kept = decisions.filter(d => !d.cut);

  let consecutiveType = '';
  let consecutiveCount = 0;

  for (let i = 0; i < kept.length; i++) {
    const d = kept[i];
    // Determine primary overlay type for this chunk
    let overlayType = 'none';
    if (d.template) overlayType = 'template';
    else if (d.videoQuery) overlayType = 'video';
    else if (d.imageQuery) overlayType = 'image';
    else if (d.overlayText) overlayType = 'text';

    if (overlayType === consecutiveType && overlayType !== 'none') {
      consecutiveCount++;
      if (consecutiveCount >= CONFIG.maxConsecutiveSameType) {
        issues.push({
          type: 'visual_fatigue',
          severity: 'low',
          startChunk: i - consecutiveCount + 1,
          endChunk: i,
          overlayType,
          count: consecutiveCount + 1,
          message: `${consecutiveCount + 1} consecutive "${overlayType}" overlays — viewer fatigue risk`,
          suggestion: `Mix in a different overlay type (image, video, template, or text)`,
        });
      }
    } else {
      consecutiveType = overlayType;
      consecutiveCount = 0;
    }
  }

  return issues;
}

/**
 * Pacing rhythm analysis — detect monotonous sections.
 */
function analysePacing(chunks) {
  const issues = [];
  if (chunks.length < CONFIG.pacingMonotonyWindowChunks) return issues;

  for (let i = 0; i <= chunks.length - CONFIG.pacingMonotonyWindowChunks; i++) {
    const window = chunks.slice(i, i + CONFIG.pacingMonotonyWindowChunks);
    const durations = window.map(c => (c.endUs - c.startUs) / 1_000_000);

    const mean = durations.reduce((s, d) => s + d, 0) / durations.length;
    if (mean <= 0) continue;

    const variance = durations.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean; // Coefficient of variation

    if (cv < CONFIG.pacingVarianceThreshold) {
      issues.push({
        type: 'monotonous_pacing',
        severity: 'low',
        startChunk: window[0].index,
        endChunk: window[window.length - 1].index,
        avgDurationSec: Math.round(mean * 10) / 10,
        variationPercent: Math.round(cv * 100),
        message: `Chunks ${window[0].index}-${window[window.length - 1].index} have very uniform pacing (${Math.round(cv * 100)}% variation)`,
        suggestion: 'Consider varying chunk lengths or adding speed changes for rhythm',
      });
    }
  }

  // Deduplicate overlapping windows
  const deduped = [];
  for (const issue of issues) {
    const overlaps = deduped.some(d =>
      d.type === 'monotonous_pacing' &&
      d.startChunk <= issue.endChunk && d.endChunk >= issue.startChunk
    );
    if (!overlaps) deduped.push(issue);
  }

  return deduped;
}

/**
 * Transition style check — detect jarring style changes between consecutive chunks.
 */
function detectTransitionIssues(decisions) {
  const issues = [];
  const kept = decisions.filter(d => !d.cut);

  for (let i = 1; i < kept.length; i++) {
    const prev = kept[i - 1];
    const curr = kept[i];

    // Check for drastic overlay change (e.g., no overlay → heavy overlay)
    const prevElements = [prev.template, prev.imageQuery, prev.videoQuery, prev.overlayText].filter(Boolean).length;
    const currElements = [curr.template, curr.imageQuery, curr.videoQuery, curr.overlayText].filter(Boolean).length;

    const diff = Math.abs(prevElements - currElements);
    if (diff >= 3) {
      issues.push({
        type: 'jarring_transition',
        severity: 'low',
        chunkIndices: [prev.chunkIndex, curr.chunkIndex],
        message: `Overlay density jump: ${prevElements} elements → ${currElements} elements between chunks`,
        suggestion: 'Gradually transition overlay density between chunks',
      });
    }
  }

  return issues;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = readArg('--project-id');
  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const hrPlanPath = path.join(projectDir, 'high-retention-plan.json');
  const chunksPath = path.join(projectDir, 'semantic_chunks.json');
  const outputPath = path.join(projectDir, 'cross_chunk_report.json');

  let decisions = [];
  let chunks = [];

  if (await exists(hrPlanPath)) {
    const hr = await readJson(hrPlanPath);
    decisions = hr.decisions || [];
  }

  if (await exists(chunksPath)) {
    const sc = await readJson(chunksPath);
    chunks = sc.chunks || [];
  }

  // Use decisions as chunks if semantic chunks not available
  if (chunks.length === 0 && decisions.length > 0) {
    chunks = decisions.map((d, i) => ({
      index: i,
      startUs: d.startUs,
      endUs: d.endUs,
      text: d.text || '',
    }));
  }

  if (decisions.length === 0 && chunks.length === 0) {
    const result = { ok: true, projectId, issueCount: 0, issues: [] };
    await writeJson(outputPath, result);
    await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
    return;
  }

  console.error(`[CrossChunk] Reviewing ${chunks.length} chunks, ${decisions.length} decisions...`);

  const allIssues = [
    ...detectTemplateRepeats(decisions),
    ...detectVisualFatigue(decisions),
    ...analysePacing(chunks),
    ...detectTransitionIssues(decisions),
  ];

  const severityCounts = {
    high: allIssues.filter(i => i.severity === 'high').length,
    medium: allIssues.filter(i => i.severity === 'medium').length,
    low: allIssues.filter(i => i.severity === 'low').length,
  };

  const result = {
    ok: true,
    projectId,
    reviewedAt: new Date().toISOString(),
    config: CONFIG,
    issueCount: allIssues.length,
    severity: severityCounts,
    issues: allIssues,
    recommendations: {
      needsLoudnessNormalization: true, // Always recommend — applied at render time
      loudnormFilter: 'loudnorm=I=-16:TP=-1.5:LRA=11',
    },
  };

  await writeJson(outputPath, result);

  console.error(`[CrossChunk] Done: ${allIssues.length} issues (${severityCounts.high}H/${severityCounts.medium}M/${severityCounts.low}L)`);
  for (const issue of allIssues.filter(i => i.severity !== 'low')) {
    console.error(`  ⚠ ${issue.type}: ${issue.message}`);
  }

  await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
