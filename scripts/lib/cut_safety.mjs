#!/usr/bin/env node

/**
 * Cut Safety Scorer — Phase 4 Review Gate 3
 *
 * Analyses each proposed cut range for safety issues:
 *   - Mid-sentence cuts: does the cut boundary fall inside a sentence?
 *   - Meaning disruption: does removing the segment break logical flow?
 *   - Bridge sentence removal: does the cut remove transitional phrases?
 *   - Abrupt transition: how different are the segments on either side of the cut?
 *
 * Each cut gets a safetyScore (0-1). Risky cuts (< 0.6) are downgraded
 * from "auto-apply" to "suggested" so the user can review them.
 *
 * Reads: transcript.json, cut-plan.json (or high-retention-plan.json)
 * Writes: cut_safety_report.json
 *
 * Usage:
 *   node scripts/lib/cut_safety.mjs \
 *     --project-id <id> [--project-dir <dir>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// ── Thresholds ───────────────────────────────────────────────────────────────

const SAFETY_THRESHOLD = 0.6;  // Below this → downgrade to "suggested"

// Transitional / bridge phrases that should not be cut
const BRIDGE_PHRASES = [
  'so ', 'therefore', 'however', 'but ', 'because', 'hence',
  'as a result', 'in conclusion', 'moving on', 'next',
  'first', 'second', 'third', 'finally', 'also', 'moreover',
  'on the other hand', 'in other words', 'for example', 'for instance',
  'to summarize', 'in short', 'let me explain',
  // Hindi connectors
  'इसलिए', 'लेकिन', 'क्योंकि', 'तो ', 'अब ', 'फिर',
  'पहले', 'दूसरा', 'अंत में', 'साथ ही', 'इसके अलावा',
];

// Sentence-ending patterns
const SENTENCE_END_RE = /[.!?।]\s*$/;
const SENTENCE_START_RE = /^[A-Z\u0900-\u097F]/; // Starts with capital or Devanagari

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

// ── Safety Analysis Functions ────────────────────────────────────────────────

/**
 * Find transcript segments that overlap with a time range.
 */
function findSegmentsInRange(segments, startUs, endUs) {
  return segments.filter(s =>
    s.startUs < endUs && s.endUs > startUs
  );
}

/**
 * Find the segment immediately before and after a cut range.
 */
function findAdjacentSegments(segments, startUs, endUs) {
  let before = null;
  let after = null;

  for (const seg of segments) {
    if (seg.endUs <= startUs) {
      if (!before || seg.endUs > before.endUs) before = seg;
    }
    if (seg.startUs >= endUs) {
      if (!after || seg.startUs < after.startUs) after = seg;
    }
  }

  return { before, after };
}

/**
 * Check if a cut boundary falls mid-sentence.
 */
function checkMidSentenceCut(cutSegments, allSegments, startUs, endUs) {
  const flags = [];

  if (cutSegments.length === 0) return flags;

  // Check if first cut segment starts mid-sentence
  const firstCutSeg = cutSegments[0];
  const { before } = findAdjacentSegments(allSegments, startUs, endUs);

  if (before) {
    const beforeText = (before.text || '').trim();
    if (!SENTENCE_END_RE.test(beforeText)) {
      flags.push({
        type: 'mid_sentence_start',
        severity: 'high',
        message: `Cut starts mid-sentence after: "...${beforeText.slice(-40)}"`,
        penalty: 0.3,
      });
    }
  }

  // Check if last cut segment ends mid-sentence
  const lastCutSeg = cutSegments[cutSegments.length - 1];
  const { after } = findAdjacentSegments(allSegments, startUs, endUs);

  if (after) {
    const lastText = (lastCutSeg.text || '').trim();
    const afterText = (after.text || '').trim();
    if (!SENTENCE_END_RE.test(lastText) && !SENTENCE_START_RE.test(afterText)) {
      flags.push({
        type: 'mid_sentence_end',
        severity: 'high',
        message: `Cut ends mid-sentence: "${lastText.slice(-30)}..." → "${afterText.slice(0, 30)}..."`,
        penalty: 0.3,
      });
    }
  }

  return flags;
}

/**
 * Check if the cut removes bridge/transitional phrases.
 */
function checkBridgeRemoval(cutSegments) {
  const flags = [];
  const cutText = cutSegments.map(s => (s.text || '').toLowerCase()).join(' ');

  for (const phrase of BRIDGE_PHRASES) {
    if (cutText.includes(phrase.toLowerCase())) {
      flags.push({
        type: 'bridge_removal',
        severity: 'medium',
        message: `Cut removes transitional phrase: "${phrase}"`,
        penalty: 0.15,
      });
      break; // One flag is enough
    }
  }

  return flags;
}

/**
 * Check transition quality between segments adjacent to the cut.
 */
