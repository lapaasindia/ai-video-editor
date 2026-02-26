#!/usr/bin/env node

/**
 * Style Preference Learning — Phase 12
 *
 * Tracks user editing decisions across projects and builds a preference
 * profile that informs future AI pipeline runs. Learns from:
 *   - Cut approval/rejection patterns (aggressive vs conservative)
 *   - Template selection frequency
 *   - Fade duration preferences (from seam overrides)
 *   - Overlay density preferences
 *   - Chunk review decisions (which chunk types get rejected)
 *
 * Reads: chunk_review_decisions.json, cut-plan.json, high-retention-plan.json,
 *        agentic-edit-result.json, seam_quality_report.json
 * Writes: ~/.lapaas/style_preferences.json (global) +
 *         <projectDir>/style_snapshot.json (per-project)
 *
 * Usage:
 *   node scripts/lib/style_preferences.mjs --project-id <id> [--project-dir <dir>]
 *   node scripts/lib/style_preferences.mjs --read   # Output current preferences as JSON
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// ── Config ───────────────────────────────────────────────────────────────────

const PREFS_DIR = path.join(os.homedir(), '.lapaas');
const PREFS_PATH = path.join(PREFS_DIR, 'style_preferences.json');

const DEFAULT_PREFS = {
  version: 1,
  updatedAt: null,
  projectCount: 0,
  cutting: {
    approvalRate: null,       // 0-1: how often user approves AI cuts
    avgCutDensityPerMin: null, // cuts per minute the user prefers
    preferredFadeMs: null,     // average fade duration user tends toward
    style: null,               // 'aggressive' | 'moderate' | 'conservative'
  },
  chunks: {
    approvalRate: null,        // 0-1: how often user approves AI chunks
    preferredAvgScore: null,   // average chunk score of approved chunks
  },
  templates: {
    mostUsed: [],              // [{templateId, count}] top 5
    density: null,             // templates per minute
  },
  overlays: {
    density: null,             // text overlays per minute
  },
  transitions: {
    jCutRate: null,            // 0-1: how often J-cuts are recommended
    lCutRate: null,            // 0-1: how often L-cuts are recommended
  },
  history: [],                 // [{projectId, learnedAt, snapshot}] last 20
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

async function loadPrefs() {
  if (await exists(PREFS_PATH)) {
    try {
      return { ...DEFAULT_PREFS, ...(await readJson(PREFS_PATH)) };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }
  return { ...DEFAULT_PREFS };
}

// ── Weighted running average ─────────────────────────────────────────────────

function runningAvg(current, newValue, weight = 0.3) {
  if (current === null || current === undefined) return newValue;
  return current * (1 - weight) + newValue * weight;
}

// ── Learning from a single project ───────────────────────────────────────────

async function learnFromProject(projectDir, projectId) {
  const snapshot = { projectId, learnedAt: new Date().toISOString() };

  // 1. Cut approval/rejection patterns
  const cutPlanPath = path.join(projectDir, 'cut-plan.json');
  const reviewPath = path.join(projectDir, 'chunk_review_decisions.json');

  let cutApprovalRate = null;
  if (await exists(reviewPath)) {
    try {
      const decisions = await readJson(reviewPath);
      const total = Object.keys(decisions).length;
      const approved = Object.values(decisions).filter(d => d === 'accepted' || d === 'approve').length;
      if (total > 0) {
        cutApprovalRate = approved / total;
        snapshot.chunkApprovalRate = cutApprovalRate;
      }
    } catch { /* skip */ }
  }

  // 2. Cut density
  let cutDensity = null;
  let totalDurationMin = null;
  if (await exists(cutPlanPath)) {
    try {
      const cp = await readJson(cutPlanPath);
      const ranges = cp.removeRanges || [];
      const totalRemovedUs = ranges.reduce((s, r) => s + (r.endUs - r.startUs), 0);
      // Estimate total duration from transcript
      const txPath = path.join(projectDir, 'transcript.json');
      if (await exists(txPath)) {
        const tx = await readJson(txPath);
        const segs = tx.segments || [];
        if (segs.length > 0) {
          const lastSeg = segs[segs.length - 1];
          totalDurationMin = (lastSeg.endUs || 0) / 60_000_000;
          if (totalDurationMin > 0) {
            cutDensity = ranges.length / totalDurationMin;
            snapshot.cutDensity = cutDensity;
          }
        }
      }
    } catch { /* skip */ }
  }

  // 3. Seam / fade preferences + J/L-cut rates
  const seamPath = path.join(projectDir, 'seam_quality_report.json');
  let avgFadeMs = null;
  let jCutCount = 0;
  let lCutCount = 0;
  let seamTotal = 0;
  if (await exists(seamPath)) {
    try {
      const sr = await readJson(seamPath);
      const seams = sr.seams || [];
      seamTotal = seams.length;
      if (seamTotal > 0) {
        avgFadeMs = seams.reduce((s, sm) => s + (sm.recommendedFadeMs || 50), 0) / seamTotal;
        jCutCount = seams.filter(s => (s.audioLeadMs || 0) > 0).length;
        lCutCount = seams.filter(s => (s.audioLagMs || 0) > 0).length;
        snapshot.avgFadeMs = avgFadeMs;
        snapshot.jCutRate = jCutCount / seamTotal;
        snapshot.lCutRate = lCutCount / seamTotal;
      }
    } catch { /* skip */ }
  }

  // 4. Template usage
  const hrPath = path.join(projectDir, 'high-retention-plan.json');
  let templateCounts = {};
  let templateTotal = 0;
  if (await exists(hrPath)) {
    try {
      const hr = await readJson(hrPath);
      const placements = hr.templatePlacements || [];
      templateTotal = placements.length;
      for (const p of placements) {
        const tid = p.templateId || 'unknown';
        templateCounts[tid] = (templateCounts[tid] || 0) + 1;
      }
      snapshot.templateCount = templateTotal;
    } catch { /* skip */ }
  }

  // 5. Overlay density
  let overlayCount = 0;
  if (await exists(hrPath)) {
    try {
      const hr = await readJson(hrPath);
      const chunks = hr.chunks || [];
      for (const chunk of chunks) {
        overlayCount += (chunk.textOverlays || []).length;
      }
      snapshot.overlayCount = overlayCount;
    } catch { /* skip */ }
  }

  // 6. Chunk QC scores of approved chunks
  const chunkQcPath = path.join(projectDir, 'chunk_qc_report.json');
  let avgApprovedScore = null;
  if (await exists(chunkQcPath) && await exists(reviewPath)) {
    try {
      const qc = await readJson(chunkQcPath);
      const decisions = await readJson(reviewPath);
      const scores = (qc.scores || [])
        .filter(s => decisions[String(s.chunkIndex)] === 'accepted' || decisions[String(s.chunkIndex)] === 'approve')
        .map(s => s.overall);
      if (scores.length > 0) {
        avgApprovedScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        snapshot.avgApprovedChunkScore = avgApprovedScore;
      }
    } catch { /* skip */ }
  }

  return {
    snapshot,
    cutApprovalRate,
    cutDensity,
    avgFadeMs,
    jCutCount,
    lCutCount,
    seamTotal,
    templateCounts,
    templateTotal,
    overlayCount,
    totalDurationMin,
    avgApprovedScore,
  };
}

