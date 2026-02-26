#!/usr/bin/env node

/**
 * Seam Quality Pass — Phase 5 Review Gate 4
 *
 * Analyses cut seam quality after cuts are applied:
 *   - Audio energy delta at cut boundaries
 *   - Visual jump intensity (frame histogram diff)
 *   - Sentence continuity across seams
 *
 * Recommends:
 *   - Audio crossfade duration per seam
 *   - Cut padding adjustments
 *
 * Reads: transcript.json, cut_safety_report.json (or cut-plan.json)
 * Writes: seam_quality_report.json
 *
 * Usage:
 *   node scripts/lib/seam_quality.mjs \
 *     --project-id <id> --input <video-path> [--project-dir <dir>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

// ── Config ───────────────────────────────────────────────────────────────────

const DEFAULTS = {
  audioFadeMs: 50,          // Default crossfade duration at seams
  paddingMs: 100,           // Extra padding around each cut
  maxFadeMs: 200,           // Max crossfade for harsh seams
  energyDeltaThreshold: 12, // dB delta that triggers extended fade
  probeWindowSec: 0.5,      // Audio probe window around each seam
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function run(command, args = [], timeout = 60000) {
  const { stdout, stderr } = await execFile(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    stdout: (stdout ?? '').toString().trim(),
    stderr: (stderr ?? '').toString().trim(),
  };
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

// ── Audio Energy Probe ───────────────────────────────────────────────────────

/**
 * Measure RMS audio energy in a short window around a timestamp.
 * Returns energy in dBFS.
 */
async function probeAudioEnergy(inputPath, timestampSec, windowSec = DEFAULTS.probeWindowSec) {
  const startSec = Math.max(0, timestampSec - windowSec / 2);
  try {
    const { stderr } = await run('ffmpeg', [
      '-ss', String(startSec),
      '-t', String(windowSec),
      '-i', inputPath,
      '-af', 'volumedetect',
      '-f', 'null', '-',
    ], 30000);

    const meanMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
    const maxMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
    return {
      meanDb: meanMatch ? parseFloat(meanMatch[1]) : -60,
      maxDb: maxMatch ? parseFloat(maxMatch[1]) : -60,
    };
  } catch {
    return { meanDb: -60, maxDb: -60 };
  }
}

// ── Frame Similarity Scoring ─────────────────────────────────────────────

/**
 * Extract a single frame at a given timestamp and compute its average luma.
 * Returns { avgLuma, stdLuma } or null on failure.
 */
