#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { createStageTracker, recordProjectTelemetry } from './lib/pipeline_telemetry.mjs';
import { hwDecodeArgs, hwEncodeVideoArgs, hwEncodeAudioArgs } from './lib/metal_accel.mjs';

const execFile = promisify(execFileCb);

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function run(command, args = [], timeout = 20 * 60 * 1000) {
  const { stdout, stderr } = await execFile(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 12,
  });
  return {
    stdout: (stdout ?? '').toString().trim(),
    stderr: (stderr ?? '').toString().trim(),
  };
}

async function commandExists(command) {
  try {
    const out = await run('which', [command], 8000);
    return Boolean(out.stdout);
  } catch {
    return false;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function readJsonIfExists(filePath) {
  if (!(await exists(filePath))) {
    return null;
  }
  return readJson(filePath);
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function appendRenderHistory(projectDir, record) {
  const historyPath = path.join(projectDir, 'renders', 'history.json');
  const current = await readJsonIfExists(historyPath, []);
  const list = Array.isArray(current) ? current : [];
  list.unshift(record);
  await writeJson(historyPath, list.slice(0, 200));
  return historyPath;
}

function nowIso() {
  return new Date().toISOString();
}

function safeQuality(input) {
  const normalized = String(input || '').trim().toLowerCase();
  if (normalized === 'draft' || normalized === 'balanced' || normalized === 'quality') {
    return normalized;
  }
  return 'balanced';
}

function safeInteger(input, fallback, minimum = 0, maximum = 20) {
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, Math.round(numeric)));
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(label, maxRetries, retryDelayMs, runAction, onRetry = null) {
  const totalAttempts = Math.max(1, maxRetries + 1);
  let lastError = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      const result = await runAction(attempt, totalAttempts);
      return {
        result,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= totalAttempts) {
        break;
      }
      if (onRetry) {
        onRetry({
          label,
          attempt,
          totalAttempts,
          error: String(error?.message || error),
        });
      }
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

function qualityProfile(quality) {
  if (quality === 'draft') {
    return { preset: 'veryfast', crf: 30, quality: 'fast' };
  }
  if (quality === 'quality') {
    return { preset: 'medium', crf: 18, quality: 'high' };
  }
  return { preset: 'fast', crf: 23, quality: 'balanced' };
}

function usToSec(us) {
  return (Math.max(0, Number(us || 0)) / 1_000_000).toFixed(6);
}

function normalizeOutputName(name, projectId) {
  const fallback = `lapaas-${projectId}-${Date.now()}.mp4`;
  const raw = String(name || '').trim();
  if (!raw) return fallback;
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.endsWith('.mp4') ? cleaned : `${cleaned}.mp4`;
}

function collectSourceClips(timeline) {
  const clips = Array.isArray(timeline?.clips) ? timeline.clips : [];
  const sourceClips = clips
    .filter((clip) => clip && clip.clipType === 'source_clip')
    .map((clip, index) => ({
      id: String(clip.clipId || `source-${index + 1}`),
      sourceRef: String(clip.sourceRef || ''),
      sourceStartUs: Number(clip.sourceStartUs || 0),
      sourceEndUs: Number(clip.sourceEndUs || 0),
      startUs: Number(clip.startUs || 0),
      endUs: Number(clip.endUs || 0),
    }))
    .filter((clip) => clip.sourceEndUs > clip.sourceStartUs)
    .sort((a, b) => a.startUs - b.startUs);

  if (sourceClips.length > 0) {
    return mergeAdjacentClips(sourceClips);
  }

  const durationUs = Number(timeline?.durationUs || 0);
  if (durationUs <= 0) {
    return [];
  }

  return [
    {
      id: 'source-1',
      sourceRef: 'source-video',
      sourceStartUs: 0,
      sourceEndUs: durationUs,
      startUs: 0,
      endUs: durationUs,
    },
  ];
}

/**
 * Merge adjacent source clips from the same sourceRef into larger segments
 * to dramatically reduce the number of ffmpeg invocations.
 * Clips within MERGE_GAP_US of each other are combined.
 */
function mergeAdjacentClips(sortedClips, mergeGapUs = 2_000_000) {
  if (sortedClips.length <= 1) return sortedClips;

  const merged = [];
  let current = { ...sortedClips[0] };

  for (let i = 1; i < sortedClips.length; i++) {
    const next = sortedClips[i];
    const sameSource = current.sourceRef === next.sourceRef || !next.sourceRef || !current.sourceRef;
    const gap = next.sourceStartUs - current.sourceEndUs;

    if (sameSource && gap <= mergeGapUs) {
      // Extend current segment to include next clip
      current.sourceEndUs = Math.max(current.sourceEndUs, next.sourceEndUs);
      current.endUs = Math.max(current.endUs, next.endUs);
      current.id = `merged-${merged.length + 1}`;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  if (merged.length < sortedClips.length) {
    process.stderr.write(
      `[render] Merged ${sortedClips.length} source clips into ${merged.length} segments (${mergeGapUs / 1e6}s gap threshold)\n`,
    );
  }

  return merged;
}

function collectOverlayClips(timeline) {
  const clips = Array.isArray(timeline?.clips) ? timeline.clips : [];
  return clips
    .filter((clip) => clip && (clip.clipType === 'asset_clip' || clip.clipType === 'template_clip'))
    .map((clip, index) => ({
      id: String(clip.clipId || `overlay-${index + 1}`),
      templateId: String(clip.templateId || ''),
      clipType: String(clip.clipType || ''),
      sourceRef: String(clip.sourceRef || ''),
      startUs: Number(clip.startUs || 0),
      endUs: Number(clip.endUs || 0),
      kind: String(clip?.meta?.kind || ''),
      content: clip.content || {},
      style: clip.style || {},
    }))
    .filter((clip) => clip.endUs > clip.startUs)
    .sort((a, b) => a.startUs - b.startUs);
}

function isProbablePath(input) {
  if (!input) return false;
  return input.startsWith('/') || input.startsWith('./') || input.startsWith('../') || input.startsWith('file://');
}

function decodeFileUrl(value) {
  if (!value.startsWith('file://')) {
    return value;
  }
  try {
    return decodeURIComponent(new URL(value).pathname);
  } catch {
    return value;
  }
}

function isImagePath(filePath, kind = '') {
  if (String(kind || '').toLowerCase() === 'image') {
    return true;
  }
  const ext = path.extname(filePath).toLowerCase();
  return (
    ext === '.png' ||
    ext === '.jpg' ||
    ext === '.jpeg' ||
    ext === '.webp' ||
    ext === '.bmp' ||
    ext === '.gif' ||
    ext === '.ppm' ||
    ext === '.ppm' ||
    ext === '.pgm'
  );
}

function isAudioPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    ext === '.mp3' ||
    ext === '.wav' ||
    ext === '.aac' ||
    ext === '.m4a' ||
    ext === '.flac' ||
    ext === '.ogg' ||
    ext === '.wma' ||
    ext === '.aiff'
  );
}

async function resolveDefaultSourcePath(projectDir) {
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const transcript = await readJsonIfExists(transcriptPath);
  if (transcript?.source?.path && (await exists(transcript.source.path))) {
    return path.resolve(transcript.source.path);
  }

  const ingestPath = path.join(projectDir, 'media', 'metadata.json');
  const ingest = await readJsonIfExists(ingestPath);
  if (ingest?.sourcePath && (await exists(ingest.sourcePath))) {
    return path.resolve(ingest.sourcePath);
  }

  // Fallback 1: scan state.json for media item paths
  const statePath = path.join(projectDir, 'state.json');
  const state = await readJsonIfExists(statePath);
  if (state?.media && Array.isArray(state.media)) {
    for (const m of state.media) {
      const mpath = m.path || '';
      if (mpath && (await exists(mpath))) {
        return path.resolve(mpath);
      }
    }
  }

  // Fallback 2: scan project uploads folder for video/audio files
  const uploadsDir = path.join(projectDir, 'uploads');
  const found = await scanForMediaFile(uploadsDir);
  if (found) return found;

  // Fallback 3: scan global uploads folder
  const globalUploads = path.join(projectDir, '..', '..', 'desktop', 'data', 'uploads');
  const globalFound = await scanForMediaFile(globalUploads);
  if (globalFound) return globalFound;

  // Fallback 4: check rootDir/desktop/data/uploads
  const rootUploads = path.resolve('desktop', 'data', 'uploads');
  const rootFound = await scanForMediaFile(rootUploads);
  if (rootFound) return rootFound;

  return '';
}

async function scanForMediaFile(dir) {
  try {
    const files = await fs.readdir(dir);
    const videoExts = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'];
    const audioExts = ['.m4a', '.mp3', '.wav', '.aac', '.flac', '.ogg'];
    // Prefer video files first
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (videoExts.includes(ext)) {
        const full = path.join(dir, f);
        if (await exists(full)) return path.resolve(full);
      }
    }
    // Then audio
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (audioExts.includes(ext)) {
        const full = path.join(dir, f);
        if (await exists(full)) return path.resolve(full);
      }
    }
  } catch { /* dir doesn't exist */ }
  return '';
}

async function resolveClipSourcePath(clip, defaultSourcePath) {
  const ref = decodeFileUrl(String(clip.sourceRef || '').trim());
  if (isProbablePath(ref)) {
    const abs = path.resolve(ref);
    if (await exists(abs)) {
      return abs;
    }
  }
  return defaultSourcePath;
}

async function resolveOverlaySourcePath(clip) {
  const ref = decodeFileUrl(String(clip.sourceRef || '').trim());
  if (!isProbablePath(ref)) {
    return '';
  }
  const abs = path.resolve(ref);
  if (await exists(abs)) {
    return abs;
  }
  return '';
}

function concatPathLine(filePath) {
  return `file '${filePath.replace(/'/g, "'\\''")}'`;
}

function escapeSubtitlePath(filePath) {
  return path
    .resolve(filePath)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

async function renderSegment({ sourcePath, startUs, endUs, outputPath, profile, seamFadeMs = 50, paddingMs = 0, audioLeadMs = 0, audioLagMs = 0 }) {
  // Detect audio-only by extension first, then probe for video stream as fallback
  let isAudio = isAudioPath(sourcePath);
  if (!isAudio) {
    try {
      const { stdout: probeOut } = await execFile('ffprobe', [
        '-v', 'quiet', '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', sourcePath,
      ], { timeout: 10000 });
      if (!probeOut || !probeOut.toString().trim()) {
        isAudio = true; // No video stream found
        process.stderr.write(`[Render] ${path.basename(sourcePath)} has no video stream — treating as audio-only\n`);
      }
    } catch {
      // ffprobe failed — check if file has video by trying a different approach
    }
  }
  const vEnc = await hwEncodeVideoArgs({ quality: profile.quality || 'balanced' });
  const aEnc = await hwEncodeAudioArgs({ bitrate: '160k' });
  const decArgs = await hwDecodeArgs();

  // Apply padding: expand source range slightly for smoother cuts
  const paddingUs = paddingMs * 1000;
  const adjStartUs = Math.max(0, startUs - paddingUs);
  const adjEndUs = endUs + paddingUs;

  // J-cut / L-cut: audio range differs from video range
  // J-cut (audioLeadMs > 0): audio starts earlier → next segment's audio leads its video
  // L-cut (audioLagMs > 0): audio extends beyond video → current segment's audio trails
  const audioLeadUs = audioLeadMs * 1000;
  const audioLagUs = audioLagMs * 1000;
  const audioStartUs = Math.max(0, adjStartUs - audioLeadUs);
  const audioEndUs = adjEndUs + audioLagUs;
  const hasJLCut = audioLeadMs > 0 || audioLagMs > 0;

  // Build audio fade filter for smooth seam transitions
  const fadeSec = Math.max(0.02, seamFadeMs / 1000);
  const audioDurationSec = (audioEndUs - audioStartUs) / 1_000_000;
  const fadeOutStart = Math.max(0, audioDurationSec - fadeSec);
  const afadeFilter = `afade=t=in:st=0:d=${fadeSec},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeSec}`;

  if (isAudio) {
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:r=30',
      '-ss', usToSec(audioStartUs), '-to', usToSec(audioEndUs), '-i', sourcePath,
      '-map', '0:v', '-map', '1:a',
      '-af', afadeFilter,
      '-shortest',
      ...vEnc,
      ...aEnc,
      '-movflags', '+faststart',
      outputPath,
    ]);
  } else if (hasJLCut) {
    // J/L-cut: use filter_complex to apply different trim ranges for video vs audio
    const vStartSec = usToSec(adjStartUs);
    const vEndSec = usToSec(adjEndUs);
    const aStartSec = usToSec(audioStartUs);
    const aEndSec = usToSec(audioEndUs);
    const filterComplex = [
      `[0:v]trim=start=${vStartSec}:end=${vEndSec},setpts=PTS-STARTPTS[v]`,
      `[0:a]atrim=start=${aStartSec}:end=${aEndSec},asetpts=PTS-STARTPTS,${afadeFilter}[a]`,
    ].join(';');
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      ...decArgs,
      '-i', sourcePath,
      '-filter_complex', filterComplex,
      '-map', '[v]', '-map', '[a]',
      '-shortest',
      ...vEnc,
      ...aEnc,
      '-movflags', '+faststart',
      outputPath,
    ]);
  } else {
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      ...decArgs,
      '-ss', usToSec(adjStartUs),
      '-to', usToSec(adjEndUs),
      '-i', sourcePath,
      '-map', '0:v:0',
      '-map', '0:a?',
      '-af', afadeFilter,
      ...vEnc,
      ...aEnc,
      '-movflags', '+faststart',
      outputPath,
    ]);
  }
}