// ── Update global preferences ────────────────────────────────────────────────

async function updatePreferences(projectDir, projectId) {
  const prefs = await loadPrefs();
  const learned = await learnFromProject(projectDir, projectId);

  prefs.projectCount += 1;
  prefs.updatedAt = new Date().toISOString();

  // Update cutting preferences
  if (learned.cutApprovalRate !== null) {
    prefs.cutting.approvalRate = runningAvg(prefs.cutting.approvalRate, learned.cutApprovalRate);
    // Derive style from approval rate
    if (prefs.cutting.approvalRate > 0.85) prefs.cutting.style = 'aggressive';
    else if (prefs.cutting.approvalRate > 0.6) prefs.cutting.style = 'moderate';
    else prefs.cutting.style = 'conservative';
  }
  if (learned.cutDensity !== null) {
    prefs.cutting.avgCutDensityPerMin = runningAvg(prefs.cutting.avgCutDensityPerMin, learned.cutDensity);
  }
  if (learned.avgFadeMs !== null) {
    prefs.cutting.preferredFadeMs = runningAvg(prefs.cutting.preferredFadeMs, learned.avgFadeMs);
  }

  // Update chunk preferences
  if (learned.cutApprovalRate !== null) {
    prefs.chunks.approvalRate = runningAvg(prefs.chunks.approvalRate, learned.cutApprovalRate);
  }
  if (learned.avgApprovedScore !== null) {
    prefs.chunks.preferredAvgScore = runningAvg(prefs.chunks.preferredAvgScore, learned.avgApprovedScore);
  }

  // Update template preferences
  if (learned.templateTotal > 0) {
    // Merge template counts
    const existing = {};
    for (const t of (prefs.templates.mostUsed || [])) {
      existing[t.templateId] = t.count;
    }
    for (const [tid, count] of Object.entries(learned.templateCounts)) {
      existing[tid] = (existing[tid] || 0) + count;
    }
    prefs.templates.mostUsed = Object.entries(existing)
      .map(([templateId, count]) => ({ templateId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    if (learned.totalDurationMin > 0) {
      prefs.templates.density = runningAvg(prefs.templates.density, learned.templateTotal / learned.totalDurationMin);
    }
  }

  // Update overlay preferences
  if (learned.overlayCount > 0 && learned.totalDurationMin > 0) {
    prefs.overlays.density = runningAvg(prefs.overlays.density, learned.overlayCount / learned.totalDurationMin);
  }

  // Update J/L-cut preferences
  if (learned.seamTotal > 0) {
    prefs.transitions.jCutRate = runningAvg(prefs.transitions.jCutRate, learned.jCutCount / learned.seamTotal);
    prefs.transitions.lCutRate = runningAvg(prefs.transitions.lCutRate, learned.lCutCount / learned.seamTotal);
  }

  // Add to history (keep last 20)
  prefs.history.push(learned.snapshot);
  if (prefs.history.length > 20) {
    prefs.history = prefs.history.slice(-20);
  }

  // Save global + per-project snapshot
  await writeJson(PREFS_PATH, prefs);
  await writeJson(path.join(projectDir, 'style_snapshot.json'), {
    ...learned.snapshot,
    globalPrefsAtTime: {
      style: prefs.cutting.style,
      approvalRate: prefs.cutting.approvalRate,
      avgFadeMs: prefs.cutting.preferredFadeMs,
      templateDensity: prefs.templates.density,
      overlayDensity: prefs.overlays.density,
    },
  });

  return prefs;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // --read mode: just output current preferences
  if (process.argv.includes('--read')) {
    const prefs = await loadPrefs();
    process.stdout.write(JSON.stringify(prefs, null, 2) + '\n');
    return;
  }

  const projectId = readArg('--project-id');
  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  if (!(await exists(projectDir))) {
    throw new Error(`Project directory not found: ${projectDir}`);
  }

  console.error(`[StylePrefs] Learning preferences from project ${projectId}...`);
  const prefs = await updatePreferences(projectDir, projectId);

  console.error(`[StylePrefs] Updated — style: ${prefs.cutting.style || 'unknown'}, projects: ${prefs.projectCount}`);
  console.error(`[StylePrefs] Cut approval: ${prefs.cutting.approvalRate !== null ? (prefs.cutting.approvalRate * 100).toFixed(0) + '%' : 'n/a'}`);
  console.error(`[StylePrefs] Preferred fade: ${prefs.cutting.preferredFadeMs !== null ? prefs.cutting.preferredFadeMs.toFixed(0) + 'ms' : 'n/a'}`);
  console.error(`[StylePrefs] Template density: ${prefs.templates.density !== null ? prefs.templates.density.toFixed(1) + '/min' : 'n/a'}`);

  process.stdout.write(JSON.stringify(prefs, null, 2) + '\n');
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