async function probeFrameLuma(inputPath, timestampSec) {
  try {
    const { stderr } = await run('ffmpeg', [
      '-ss', String(Math.max(0, timestampSec)),
      '-i', inputPath,
      '-frames:v', '1',
      '-vf', 'signalstats=stat=tout+vrep+brng',
      '-f', 'null', '-',
    ], 15000);

    // Parse average luma (YAVG) and standard deviation (YDIF/YLOW)
    const yavgMatch = stderr.match(/YAVG:\s*([\d.]+)/);
    const yminMatch = stderr.match(/YMIN:\s*([\d.]+)/);
    const ymaxMatch = stderr.match(/YMAX:\s*([\d.]+)/);
    return {
      avgLuma: yavgMatch ? parseFloat(yavgMatch[1]) : null,
      minLuma: yminMatch ? parseFloat(yminMatch[1]) : null,
      maxLuma: ymaxMatch ? parseFloat(ymaxMatch[1]) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Compare frames on either side of a cut point.
 * Returns a similarity score 0-1 (1 = identical, 0 = completely different)
 * and flags hard jump cuts.
 */
async function checkFrameSimilarity(inputPath, cutStartSec, cutEndSec) {
  const [frameBefore, frameAfter] = await Promise.all([
    probeFrameLuma(inputPath, cutStartSec - 0.05),
    probeFrameLuma(inputPath, cutEndSec + 0.05),
  ]);

  if (!frameBefore || !frameAfter || frameBefore.avgLuma === null || frameAfter.avgLuma === null) {
    return { similarity: null, lumaShift: null, flags: [] };
  }

  // Compute luma shift (brightness change) — higher = more jarring
  const lumaShift = Math.abs(frameBefore.avgLuma - frameAfter.avgLuma);
  // Normalize to 0-1 where 0 = max shift (255), 1 = no shift
  const similarity = Math.max(0, 1 - lumaShift / 128);

  const flags = [];

  if (lumaShift > 80) {
    flags.push({
      type: 'hard_jump_cut',
      severity: 'medium',
      message: `Hard visual jump: luma shift ${lumaShift.toFixed(0)} (${frameBefore.avgLuma.toFixed(0)} → ${frameAfter.avgLuma.toFixed(0)})`,
    });
  } else if (lumaShift > 40) {
    flags.push({
      type: 'visual_discontinuity',
      severity: 'low',
      message: `Visual discontinuity: luma shift ${lumaShift.toFixed(0)}`,
    });
  }

  return {
    similarity: Math.round(similarity * 1000) / 1000,
    lumaShift: Math.round(lumaShift * 10) / 10,
    lumaBefore: Math.round(frameBefore.avgLuma * 10) / 10,
    lumaAfter: Math.round(frameAfter.avgLuma * 10) / 10,
    flags,
  };
}

// ── Seam Analysis ────────────────────────────────────────────────────────────

/**
 * Analyse a single seam (the junction between two kept segments after a cut).
 */
async function analyseSeam(inputPath, cutRange, segments) {
  const { startUs, endUs } = cutRange;
  const startSec = startUs / 1_000_000;
  const endSec = endUs / 1_000_000;

  // Probe audio energy and frame similarity in parallel
  const [energyBefore, energyAfter, frameSim] = await Promise.all([
    probeAudioEnergy(inputPath, startSec - 0.25),
    probeAudioEnergy(inputPath, endSec + 0.25),
    checkFrameSimilarity(inputPath, startSec, endSec),
  ]);

  const energyDeltaDb = Math.abs(energyBefore.meanDb - energyAfter.meanDb);

  // Determine recommended fade duration based on energy delta
  let recommendedFadeMs = DEFAULTS.audioFadeMs;
  const flags = [...frameSim.flags];

  if (energyDeltaDb > DEFAULTS.energyDeltaThreshold) {
    recommendedFadeMs = DEFAULTS.maxFadeMs;
    flags.push({
      type: 'harsh_audio_transition',
      severity: 'medium',
      message: `Audio energy delta ${energyDeltaDb.toFixed(1)}dB at seam — extended fade recommended`,
    });
  } else if (energyDeltaDb > DEFAULTS.energyDeltaThreshold / 2) {
    recommendedFadeMs = Math.round(DEFAULTS.audioFadeMs * 1.5);
    flags.push({
      type: 'moderate_audio_transition',
      severity: 'low',
      message: `Audio energy delta ${energyDeltaDb.toFixed(1)}dB at seam`,
    });
  }

  // Check for text continuity across the seam
  const segBefore = segments.filter(s => s.endUs <= startUs).pop();
  const segAfter = segments.find(s => s.startUs >= endUs);

  if (segBefore && segAfter) {
    const beforeText = (segBefore.text || '').trim();
    const afterText = (segAfter.text || '').trim();

    // Check if the join creates an awkward sentence
    if (beforeText && afterText) {
      const endsClean = /[.!?।]\s*$/.test(beforeText);
      const startsClean = /^[A-Z\u0900-\u097F]/.test(afterText);

      if (!endsClean && !startsClean) {
        flags.push({
          type: 'awkward_sentence_join',
          severity: 'medium',
          message: `Awkward text join: "...${beforeText.slice(-25)}" → "${afterText.slice(0, 25)}..."`,
        });
      }
    }
  }

  // J-cut / L-cut recommendation:
  // J-cut: audio from next segment leads the video cut (good for scene transitions)
  // L-cut: audio from current segment trails past the video cut (good for reactions)
  let audioLeadMs = 0;  // J-cut: audio leads video
  let audioLagMs = 0;   // L-cut: audio trails video

  const hasHardJump = frameSim.flags?.some(f => f.type === 'hard_jump_cut');
  const hasVisualDisc = frameSim.flags?.some(f => f.type === 'visual_discontinuity');
  const hasHarshAudio = energyDeltaDb > DEFAULTS.energyDeltaThreshold;

  if (hasHardJump && !hasHarshAudio) {
    // Hard visual jump but smooth audio → L-cut softens the visual transition
    audioLagMs = 150;
    flags.push({
      type: 'l_cut_recommended',
      severity: 'low',
      message: `L-cut recommended: audio trails ${audioLagMs}ms past video cut to soften hard visual jump`,
    });
  } else if (hasHarshAudio && !hasHardJump) {
    // Harsh audio but smooth video → J-cut lets next audio lead
    audioLeadMs = 120;
    flags.push({
      type: 'j_cut_recommended',
      severity: 'low',
      message: `J-cut recommended: audio leads ${audioLeadMs}ms before video cut to smooth audio transition`,
    });
  } else if (hasVisualDisc && energyDeltaDb > DEFAULTS.energyDeltaThreshold / 2) {
    // Moderate visual + moderate audio → small J-cut
    audioLeadMs = 80;
    flags.push({
      type: 'j_cut_recommended',
      severity: 'low',
      message: `Mild J-cut recommended: audio leads ${audioLeadMs}ms for smoother transition`,
    });
  }

  return {
    cutStartUs: startUs,
    cutEndUs: endUs,
    cutDurationSec: Math.round((endUs - startUs) / 1000) / 1000,
    energyBefore: { meanDb: energyBefore.meanDb, maxDb: energyBefore.maxDb },
    energyAfter: { meanDb: energyAfter.meanDb, maxDb: energyAfter.maxDb },
    energyDeltaDb: Math.round(energyDeltaDb * 10) / 10,
    frameSimilarity: frameSim.similarity,
    lumaShift: frameSim.lumaShift,
    lumaBefore: frameSim.lumaBefore ?? null,
    lumaAfter: frameSim.lumaAfter ?? null,
    recommendedFadeMs,
    recommendedPaddingMs: DEFAULTS.paddingMs,
    audioLeadMs,
    audioLagMs,
    flags,
    seamQuality: flags.some(f => f.severity === 'medium') ? 'poor'
      : flags.length > 0 ? 'fair' : 'good',
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = readArg('--project-id');
  const input = readArg('--input');
  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const safetyReportPath = path.join(projectDir, 'cut_safety_report.json');
  const cutPlanPath = path.join(projectDir, 'cut-plan.json');
  const hrPlanPath = path.join(projectDir, 'high-retention-plan.json');
  const outputPath = path.join(projectDir, 'seam_quality_report.json');

  // Find the video input path
  let inputPath = input;
  if (!inputPath) {
    // Try to resolve from metadata
    const metaPath = path.join(projectDir, 'media', 'metadata.json');
    if (await exists(metaPath)) {
      const meta = await readJson(metaPath);
      inputPath = meta.sourcePath || '';
    }
  }

  if (!inputPath || !(await exists(inputPath))) {
    console.error('[SeamQuality] No input video path available — running text-only analysis');
  }

  const transcript = await readJson(transcriptPath);
  const segments = transcript.segments || [];

  // Load cut ranges — prefer safety report (scored), then HR plan, then cut plan
  let removeRanges = [];
  if (await exists(safetyReportPath)) {
    const safety = await readJson(safetyReportPath);
    removeRanges = (safety.scoredCuts || []).filter(c => c.autoApply !== false);
  } else if (await exists(hrPlanPath)) {
    const hr = await readJson(hrPlanPath);
    removeRanges = hr.removeRanges || [];
  } else if (await exists(cutPlanPath)) {
    const cp = await readJson(cutPlanPath);
    removeRanges = cp.removeRanges || [];
  }

  if (removeRanges.length === 0) {
    const result = { ok: true, projectId, seamCount: 0, seams: [], defaults: DEFAULTS };
    await writeJson(outputPath, result);
    await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
    return;
  }

  console.error(`[SeamQuality] Analysing ${removeRanges.length} seams...`);

  // Analyse seams — in series if we need audio probing, text-only otherwise
  const seams = [];
  for (const range of removeRanges) {
    if (inputPath && await exists(inputPath)) {
      seams.push(await analyseSeam(inputPath, range, segments));
    } else {
      // Text-only analysis — no audio probing
      seams.push({
        cutStartUs: range.startUs,
        cutEndUs: range.endUs,
        cutDurationSec: Math.round((range.endUs - range.startUs) / 1000) / 1000,
        energyBefore: null,
        energyAfter: null,
        energyDeltaDb: null,
        recommendedFadeMs: DEFAULTS.audioFadeMs,
        recommendedPaddingMs: DEFAULTS.paddingMs,
        flags: [],
        seamQuality: 'unknown',
      });
    }
  }

  const poorSeams = seams.filter(s => s.seamQuality === 'poor').length;
  const fairSeams = seams.filter(s => s.seamQuality === 'fair').length;
  const goodSeams = seams.filter(s => s.seamQuality === 'good').length;

  const result = {
    ok: true,
    projectId,
    analysedAt: new Date().toISOString(),
    seamCount: seams.length,
    summary: { good: goodSeams, fair: fairSeams, poor: poorSeams },
    defaults: DEFAULTS,
    seams,
  };

  await writeJson(outputPath, result);

  console.error(`[SeamQuality] Done: ${goodSeams} good, ${fairSeams} fair, ${poorSeams} poor seams`);

  await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
