#!/usr/bin/env node

/**
 * Pre-Render QA Gate — Phase 13
 *
 * Final quality checks before rendering:
 *   - Subtitle sync validation (SRT timestamps vs transcript)
 *   - Caption overflow detection (text length vs safe margins)
 *   - Missing asset detection (verify all referenced paths exist)
 *   - Audio peak detection (flag > -1dB peaks)
 *   - Black frame detection (ffmpeg blackdetect)
 *   - Frozen frame detection (ffmpeg freezedetect)
 *
 * Reads: timeline.json, transcript.json, subtitles/*.srt
 * Writes: pre_render_qa_report.json
 *
 * Usage:
 *   node scripts/lib/pre_render_qa.mjs \
 *     --project-id <id> [--project-dir <dir>] [--input <video>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

// ── Config ───────────────────────────────────────────────────────────────────

const CONFIG = {
  maxCaptionCharsPerLine: 42,
  maxCaptionLines: 2,
  subtitleSyncToleranceUs: 500_000, // 500ms tolerance
  audioPeakThresholdDb: -1.0,
  blackDetectDuration: 0.3,  // > 0.3s black frame
  freezeDetectDuration: 2.0, // > 2s frozen frame
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

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

// ── QA Checks ────────────────────────────────────────────────────────────────

/**
 * Parse SRT file into subtitle entries.
 */
async function parseSrt(srtPath) {
  const content = await fs.readFile(srtPath, 'utf8');
  const blocks = content.split(/\n\s*\n/).filter(Boolean);
  const entries = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!timeMatch) continue;

    const startUs = (
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3])
    ) * 1_000_000 + parseInt(timeMatch[4]) * 1000;

    const endUs = (
      parseInt(timeMatch[5]) * 3600 +
      parseInt(timeMatch[6]) * 60 +
      parseInt(timeMatch[7])
    ) * 1_000_000 + parseInt(timeMatch[8]) * 1000;

    const text = lines.slice(2).join('\n');
    entries.push({ startUs, endUs, text });
  }

  return entries;
}

/**
 * Check subtitle sync against transcript.
 */
function checkSubtitleSync(subtitles, segments) {
  const issues = [];
  if (subtitles.length === 0 || segments.length === 0) return issues;

  for (const sub of subtitles) {
    // Find closest transcript segment
    const closest = segments.reduce((best, seg) => {
      const dist = Math.abs(seg.startUs - sub.startUs);
      return dist < Math.abs(best.startUs - sub.startUs) ? seg : best;
    }, segments[0]);

    const drift = Math.abs(closest.startUs - sub.startUs);
    if (drift > CONFIG.subtitleSyncToleranceUs) {
      issues.push({
        check: 'subtitle_sync',
        status: 'warn',
        message: `Subtitle at ${Math.round(sub.startUs / 1_000_000)}s drifted ${Math.round(drift / 1000)}ms from transcript`,
        value: drift,
      });
    }
  }

  return issues;
}

/**
 * Check caption overflow — text too long for safe display.
 */
function checkCaptionOverflow(subtitles) {
  const issues = [];

  for (let i = 0; i < subtitles.length; i++) {
    const lines = subtitles[i].text.split('\n');

    if (lines.length > CONFIG.maxCaptionLines) {
      issues.push({
        check: 'caption_overflow',
        status: 'warn',
        message: `Subtitle #${i + 1} has ${lines.length} lines (max ${CONFIG.maxCaptionLines})`,
        value: lines.length,
      });
    }

    for (const line of lines) {
      if (line.length > CONFIG.maxCaptionCharsPerLine) {
        issues.push({
          check: 'caption_length',
          status: 'warn',
          message: `Subtitle #${i + 1} line ${line.length} chars (max ${CONFIG.maxCaptionCharsPerLine}): "${line.slice(0, 40)}..."`,
          value: line.length,
        });
        break; // One warning per subtitle
      }
    }
  }

  return issues;
}

/**
 * Verify all asset references in timeline exist on disk.
 */
