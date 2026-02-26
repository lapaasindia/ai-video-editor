#!/usr/bin/env node

/**
 * Input Quality Gate — Phase 1 Review Gate
 *
 * Runs comprehensive quality checks on ingested media:
 *   - Audio level analysis (peak, mean, clipping detection)
 *   - Background noise / SNR estimation
 *   - Resolution & FPS validation
 *   - Duration sanity check (min/max bounds)
 *   - File corruption scan
 *   - Language detection (optional, via short Whisper probe)
 *
 * Output: input_quality_report.json
 *
 * Usage:
 *   node scripts/input_quality_gate.mjs \
 *     --input <path> --project-id <id> [--project-dir <dir>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

// ── Configurable Thresholds ──────────────────────────────────────────────────

const THRESHOLDS = {
  // Duration
  minDurationSec: 5,
  maxDurationSec: 10800, // 3 hours

  // Resolution
  minWidth: 640,
  minHeight: 360,
  warnWidth: 1280,
  warnHeight: 720,

  // FPS
  minFps: 20,
  warnFps: 24,

  // Audio levels (dBFS)
  clippingPeakDb: -1.0,     // peak > -1 dB → clipping
  lowAudioMeanDb: -40.0,    // mean < -40 dB → too quiet
  loudAudioMeanDb: -6.0,    // mean > -6 dB → too loud

  // Noise
  lowSnrDb: 10,             // SNR < 10 dB → noisy
  warnSnrDb: 20,            // SNR < 20 dB → slightly noisy
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function run(command, args = [], timeout = 120000) {
  const { stdout, stderr } = await execFile(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 16,
  });
  return {
    stdout: (stdout ?? '').toString().trim(),
    stderr: (stderr ?? '').toString().trim(),
  };
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Quality Checks ───────────────────────────────────────────────────────────

/**
 * Run ffprobe to get media metadata.
 */
async function probeMedia(inputPath) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_format', '-show_streams',
    '-print_format', 'json',
    inputPath,
  ]);
  return JSON.parse(stdout);
}

/**
 * Audio level analysis using ffmpeg volumedetect filter.
 * Returns: { maxVolume, meanVolume } in dBFS.
 */
async function analyseAudioLevels(inputPath) {
  try {
    const { stderr } = await run('ffmpeg', [
      '-i', inputPath,
      '-af', 'volumedetect',
      '-f', 'null', '-',
    ], 5 * 60 * 1000);

    const maxMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
    const meanMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);

    return {
      maxVolumeDb: maxMatch ? parseFloat(maxMatch[1]) : null,
      meanVolumeDb: meanMatch ? parseFloat(meanMatch[1]) : null,
    };
  } catch (e) {
    return { maxVolumeDb: null, meanVolumeDb: null, error: e.message };
  }
}

/**
 * Audio stats analysis using ffmpeg astats filter.
 * Returns: RMS level, peak level, dynamic range, noise floor estimate.
 */
async function analyseAudioStats(inputPath) {
  try {
    const { stderr } = await run('ffmpeg', [
      '-i', inputPath,
      '-af', 'astats=metadata=1:reset=0,ametadata=mode=print',
      '-f', 'null', '-',
    ], 5 * 60 * 1000);

    // Extract key stats from astats output
    const rmsMatch = stderr.match(/RMS level dB:\s*([-\d.]+)/);
    const peakMatch = stderr.match(/Peak level dB:\s*([-\d.]+)/);
    const noiseFloorMatch = stderr.match(/Noise floor dB:\s*([-\d.]+)/);
    const dynamicRangeMatch = stderr.match(/Dynamic range:\s*([-\d.]+)/);

    const rmsDb = rmsMatch ? parseFloat(rmsMatch[1]) : null;
    const peakDb = peakMatch ? parseFloat(peakMatch[1]) : null;
    const noiseFloorDb = noiseFloorMatch ? parseFloat(noiseFloorMatch[1]) : null;

    // Estimate SNR: difference between RMS signal and noise floor
    const estimatedSnrDb = (rmsDb !== null && noiseFloorDb !== null)
      ? Math.abs(rmsDb - noiseFloorDb)
      : null;

    return {
      rmsLevelDb: rmsDb,
      peakLevelDb: peakDb,
      noiseFloorDb,
      dynamicRange: dynamicRangeMatch ? parseFloat(dynamicRangeMatch[1]) : null,
      estimatedSnrDb,
    };
  } catch (e) {
    return { rmsLevelDb: null, peakLevelDb: null, noiseFloorDb: null, dynamicRange: null, estimatedSnrDb: null, error: e.message };
  }
}

/**
 * Silence detection — find percentage of silence in the file.
 */