/**
 * Render a low-res preview for a single chunk (480p, fast preset).
 * Used by chunk QC scoring to visually validate edit plans.
 * @param {object} opts
 * @param {string} opts.sourcePath - Path to source video/audio
 * @param {number} opts.startUs - Chunk start in microseconds
 * @param {number} opts.endUs - Chunk end in microseconds
 * @param {string} opts.outputPath - Where to write the preview MP4
 * @param {number} [opts.seamFadeMs=50] - Audio fade duration
 */
async function renderChunkPreview({ sourcePath, startUs, endUs, outputPath, seamFadeMs = 50 }) {
  let isAudio = isAudioPath(sourcePath);
  if (!isAudio) {
    try {
      const { stdout: probeOut } = await execFile('ffprobe', [
        '-v', 'quiet', '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', sourcePath,
      ], { timeout: 10000 });
      if (!probeOut || !probeOut.toString().trim()) isAudio = true;
    } catch { /* fall through */ }
  }
  const fadeSec = Math.max(0.02, seamFadeMs / 1000);
  const segDurationSec = (endUs - startUs) / 1_000_000;
  const fadeOutStart = Math.max(0, segDurationSec - fadeSec);
  const afadeFilter = `afade=t=in:st=0:d=${fadeSec},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeSec}`;

  if (isAudio) {
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=black:s=854x480:r=24',
      '-ss', usToSec(startUs), '-to', usToSec(endUs), '-i', sourcePath,
      '-map', '0:v', '-map', '1:a',
      '-af', afadeFilter,
      '-shortest',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
      '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart',
      outputPath,
    ]);
  } else {
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-ss', usToSec(startUs), '-to', usToSec(endUs),
      '-i', sourcePath,
      '-vf', 'scale=-2:480',
      '-af', afadeFilter,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
      '-c:a', 'aac', '-b:a', '96k',
      '-r', '24',
      '-movflags', '+faststart',
      outputPath,
    ]);
  }
}