function checkTransitionQuality(allSegments, startUs, endUs) {
  const flags = [];
  const { before, after } = findAdjacentSegments(allSegments, startUs, endUs);

  if (!before || !after) return flags;

  const beforeText = (before.text || '').trim();
  const afterText = (after.text || '').trim();

  // Check for pronoun mismatch — "he/she/it/they" after cut without referent
  const pronouns = ['he ', 'she ', 'it ', 'they ', 'this ', 'that ', 'these ', 'those ',
    'वह ', 'यह ', 'ये ', 'वो ', 'इसका ', 'उसका '];
  const afterLower = afterText.toLowerCase();
  for (const pronoun of pronouns) {
    if (afterLower.startsWith(pronoun)) {
      flags.push({
        type: 'dangling_reference',
        severity: 'medium',
        message: `Post-cut segment starts with pronoun "${pronoun.trim()}" — referent may be cut`,
        penalty: 0.15,
      });
      break;
    }
  }

  // Large time gap after cut — indicates context jump
  const timeGapUs = after.startUs - before.endUs;
  const cutDurationUs = endUs - startUs;
  if (cutDurationUs > 10_000_000) { // > 10s cut
    flags.push({
      type: 'large_cut',
      severity: 'low',
      message: `Large cut (${(cutDurationUs / 1_000_000).toFixed(1)}s) — verify context continuity`,
      penalty: 0.1,
    });
  }

  return flags;
}

/**
 * Score a single cut range.
 */
function scoreCut(cutRange, allSegments) {
  const { startUs, endUs } = cutRange;
  const cutSegments = findSegmentsInRange(allSegments, startUs, endUs);

  const allFlags = [
    ...checkMidSentenceCut(cutSegments, allSegments, startUs, endUs),
    ...checkBridgeRemoval(cutSegments),
    ...checkTransitionQuality(allSegments, startUs, endUs),
  ];

  // Start with perfect score, apply penalties
  let safetyScore = 1.0;
  for (const flag of allFlags) {
    safetyScore -= flag.penalty;
  }
  safetyScore = Math.max(0, Math.min(1, safetyScore));

  const isRisky = safetyScore < SAFETY_THRESHOLD;

  return {
    ...cutRange,
    safetyScore: Math.round(safetyScore * 100) / 100,
    safetyFlags: allFlags,
    isRisky,
    autoApply: !isRisky, // Downgrade risky cuts to "suggested"
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = readArg('--project-id');
  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const cutPlanPath = path.join(projectDir, 'cut-plan.json');
  const hrPlanPath = path.join(projectDir, 'high-retention-plan.json');
  const outputPath = path.join(projectDir, 'cut_safety_report.json');

  if (!(await exists(transcriptPath))) {
    throw new Error(`Transcript not found: ${transcriptPath}`);
  }

  const transcript = await readJson(transcriptPath);
  const segments = transcript.segments || [];

  // Load cut ranges from whichever source is available
  let removeRanges = [];
  let cutSource = 'none';

  if (await exists(hrPlanPath)) {
    const hrPlan = await readJson(hrPlanPath);
    removeRanges = hrPlan.removeRanges || [];
    cutSource = 'high-retention-plan';
  } else if (await exists(cutPlanPath)) {
    const cutPlan = await readJson(cutPlanPath);
    removeRanges = cutPlan.removeRanges || [];
    cutSource = 'cut-plan';
  }

  if (removeRanges.length === 0) {
    const result = {
      ok: true,
      projectId,
      totalCuts: 0,
      safeCuts: 0,
      riskyCuts: 0,
      downgradedCuts: 0,
      scoredCuts: [],
      cutSource,
    };
    await writeJson(outputPath, result);
    await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
    return;
  }

  console.error(`[CutSafety] Scoring ${removeRanges.length} cuts from ${cutSource}...`);

  // Score each cut
  const scoredCuts = removeRanges.map(range => scoreCut(range, segments));

  const safeCuts = scoredCuts.filter(c => !c.isRisky).length;
  const riskyCuts = scoredCuts.filter(c => c.isRisky).length;
  const downgradedCuts = scoredCuts.filter(c => c.isRisky && !c.autoApply).length;

  const result = {
    ok: true,
    projectId,
    analysedAt: new Date().toISOString(),
    cutSource,
    safetyThreshold: SAFETY_THRESHOLD,
    totalCuts: scoredCuts.length,
    safeCuts,
    riskyCuts,
    downgradedCuts,
    avgSafetyScore: scoredCuts.length > 0
      ? Math.round((scoredCuts.reduce((s, c) => s + c.safetyScore, 0) / scoredCuts.length) * 100) / 100
      : 0,
    scoredCuts,
  };

  await writeJson(outputPath, result);

  console.error(`[CutSafety] Done: ${safeCuts} safe, ${riskyCuts} risky, ${downgradedCuts} downgraded`);
  for (const c of scoredCuts.filter(c => c.isRisky)) {
    console.error(`  ⚠ Cut ${c.startUs}-${c.endUs}: score ${c.safetyScore} — ${c.safetyFlags.map(f => f.type).join(', ')}`);
  }

  await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