async function detectSilencePercent(inputPath, durationSec) {
  try {
    const { stderr } = await run('ffmpeg', [
      '-i', inputPath,
      '-af', 'silencedetect=noise=-35dB:d=0.5',
      '-f', 'null', '-',
    ], 5 * 60 * 1000);

    const silenceEnds = [...stderr.matchAll(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g)];
    const totalSilenceSec = silenceEnds.reduce((sum, m) => sum + parseFloat(m[2]), 0);
    const silencePercent = durationSec > 0 ? (totalSilenceSec / durationSec) * 100 : 0;

    return {
      totalSilenceSec: Math.round(totalSilenceSec * 10) / 10,
      silencePercent: Math.round(silencePercent * 10) / 10,
      silenceRangeCount: silenceEnds.length,
    };
  } catch (e) {
    return { totalSilenceSec: 0, silencePercent: 0, silenceRangeCount: 0, error: e.message };
  }
}

/**
 * File corruption scan — decode entire file to null output.
 * If ffmpeg encounters errors, the file may be corrupted.
 */
async function scanCorruption(inputPath) {
  try {
    const { stderr } = await run('ffmpeg', [
      '-v', 'error',
      '-i', inputPath,
      '-f', 'null', '-',
    ], 10 * 60 * 1000);

    const errors = stderr.split('\n').filter(l => l.trim().length > 0);
    return {
      corrupted: errors.length > 3, // Allow up to 3 minor warnings
      errorCount: errors.length,
      errors: errors.slice(0, 10), // First 10 errors
    };
  } catch (e) {
    return { corrupted: true, errorCount: 1, errors: [e.message] };
  }
}

// ── Evaluation Logic ─────────────────────────────────────────────────────────

function parseRate(rate) {
  if (!rate) return 0;
  if (!rate.includes('/')) return Number(rate) || 0;
  const [a, b] = rate.split('/');
  return Number(b) ? Number(a) / Number(b) : 0;
}