async function concatSegments(listPath, outputPath, profile) {
  try {
    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      outputPath,
    ]);
    return;
  } catch {
    const vEnc = await hwEncodeVideoArgs({ quality: profile.quality || 'balanced' });
    const aEnc = await hwEncodeAudioArgs({ bitrate: '160k' });
    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      ...vEnc,
      ...aEnc,
      '-movflags',
      '+faststart',
      outputPath,
    ]);
  }
}

async function preRenderTemplates(timeline, tempDir, profile) {
  const overlayClips = collectOverlayClips(timeline);
  const templateClips = overlayClips.filter(c => c.clipType === 'template_clip');
  const results = {};

  if (templateClips.length === 0) {
    process.stderr.write(`[Render:templates] No template clips to pre-render\n`);
    return results;
  }

  process.stderr.write(`[Render:templates] Pre-rendering ${templateClips.length} templates...\n`);

  for (const clip of templateClips) {
    const compositionId = `${clip.templateId}-landscape`; // Default to landscape for now
    const outputPath = path.join(tempDir, `template-${clip.id}.mov`);

    // Construct props from clip metadata/content
    const props = {
      ...clip.content,
      ...clip.style
    };

    process.stderr.write(`[Render:templates] Rendering ${clip.id} (${compositionId}) with props: ${JSON.stringify(props).slice(0,200)}\n`);

    try {
      // Use npx remotion render with prores for alpha channel support
      await run('npx', [
        'remotion', 'render',
        'src/index.ts',
        compositionId,
        outputPath,
        '--props', JSON.stringify(props),
        '--codec', 'prores',
        '--concurrency', String(Math.max(2, Math.min(os.cpus().length, 8))),
        '--quiet'
      ], 10 * 60 * 1000); // 10 min timeout per template

      results[clip.id] = outputPath;
      process.stderr.write(`[Render:templates] ✓ ${clip.id} rendered to ${outputPath}\n`);
    } catch (e) {
      process.stderr.write(`[Render:templates] ✗ ${clip.id} FAILED: ${e.message.split('\n')[0]}\n`);
    }
  }
  process.stderr.write(`[Render:templates] ${Object.keys(results).length}/${templateClips.length} templates rendered successfully\n`);
  return results;
}