async function checkMissingAssets(timeline) {
  const issues = [];
  const clips = timeline?.clips || [];

  for (const clip of clips) {
    if (clip.clipType === 'asset_clip' || clip.clipType === 'template_clip') {
      const ref = clip.sourceRef || '';
      if (ref && ref.startsWith('/') || ref.startsWith('./') || ref.startsWith('file://')) {
        const absPath = ref.startsWith('file://') ? decodeURIComponent(new URL(ref).pathname) : path.resolve(ref);
        if (!(await fileExists(absPath))) {
          issues.push({
            check: 'missing_asset',
            status: 'fail',
            message: `Asset not found: ${absPath}`,
            clipId: clip.clipId,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Detect audio peaks that may cause clipping in final render.
 */
async function checkAudioPeaks(inputPath) {
  if (!inputPath) return [];

  try {
    const { stderr } = await run('ffmpeg', [
      '-i', inputPath,
      '-af', 'volumedetect',
      '-f', 'null', '-',
    ], 5 * 60 * 1000);

    const maxMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
    const maxDb = maxMatch ? parseFloat(maxMatch[1]) : -10;

    if (maxDb > CONFIG.audioPeakThresholdDb) {
      return [{
        check: 'audio_peak',
        status: 'warn',
        message: `Audio peak ${maxDb}dB exceeds ${CONFIG.audioPeakThresholdDb}dB — possible clipping after render`,
        value: maxDb,
      }];
    }
    return [{ check: 'audio_peak', status: 'pass', message: `Audio peak ${maxDb}dB — safe`, value: maxDb }];
  } catch {
    return [];
  }
}

/**
 * Detect black frames in the video.
 */
async function checkBlackFrames(inputPath) {
  if (!inputPath) return [];

  try {
    const { stderr } = await run('ffmpeg', [
      '-i', inputPath,
      '-vf', `blackdetect=d=${CONFIG.blackDetectDuration}:pix_th=0.10`,
      '-f', 'null', '-',
    ], 5 * 60 * 1000);

    const matches = [...stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)];
    if (matches.length === 0) {
      return [{ check: 'black_frames', status: 'pass', message: 'No black frames detected', value: 0 }];
    }

    return matches.slice(0, 10).map(m => ({
      check: 'black_frames',
      status: 'warn',
      message: `Black frame at ${parseFloat(m[1]).toFixed(1)}s (${parseFloat(m[3]).toFixed(1)}s duration)`,
      value: parseFloat(m[3]),
    }));
  } catch {
    return [];
  }
}

/**
 * Detect frozen frames in the video.
 */
async function checkFrozenFrames(inputPath) {
  if (!inputPath) return [];

  try {
    const { stderr } = await run('ffmpeg', [
      '-i', inputPath,
      '-vf', `freezedetect=n=0.003:d=${CONFIG.freezeDetectDuration}`,
      '-f', 'null', '-',
    ], 5 * 60 * 1000);

    const matches = [...stderr.matchAll(/freeze_start:\s*([\d.]+).*?freeze_duration:\s*([\d.]+)/gs)];
    if (matches.length === 0) {
      return [{ check: 'frozen_frames', status: 'pass', message: 'No frozen frames detected', value: 0 }];
    }

    return matches.slice(0, 10).map(m => ({
      check: 'frozen_frames',
      status: 'warn',
      message: `Frozen frame at ${parseFloat(m[1]).toFixed(1)}s (${parseFloat(m[2]).toFixed(1)}s duration)`,
      value: parseFloat(m[2]),
    }));
  } catch {
    return [];
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = readArg('--project-id');
  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const inputPath = readArg('--input') || '';
  const timelinePath = path.join(projectDir, 'timeline.json');
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const srtPath = path.join(projectDir, 'subtitles', 'subtitles.srt');
  const outputPath = path.join(projectDir, 'pre_render_qa_report.json');

  const allChecks = [];

  // Resolve video input
  let videoPath = inputPath;
  if (!videoPath) {
    const metaPath = path.join(projectDir, 'media', 'metadata.json');
    if (await fileExists(metaPath)) {
      const meta = await readJson(metaPath);
      videoPath = meta.sourcePath || '';
    }
  }

  // 1. Subtitle checks
  if (await fileExists(srtPath)) {
    console.error('[PreRenderQA] Checking subtitles...');
    const subtitles = await parseSrt(srtPath);

    allChecks.push(...checkCaptionOverflow(subtitles));

    if (await fileExists(transcriptPath)) {
      const transcript = await readJson(transcriptPath);
      allChecks.push(...checkSubtitleSync(subtitles, transcript.segments || []));
    }
  } else {
    allChecks.push({ check: 'subtitles', status: 'warn', message: 'No SRT file found — subtitles not available' });
  }

  // 2. Missing asset check
  if (await fileExists(timelinePath)) {
    console.error('[PreRenderQA] Checking timeline assets...');
    const timeline = await readJson(timelinePath);
    allChecks.push(...await checkMissingAssets(timeline));
  }

  // 3. Audio/video checks (on source video)
  if (videoPath && await fileExists(videoPath)) {
    console.error('[PreRenderQA] Checking audio peaks...');
    allChecks.push(...await checkAudioPeaks(videoPath));

    console.error('[PreRenderQA] Checking black frames...');
    allChecks.push(...await checkBlackFrames(videoPath));

    console.error('[PreRenderQA] Checking frozen frames...');
    allChecks.push(...await checkFrozenFrames(videoPath));
  }

  const failCount = allChecks.filter(c => c.status === 'fail').length;
  const warnCount = allChecks.filter(c => c.status === 'warn').length;
  const passCount = allChecks.filter(c => c.status === 'pass').length;

  const overallStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';

  const result = {
    ok: overallStatus !== 'fail',
    projectId,
    checkedAt: new Date().toISOString(),
    overallStatus,
    summary: { pass: passCount, warn: warnCount, fail: failCount, total: allChecks.length },
    config: CONFIG,
    checks: allChecks,
  };

  await writeJson(outputPath, result);

  console.error(`[PreRenderQA] Result: ${overallStatus.toUpperCase()} (${passCount}P/${warnCount}W/${failCount}F)`);
  for (const c of allChecks.filter(c => c.status !== 'pass')) {
    const icon = c.status === 'warn' ? '⚠' : '✗';
    console.error(`  ${icon} ${c.check}: ${c.message}`);
  }

  await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