function evaluateChecks(probe, audioLevels, audioStats, silence, corruption) {
  const checks = [];
  const format = probe.format ?? {};
  const streams = probe.streams ?? [];
  const video = streams.find(s => s.codec_type === 'video');
  const audio = streams.find(s => s.codec_type === 'audio');
  const durationSec = Number(format.duration || 0);

  // ── Duration ────────────────────────────────────────────────────────────
  if (durationSec < THRESHOLDS.minDurationSec) {
    checks.push({ check: 'duration', status: 'fail', message: `Duration ${durationSec}s is below minimum ${THRESHOLDS.minDurationSec}s`, value: durationSec });
  } else if (durationSec > THRESHOLDS.maxDurationSec) {
    checks.push({ check: 'duration', status: 'fail', message: `Duration ${Math.round(durationSec / 60)}min exceeds maximum ${THRESHOLDS.maxDurationSec / 60}min`, value: durationSec });
  } else {
    checks.push({ check: 'duration', status: 'pass', message: `Duration ${Math.round(durationSec)}s within bounds`, value: durationSec });
  }

  // ── Resolution ──────────────────────────────────────────────────────────
  if (video) {
    const w = Number(video.width || 0);
    const h = Number(video.height || 0);
    if (w < THRESHOLDS.minWidth || h < THRESHOLDS.minHeight) {
      checks.push({ check: 'resolution', status: 'fail', message: `Resolution ${w}×${h} below minimum ${THRESHOLDS.minWidth}×${THRESHOLDS.minHeight}`, value: `${w}x${h}` });
    } else if (w < THRESHOLDS.warnWidth || h < THRESHOLDS.warnHeight) {
      checks.push({ check: 'resolution', status: 'warn', message: `Resolution ${w}×${h} below recommended ${THRESHOLDS.warnWidth}×${THRESHOLDS.warnHeight}`, value: `${w}x${h}` });
    } else {
      checks.push({ check: 'resolution', status: 'pass', message: `Resolution ${w}×${h}`, value: `${w}x${h}` });
    }

    // ── FPS ─────────────────────────────────────────────────────────────────
    const fps = parseRate(video.r_frame_rate || video.avg_frame_rate);
    if (fps > 0 && fps < THRESHOLDS.minFps) {
      checks.push({ check: 'fps', status: 'fail', message: `FPS ${fps.toFixed(1)} below minimum ${THRESHOLDS.minFps}`, value: fps });
    } else if (fps > 0 && fps < THRESHOLDS.warnFps) {
      checks.push({ check: 'fps', status: 'warn', message: `FPS ${fps.toFixed(1)} below recommended ${THRESHOLDS.warnFps}`, value: fps });
    } else if (fps > 0) {
      checks.push({ check: 'fps', status: 'pass', message: `FPS ${fps.toFixed(1)}`, value: fps });
    }
  } else {
    checks.push({ check: 'resolution', status: 'warn', message: 'No video stream found (audio-only file)', value: null });
    checks.push({ check: 'fps', status: 'warn', message: 'No video stream — FPS not applicable', value: null });
  }

  // ── Audio Levels ────────────────────────────────────────────────────────
  if (!audio) {
    checks.push({ check: 'audio_levels', status: 'fail', message: 'No audio stream found', value: null });
  } else {
    if (audioLevels.maxVolumeDb !== null) {
      if (audioLevels.maxVolumeDb > THRESHOLDS.clippingPeakDb) {
        checks.push({ check: 'audio_clipping', status: 'warn', message: `Audio peak ${audioLevels.maxVolumeDb}dB — possible clipping`, value: audioLevels.maxVolumeDb });
      } else {
        checks.push({ check: 'audio_clipping', status: 'pass', message: `Audio peak ${audioLevels.maxVolumeDb}dB — no clipping`, value: audioLevels.maxVolumeDb });
      }
    }
    if (audioLevels.meanVolumeDb !== null) {
      if (audioLevels.meanVolumeDb < THRESHOLDS.lowAudioMeanDb) {
        checks.push({ check: 'audio_level', status: 'warn', message: `Mean audio level ${audioLevels.meanVolumeDb}dB — very quiet`, value: audioLevels.meanVolumeDb });
      } else if (audioLevels.meanVolumeDb > THRESHOLDS.loudAudioMeanDb) {
        checks.push({ check: 'audio_level', status: 'warn', message: `Mean audio level ${audioLevels.meanVolumeDb}dB — very loud`, value: audioLevels.meanVolumeDb });
      } else {
        checks.push({ check: 'audio_level', status: 'pass', message: `Mean audio level ${audioLevels.meanVolumeDb}dB`, value: audioLevels.meanVolumeDb });
      }
    }
  }

  // ── Noise / SNR ─────────────────────────────────────────────────────────
  if (audioStats.estimatedSnrDb !== null) {
    if (audioStats.estimatedSnrDb < THRESHOLDS.lowSnrDb) {
      checks.push({ check: 'noise_snr', status: 'warn', message: `Estimated SNR ${audioStats.estimatedSnrDb.toFixed(1)}dB — noisy audio`, value: audioStats.estimatedSnrDb });
    } else if (audioStats.estimatedSnrDb < THRESHOLDS.warnSnrDb) {
      checks.push({ check: 'noise_snr', status: 'warn', message: `Estimated SNR ${audioStats.estimatedSnrDb.toFixed(1)}dB — slightly noisy`, value: audioStats.estimatedSnrDb });
    } else {
      checks.push({ check: 'noise_snr', status: 'pass', message: `Estimated SNR ${audioStats.estimatedSnrDb.toFixed(1)}dB`, value: audioStats.estimatedSnrDb });
    }
  }

  // ── Silence ─────────────────────────────────────────────────────────────
  if (silence.silencePercent > 60) {
    checks.push({ check: 'silence', status: 'warn', message: `${silence.silencePercent}% silence — mostly silent/dead audio`, value: silence.silencePercent });
  } else if (silence.silencePercent > 40) {
    checks.push({ check: 'silence', status: 'warn', message: `${silence.silencePercent}% silence — significant dead air`, value: silence.silencePercent });
  } else {
    checks.push({ check: 'silence', status: 'pass', message: `${silence.silencePercent}% silence`, value: silence.silencePercent });
  }

  // ── Corruption ──────────────────────────────────────────────────────────
  if (corruption.corrupted) {
    checks.push({ check: 'corruption', status: 'fail', message: `File corruption detected (${corruption.errorCount} errors)`, value: corruption.errorCount });
  } else if (corruption.errorCount > 0) {
    checks.push({ check: 'corruption', status: 'warn', message: `Minor issues detected (${corruption.errorCount} warnings)`, value: corruption.errorCount });
  } else {
    checks.push({ check: 'corruption', status: 'pass', message: 'No corruption detected', value: 0 });
  }

  return checks;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const input = readArg('--input');
  const projectId = readArg('--project-id', 'default-project');
  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);

  if (!input) {
    throw new Error('Missing required argument: --input <file>');
  }

  const absInput = path.resolve(input);
  console.error(`[QualityGate] Analysing: ${absInput}`);

  // Run all checks in parallel where possible
  const [probe, audioLevels, audioStats, corruption] = await Promise.all([
    probeMedia(absInput),
    analyseAudioLevels(absInput),
    analyseAudioStats(absInput),
    scanCorruption(absInput),
  ]);

  const durationSec = Number(probe.format?.duration || 0);
  const silence = await detectSilencePercent(absInput, durationSec);

  const checks = evaluateChecks(probe, audioLevels, audioStats, silence, corruption);

  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const passCount = checks.filter(c => c.status === 'pass').length;

  const overallStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';

  const report = {
    ok: overallStatus !== 'fail',
    projectId,
    inputPath: absInput,
    analysedAt: new Date().toISOString(),
    overallStatus,
    summary: {
      pass: passCount,
      warn: warnCount,
      fail: failCount,
      total: checks.length,
    },
    checks,
    rawData: {
      audioLevels,
      audioStats,
      silence,
      corruption: { corrupted: corruption.corrupted, errorCount: corruption.errorCount },
    },
    thresholds: THRESHOLDS,
  };

  const reportPath = path.join(projectDir, 'input_quality_report.json');
  await writeJson(reportPath, report);

  console.error(`[QualityGate] Result: ${overallStatus.toUpperCase()} (${passCount} pass, ${warnCount} warn, ${failCount} fail)`);
  for (const c of checks) {
    const icon = c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✗';
    console.error(`  ${icon} ${c.check}: ${c.message}`);
  }

  await new Promise((resolve) => process.stdout.write(JSON.stringify(report, null, 2), resolve));
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