async function renderWithOverlayCompositor({
  stitchedPath,
  timeline,
  outputPath,
  profile,
  templatePaths = {} // Map of clipId -> renderedVideoPath
}) {
  const overlayClips = collectOverlayClips(timeline);
  const warnings = [];

  process.stderr.write(`[Render:overlay] Found ${overlayClips.length} overlay clips (${overlayClips.filter(c=>c.clipType==='template_clip').length} templates, ${overlayClips.filter(c=>c.clipType==='asset_clip').length} assets)\n`);

  if (overlayClips.length === 0) {
    process.stderr.write(`[Render:overlay] No overlay clips — copying stitched as final\n`);
    await fs.copyFile(stitchedPath, outputPath);
    return {
      appliedCount: 0,
      warnings,
    };
  }

  const resolved = [];
  for (const clip of overlayClips) {
    let overlayPath = '';

    if (clip.clipType === 'template_clip') {
      overlayPath = templatePaths[clip.id];
      if (!overlayPath) {
        const msg = `Skipped template clip ${clip.id} (${clip.templateId}): pre-render failed or missing.`;
        warnings.push(msg);
        process.stderr.write(`[Render:overlay] ${msg}\n`);
        continue;
      }
    } else {
      overlayPath = await resolveOverlaySourcePath(clip);
      if (!overlayPath) {
        process.stderr.write(`[Render:overlay] Asset ${clip.id}: sourceRef='${clip.sourceRef}' — resolveOverlaySourcePath returned empty\n`);
      }
    }

    if (!overlayPath) {
      const msg = `Skipped overlay clip ${clip.id}: source path not available (sourceRef='${clip.sourceRef}').`;
      warnings.push(msg);
      process.stderr.write(`[Render:overlay] ${msg}\n`);
      continue;
    }

    process.stderr.write(`[Render:overlay] Resolved ${clip.clipType} ${clip.id}: ${overlayPath}\n`);
    resolved.push({
      ...clip,
      overlayPath,
      isImage: isImagePath(overlayPath, clip.kind),
    });
  }

  process.stderr.write(`[Render:overlay] ${resolved.length}/${overlayClips.length} overlays resolved for compositing\n`);

  if (resolved.length === 0) {
    process.stderr.write(`[Render:overlay] All overlays failed to resolve — copying stitched as final\n`);
    await fs.copyFile(stitchedPath, outputPath);
    return {
      appliedCount: 0,
      warnings,
    };
  }

  // Apply overlays one at a time in sequential ffmpeg passes.
  // Each pass: take current video, overlay one image, output next intermediate.
  const tempDir = path.dirname(outputPath);
  let currentInput = stitchedPath;
  let appliedCount = 0;
  const intermediates = []; // track files to clean up

  for (let index = 0; index < resolved.length; index += 1) {
    const clip = resolved[index];
    const start = usToSec(clip.startUs);
    const end = usToSec(clip.endUs);
    const isLast = index === resolved.length - 1;
    const stepOutput = isLast ? outputPath : path.join(tempDir, `overlay-step-${index}.mp4`);

    process.stderr.write(`[Render:overlay] Applying ${clip.clipType} ${clip.id} (${index + 1}/${resolved.length}): ${path.basename(clip.overlayPath)} @ ${start}s-${end}s\n`);

    try {
      const vEnc = await hwEncodeVideoArgs({ quality: profile.quality || 'balanced' });
      // Use simple scale for overlay image to 80% of 480 height (the stitched is 480p).
      // Ensure even dimensions with ceil(x/2)*2 trick.
      // For images: scale to 80% of base height, centered.
      // For video overlays: scale to match base.
      const filter = clip.isImage
        ? `[1:v]scale=ceil(iw*0.8/2)*2:ceil(ih*0.8/2)*2[ov];[0:v][ov]overlay=x=(W-w)/2:y=(H-h)/2:enable='between(t,${start},${end})'`
        : `[1:v]scale=ceil(iw/2)*2:ceil(ih/2)*2[ov];[0:v][ov]overlay=x=(W-w)/2:y=(H-h)/2:eof_action=pass:enable='between(t,${start},${end})'`;

      await run('ffmpeg', [
        '-y', '-loglevel', 'warning',
        '-i', currentInput,
        '-i', clip.overlayPath,
        '-filter_complex', filter,
        '-map', '0:a?',
        ...vEnc,
        '-c:a', 'copy',
        '-movflags', '+faststart',
        stepOutput,
      ]);

      // Only mark previous intermediate for cleanup after success
      if (currentInput !== stitchedPath) {
        intermediates.push(currentInput);
      }
      currentInput = stepOutput;
      appliedCount += 1;
      process.stderr.write(`[Render:overlay] ✓ ${clip.id} applied\n`);
    } catch (e) {
      const errLine = e.message.split('\n').find(l => l.includes('Error') || l.includes('error')) || e.message.split('\n')[0];
      process.stderr.write(`[Render:overlay] ✗ ${clip.id} failed: ${errLine}\n`);
      warnings.push(`Overlay ${clip.id} failed: ${errLine}`);
      // currentInput stays as is — next overlay builds on the last successful output
    }
  }

  // Clean up intermediates
  for (const f of intermediates) {
    await fs.unlink(f).catch(() => {});
  }

  // If we applied nothing, copy stitched as final
  if (appliedCount === 0) {
    process.stderr.write(`[Render:overlay] No overlays applied successfully — copying stitched\n`);
    await fs.copyFile(stitchedPath, outputPath);
  } else if (currentInput !== outputPath) {
    // Final output is at currentInput, move it to outputPath
    await fs.rename(currentInput, outputPath).catch(async () => {
      await fs.copyFile(currentInput, outputPath);
      await fs.unlink(currentInput).catch(() => {});
    });
  }

  return {
    appliedCount,
    warnings,
  };
}

async function main() {
  const projectId = readArg('--project-id');
  const outputName = readArg('--output-name');
  const quality = safeQuality(readArg('--quality', 'balanced'));
  const burnSubtitles = readArg('--burn-subtitles', 'false') === 'true';
  const captionsVariants = readArg('--captions-variants', 'false') === 'true'; // Export both captioned + uncaptioned
  const watermarkPath = readArg('--watermark', ''); // Path to watermark image (PNG with transparency)
  const watermarkPos = readArg('--watermark-position', 'bottom-right'); // top-left, top-right, bottom-left, bottom-right
  const watermarkOpacity = parseFloat(readArg('--watermark-opacity', '0.6'));
  const exportFormats = readArg('--formats', '').split(',').map(f => f.trim()).filter(Boolean); // e.g. "vertical,shorts"
  const maxRetries = safeInteger(
    readArg('--max-retries', process.env.LAPAAS_RENDER_MAX_RETRIES ?? '1'),
    1,
    0,
    10,
  );
  const retryDelayMs = safeInteger(
    readArg('--retry-delay-ms', process.env.LAPAAS_RENDER_RETRY_DELAY_MS ?? '1200'),
    1200,
    100,
    15000,
  );

  if (!projectId) {
    throw new Error('Missing required argument: --project-id');
  }

  const hasFfmpeg = await commandExists('ffmpeg');
  if (!hasFfmpeg) {
    throw new Error('ffmpeg is required for rendering but was not found in PATH.');
  }

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const timelinePath = path.join(projectDir, 'timeline.json');
  const jobPath = path.join(projectDir, 'render-job.json');
  const renderDir = path.join(projectDir, 'renders');
  const tempDir = path.join(renderDir, `tmp-${Date.now()}`);
  const subtitlesPath = path.join(projectDir, 'subtitles', 'subtitles.srt');
  const tracker = createStageTracker();
  const warnings = [];
  const retryEvents = [];
  const stageAttempts = {};
  const startedAt = nowIso();

  const onRetry = (event) => {
    retryEvents.push({
      ...event,
      timestamp: nowIso(),
    });
    warnings.push(
      `[retry] ${event.label} failed on attempt ${event.attempt}/${event.totalAttempts}: ${event.error}`,
    );
  };

  try {
    if (!(await exists(timelinePath))) {
      throw new Error(`Timeline not found for project ${projectId}. Run Start Editing and Edit Now first.`);
    }

    await fs.mkdir(renderDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });

    await writeJson(jobPath, {
      projectId,
      status: 'RENDER_IN_PROGRESS',
      startedAt,
      quality,
      burnSubtitles,
      retry: {
        maxRetries,
        retryDelayMs,
      },
    });

    const setup = await tracker.run('render-setup', async () => {
      const timeline = await readJson(timelinePath);
      const sourceClips = collectSourceClips(timeline);
      const allClips = Array.isArray(timeline?.clips) ? timeline.clips : [];
      const clipsByType = {};
      for (const c of allClips) { clipsByType[c.clipType] = (clipsByType[c.clipType] || 0) + 1; }
      process.stderr.write(`[Render:setup] Timeline loaded: ${allClips.length} clips (${JSON.stringify(clipsByType)}), durationUs=${timeline.durationUs}, fps=${timeline.fps}\n`);
      process.stderr.write(`[Render:setup] Source clips after merge: ${sourceClips.length}\n`);
      if (sourceClips.length === 0) {
        throw new Error('No source clips available in timeline for rendering.');
      }
      const profile = qualityProfile(quality);
      const defaultSourcePath = await resolveDefaultSourcePath(projectDir);
      process.stderr.write(`[Render:setup] Default source path: ${defaultSourcePath || 'NOT FOUND'}\n`);
      if (!defaultSourcePath) {
        throw new Error(
          'Could not resolve source video path. Ensure transcript.json or media/metadata.json includes source path.',
        );
      }
      return {
        timeline,
        sourceClips,
        profile,
        defaultSourcePath,
      };
    });

    const { timeline, sourceClips, profile, defaultSourcePath } = setup;
    const segmentPaths = [];

    // Load seam quality report for per-cut fade/padding recommendations
    const seamReportPath = path.join(projectDir, 'seam_quality_report.json');
    let seamLookup = {};
    try {
      if (await exists(seamReportPath)) {
        const seamReport = await readJson(seamReportPath);
        for (const seam of (seamReport.seams || [])) {
          // Key by cutEndUs — the point where the next kept segment starts
          seamLookup[seam.cutEndUs] = {
            fadeMs: seam.recommendedFadeMs || 50,
            paddingMs: seam.recommendedPaddingMs || 0,
            audioLeadMs: seam.audioLeadMs || 0,
            audioLagMs: seam.audioLagMs || 0,
          };
        }
        console.error(`[Render] Loaded ${Object.keys(seamLookup).length} seam quality recommendations`);
      }
    } catch { /* no seam report — use defaults */ }

    await tracker.run('segment-render', async () => {
      for (let index = 0; index < sourceClips.length; index += 1) {
        const clip = sourceClips[index];
        const clipSourcePath = await resolveClipSourcePath(clip, defaultSourcePath);
        if (!clipSourcePath) {
          warnings.push(`Skipped clip ${clip.id}: source path unavailable.`);
          continue;
        }

        // Look up per-cut seam recommendations (match by segment start time)
        const seamRec = seamLookup[clip.sourceStartUs] || {};
        const seamFadeMs = seamRec.fadeMs || 50;
        const paddingMs = seamRec.paddingMs || 0;
        const audioLeadMs = seamRec.audioLeadMs || 0;
        const audioLagMs = seamRec.audioLagMs || 0;

        const segmentPath = path.join(tempDir, `segment-${String(index + 1).padStart(3, '0')}.mp4`);
        const retryResult = await withRetries(
          `segment:${clip.id}`,
          maxRetries,
          retryDelayMs,
          () =>
            renderSegment({
              sourcePath: clipSourcePath,
              startUs: clip.sourceStartUs,
              endUs: clip.sourceEndUs,
              outputPath: segmentPath,
              profile,
              seamFadeMs,
              paddingMs,
              audioLeadMs,
              audioLagMs,
            }),
          onRetry,
        );
        stageAttempts[`segment:${clip.id}`] = retryResult.attempts;
        segmentPaths.push(segmentPath);
      }
    });

    if (segmentPaths.length === 0) {
      throw new Error('Rendering aborted: no source segments were generated.');
    }

    const concatListPath = path.join(tempDir, 'concat.txt');
    const concatFileContent = `${segmentPaths.map((segmentPath) => concatPathLine(segmentPath)).join('\n')}\n`;
    await fs.writeFile(concatListPath, concatFileContent, 'utf8');

    const stitchedPath = path.join(tempDir, 'stitched.mp4');
    await tracker.run('segment-concat', async () => {
      const retryResult = await withRetries(
        'segment-concat',
        maxRetries,
        retryDelayMs,
        () => concatSegments(concatListPath, stitchedPath, profile),
        onRetry,
      );
      stageAttempts['segment-concat'] = retryResult.attempts;
    });

    const compositedPath = path.join(tempDir, 'composited.mp4');

    // Pre-render templates
    let templatePaths = {};
    if (timeline.clips.some(c => c.clipType === 'template_clip')) {
      await tracker.run('template-render', async () => {
        templatePaths = await preRenderTemplates(timeline, tempDir, profile);
      });
    }

    process.stderr.write(`[Render] Template pre-render results: ${Object.keys(templatePaths).length} succeeded\n`);

    const overlayResult = await tracker.run('overlay-composite', async () => {
      const retryResult = await withRetries(
        'overlay-composite',
        maxRetries,
        retryDelayMs,
        () =>
          renderWithOverlayCompositor({
            stitchedPath,
            timeline,
            outputPath: compositedPath,
            profile,
            templatePaths,
          }),
        onRetry,
      );
      stageAttempts['overlay-composite'] = retryResult.attempts;
      return retryResult.result;
    });
    warnings.push(...overlayResult.warnings);
    process.stderr.write(`[Render] Overlay composite done: ${overlayResult.appliedCount} overlays applied, ${overlayResult.warnings.length} warnings\n`);
    if (overlayResult.warnings.length > 0) {
      process.stderr.write(`[Render] Overlay warnings:\n${overlayResult.warnings.map(w => `  - ${w}`).join('\n')}\n`);
    }

    // ── Watermark / Branding Overlay ──────────────────────────────────────────
    let watermarkedPath = compositedPath;
    if (watermarkPath && (await exists(watermarkPath))) {
      await tracker.run('watermark', async () => {
        const wmTemp = path.join(tempDir, 'watermarked.mp4');
        const posMap = {
          'top-left': '10:10',
          'top-right': 'main_w-overlay_w-10:10',
          'bottom-left': '10:main_h-overlay_h-10',
          'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
        };
        const overlay = posMap[watermarkPos] || posMap['bottom-right'];
        const opacityVal = Math.max(0.1, Math.min(1.0, watermarkOpacity));
        const vEnc = await hwEncodeVideoArgs({ quality: profile.quality || 'balanced' });
        try {
          await run('ffmpeg', [
            '-y', '-loglevel', 'error',
            '-i', compositedPath,
            '-i', watermarkPath,
            '-filter_complex', `[1:v]format=rgba,colorchannelmixer=aa=${opacityVal.toFixed(2)}[wm];[0:v][wm]overlay=${overlay}[out]`,
            '-map', '[out]', '-map', '0:a?',
            ...vEnc,
            '-c:a', 'copy',
            '-movflags', '+faststart',
            wmTemp,
          ]);
          watermarkedPath = wmTemp;
          console.error(`[Render] Watermark applied: ${watermarkPos}, opacity ${opacityVal}`);
        } catch (e) {
          warnings.push(`Watermark overlay failed: ${e.message}`);
          console.error(`[Render] Watermark failed, continuing without: ${e.message}`);
        }
      });
    }

    const finalOutputPath = path.join(renderDir, normalizeOutputName(outputName, projectId));
    let subtitlesBurned = false;
    const preSubtitlePath = watermarkedPath;

    await tracker.run('subtitle-finalize', async () => {
      if (burnSubtitles && (await exists(subtitlesPath))) {
        const subtitleTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lapaas-subtitles-'));
        const subtitleTempPath = path.join(subtitleTempDir, 'subtitles.srt');
        await fs.copyFile(subtitlesPath, subtitleTempPath);
        const escapedSubtitlePath = escapeSubtitlePath(subtitleTempPath);
        try {
          const subtitleBurnVEnc = await hwEncodeVideoArgs({ quality: profile.quality || 'balanced' });
          const retryResult = await withRetries(
            'subtitle-burn',
            maxRetries,
            retryDelayMs,
            () =>
              run('ffmpeg', [
                '-y',
                '-loglevel',
                'error',
                '-i',
                preSubtitlePath,
                '-vf',
                `subtitles=filename=${escapedSubtitlePath}`,
                ...subtitleBurnVEnc,
                '-c:a',
                'copy',
                '-movflags',
                '+faststart',
                finalOutputPath,
              ]),
            onRetry,
          );
          stageAttempts['subtitle-burn'] = retryResult.attempts;
          subtitlesBurned = true;
        } catch {
          warnings.push(
            'Subtitle burn-in failed (likely ffmpeg built without subtitle filter). Exported video without burned subtitles.',
          );
          await fs.copyFile(preSubtitlePath, finalOutputPath);
        }
      } else {
        if (burnSubtitles) {
          warnings.push('Subtitle burn-in requested, but subtitles.srt was not found.');
        }
        await fs.copyFile(preSubtitlePath, finalOutputPath);
      }
    });

    // ── Audio Loudness Normalization (EBU R128) ──────────────────────────────
    let loudnormApplied = false;
    await tracker.run('loudnorm', async () => {
      try {
        const loudnormTemp = path.join(tempDir, 'loudnorm.mp4');
        const vEnc = await hwEncodeVideoArgs({ quality: profile.quality || 'balanced' });
        await run('ffmpeg', [
          '-y', '-loglevel', 'error',
          '-i', finalOutputPath,
          '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
          '-c:v', 'copy',
          '-movflags', '+faststart',
          loudnormTemp,
        ]);
        await fs.rename(loudnormTemp, finalOutputPath);
        loudnormApplied = true;
        console.error('[Render] Audio loudness normalization applied (EBU R128: I=-16, TP=-1.5, LRA=11)');
      } catch (e) {
        warnings.push(`Audio loudnorm failed (non-critical): ${e.message}`);
        console.error(`[Render] Loudnorm failed, keeping original audio: ${e.message}`);
      }
    });

    const totalClipCount = Array.isArray(timeline.clips) ? timeline.clips.length : 0;
    const overlayClipCount = collectOverlayClips(timeline).length;
    const ignoredClipCount = Math.max(0, totalClipCount - sourceClips.length - overlayResult.appliedCount);
    const finishedAt = nowIso();
    const stageDurationsMs = tracker.snapshot();
    const telemetry = await recordProjectTelemetry({
      projectDir,
      projectId,
      pipeline: 'render',
      status: 'RENDER_DONE',
      stageDurationsMs,
      meta: {
        quality,
        burnSubtitlesRequested: burnSubtitles,
        maxRetries,
        retryEventCount: retryEvents.length,
      },
    });

    const result = {
      ok: true,
      projectId,
      outputPath: finalOutputPath,
      timelinePath,
      quality,
      burnSubtitlesRequested: burnSubtitles,
      subtitlesBurned,
      loudnormApplied,
      sourceClipCount: sourceClips.length,
      overlayClipCount,
      overlayAppliedCount: overlayResult.appliedCount,
      ignoredClipCount,
      warnings,
      retry: {
        maxRetries,
        retryDelayMs,
        stageAttempts,
        retryEvents,
      },
      stageDurationsMs,
      telemetryPath: telemetry.summaryPath,
      startedAt,
      finishedAt,
    };

    // ── Multi-Format Exports ────────────────────────────────────────────────
    const formatExports = [];

    if (exportFormats.includes('vertical') || exportFormats.includes('9:16')) {
      try {
        const verticalPath = finalOutputPath.replace(/\.mp4$/, '-vertical.mp4');
        const vEnc = await hwEncodeVideoArgs({ quality: profile.quality || 'balanced' });
        const aEnc = await hwEncodeAudioArgs({ bitrate: '160k' });
        await run('ffmpeg', [
          '-y', '-loglevel', 'error',
          '-i', finalOutputPath,
          '-vf', "crop=ih*9/16:ih,scale=1080:1920",
          ...vEnc,
          ...aEnc,
          '-movflags', '+faststart',
          verticalPath,
        ]);
        formatExports.push({ format: 'vertical_9_16', path: verticalPath, ok: true });
        console.error(`[Render] Exported vertical 9:16: ${verticalPath}`);
      } catch (e) {
        warnings.push(`Vertical export failed: ${e.message}`);
        formatExports.push({ format: 'vertical_9_16', ok: false, error: e.message });
      }
    }

    if (exportFormats.includes('shorts')) {
      try {
        // Extract shorts candidates from global analysis if available
        const globalPath = path.join(projectDir, 'global_analysis.json');
        let candidates = [];
        if (await exists(globalPath)) {
          const ga = await readJson(globalPath);
          candidates = ga.shortsCandidates?.candidates || [];
        }
        if (candidates.length === 0) {
          // Default: extract first 60s as a short
          candidates = [{ startUs: 0, endUs: 60_000_000, durationSec: 60 }];
        }

        for (let si = 0; si < Math.min(candidates.length, 3); si++) {
          const c = candidates[si];
          const shortPath = finalOutputPath.replace(/\.mp4$/, `-short-${si + 1}.mp4`);
          const vEnc = await hwEncodeVideoArgs({ quality: profile.quality || 'balanced' });
          const aEnc = await hwEncodeAudioArgs({ bitrate: '160k' });
          await run('ffmpeg', [
            '-y', '-loglevel', 'error',
            '-ss', usToSec(c.startUs),
            '-to', usToSec(c.endUs),
            '-i', finalOutputPath,
            '-vf', "crop=ih*9/16:ih,scale=1080:1920",
            ...vEnc,
            ...aEnc,
            '-movflags', '+faststart',
            shortPath,
          ]);
          formatExports.push({ format: 'short', index: si + 1, path: shortPath, durationSec: c.durationSec, ok: true });
          console.error(`[Render] Exported short ${si + 1}: ${shortPath} (${c.durationSec}s)`);
        }
      } catch (e) {
        warnings.push(`Shorts export failed: ${e.message}`);
        formatExports.push({ format: 'shorts', ok: false, error: e.message });
      }
    }

    // ── Captions On/Off Variants ──────────────────────────────────────────
    if (captionsVariants && (await exists(subtitlesPath))) {
      try {
        if (subtitlesBurned) {
          // Main file has captions — create a no-captions variant from preSubtitlePath
          const noCaptionsPath = finalOutputPath.replace(/\.mp4$/, '-no-captions.mp4');
          await fs.copyFile(preSubtitlePath, noCaptionsPath);
          // Apply loudnorm to no-captions variant
          try {
            const loudTemp = path.join(tempDir, 'nocap-loud.mp4');
            await run('ffmpeg', [
              '-y', '-loglevel', 'error',
              '-i', noCaptionsPath,
              '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
              '-c:v', 'copy',
              '-movflags', '+faststart',
              loudTemp,
            ]);
            await fs.rename(loudTemp, noCaptionsPath);
          } catch { /* non-critical */ }
          formatExports.push({ format: 'no-captions', path: noCaptionsPath, ok: true });
          console.error(`[Render] Exported no-captions variant: ${noCaptionsPath}`);
        } else {
          // Main file has no captions — create a with-captions variant
          const captionedPath = finalOutputPath.replace(/\.mp4$/, '-captioned.mp4');
          const subtitleTempDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'lapaas-capvar-'));
          const subtitleTempPath2 = path.join(subtitleTempDir2, 'subtitles.srt');
          await fs.copyFile(subtitlesPath, subtitleTempPath2);
          const escapedPath2 = escapeSubtitlePath(subtitleTempPath2);
          const capVEnc = await hwEncodeVideoArgs({ quality: profile.quality || 'balanced' });
          await run('ffmpeg', [
            '-y', '-loglevel', 'error',
            '-i', finalOutputPath,
            '-vf', `subtitles=filename=${escapedPath2}`,
            ...capVEnc,
            '-c:a', 'copy',
            '-movflags', '+faststart',
            captionedPath,
          ]);
          formatExports.push({ format: 'captioned', path: captionedPath, ok: true });
          console.error(`[Render] Exported captioned variant: ${captionedPath}`);
        }
      } catch (e) {
        warnings.push(`Captions variant export failed: ${e.message}`);
        formatExports.push({ format: 'captions-variant', ok: false, error: e.message });
      }
    }

    result.formatExports = formatExports;

    const historyPath = await appendRenderHistory(projectDir, {
      ...result,
      status: 'RENDER_DONE',
    });
    result.historyPath = historyPath;

    await writeJson(jobPath, {
      ...result,
      status: 'RENDER_DONE',
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const stageDurationsMs = tracker.snapshot();
    const failed = {
      projectId,
      status: 'RENDER_FAILED',
      finishedAt: nowIso(),
      quality,
      burnSubtitlesRequested: burnSubtitles,
      retry: {
        maxRetries,
        retryDelayMs,
        stageAttempts,
        retryEvents,
      },
      stageDurationsMs,
      warnings,
      error: String(error?.message ?? error),
    };
    await writeJson(jobPath, failed).catch(() => { });
    await appendRenderHistory(projectDir, failed).catch(() => { });
    await recordProjectTelemetry({
      projectDir,
      projectId,
      pipeline: 'render',
      status: 'RENDER_FAILED',
      stageDurationsMs,
      meta: {
        quality,
        burnSubtitlesRequested: burnSubtitles,
        maxRetries,
      },
      error: String(error?.message ?? error),
    }).catch(() => { });
    throw error;
  }
}

// ── Preview-chunk sub-command ────────────────────────────────────────────────
// Usage: node render_pipeline.mjs --preview-chunk --source <path> --start-us <n> --end-us <n> --output <path>
if (process.argv.includes('--preview-chunk')) {
  const src = readArg('--source');
  const startUs = Number(readArg('--start-us', '0'));
  const endUs = Number(readArg('--end-us', '0'));
  const output = readArg('--output');
  if (!src || !output || endUs <= startUs) {
    process.stderr.write('Usage: --preview-chunk --source <path> --start-us <n> --end-us <n> --output <path>\n');
    process.exit(1);
  }
  renderChunkPreview({ sourcePath: src, startUs, endUs, outputPath: output })
    .then(() => {
      process.stdout.write(JSON.stringify({ ok: true, output, durationUs: endUs - startUs }));
    })
    .catch(err => {
      process.stderr.write(`Preview render failed: ${err.message}\n`);
      process.exit(1);
    });
} else {
  main().catch(async (error) => {
    process.stderr.write(`${String(error?.message ?? error)}\n`);
    process.exit(1);
  });
}
