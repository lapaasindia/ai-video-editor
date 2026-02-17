#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { createStageTracker, recordProjectTelemetry } from './lib/pipeline_telemetry.mjs';

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
    return { preset: 'veryfast', crf: 30 };
  }
  if (quality === 'quality') {
    return { preset: 'medium', crf: 18 };
  }
  return { preset: 'fast', crf: 23 };
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
    return sourceClips;
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
    ext === '.pgm'
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

async function renderSegment({ sourcePath, startUs, endUs, outputPath, profile }) {
  await run('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-ss',
    usToSec(startUs),
    '-to',
    usToSec(endUs),
    '-i',
    sourcePath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-c:v',
    'libx264',
    '-preset',
    profile.preset,
    '-crf',
    String(profile.crf),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
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
      '-c:v',
      'libx264',
      '-preset',
      profile.preset,
      '-crf',
      String(profile.crf),
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
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

  if (templateClips.length === 0) return results;

  console.log(`[Render] Pre-rendering ${templateClips.length} templates...`);

  for (const clip of templateClips) {
    const compositionId = `${clip.templateId}-landscape`; // Default to landscape for now
    const outputPath = path.join(tempDir, `template-${clip.id}.mov`);

    // Construct props from clip metadata/content
    // We assume clip.content contains the strict schema props (headline, subline, etc.)
    const props = {
      ...clip.content,
      ...clip.style
    };

    try {
      // Use npx remotion render
      // We use prores for alpha channel support
      await run('npx', [
        'remotion', 'render',
        'src/index.ts',
        compositionId,
        outputPath,
        '--props', JSON.stringify(props),
        '--codec', 'prores',
        '--quiet'
      ], 10 * 60 * 1000); // 10 min timeout per template

      results[clip.id] = outputPath;
    } catch (e) {
      console.warn(`[Render] Failed to render template ${clip.id}: ${e.message}`);
    }
  }
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

  if (overlayClips.length === 0) {
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
        warnings.push(`Skipped template clip ${clip.id}: pre-render failed or missing.`);
        continue;
      }
    } else {
      overlayPath = await resolveOverlaySourcePath(clip);
    }

    if (!overlayPath) {
      warnings.push(`Skipped overlay clip ${clip.id}: source path not available.`);
      continue;
    }

    resolved.push({
      ...clip,
      overlayPath,
      isImage: isImagePath(overlayPath, clip.kind),
    });
  }

  if (resolved.length === 0) {
    await fs.copyFile(stitchedPath, outputPath);
    return {
      appliedCount: 0,
      warnings,
    };
  }

  const args = ['-y', '-loglevel', 'error', '-i', stitchedPath];
  for (const overlay of resolved) {
    if (overlay.isImage) {
      args.push('-loop', '1', '-i', overlay.overlayPath);
      continue;
    }
    args.push('-i', overlay.overlayPath);
  }

  const filters = [];
  let current = 'vbase0';
  filters.push(`[0:v]setpts=PTS-STARTPTS[${current}]`);

  for (let index = 0; index < resolved.length; index += 1) {
    const clip = resolved[index];
    const inIdx = index + 1;
    const scaled = `ovscaled${index}`;
    const baseRef = `ovbase${index}`;
    const alpha = `ovalpha${index}`;
    const output = `vout${index}`;
    const start = usToSec(clip.startUs);
    const end = usToSec(clip.endUs);
    const isTemplate = clip.clipType === 'template_clip';
    // Templates (ProRes) already have alpha, no need to force format=rgba or colorchannelmixer for transparency unless optimizing
    // But we might want to scale them.

    const scaleW = 'main_w'; // Full screen for templates usually
    const scaleH = 'main_h';
    // If it's an image/logo, we might scale differently. For now, assume full screen overlays for templates.

    // If it's NOT a template (e.g. user image), use correct scaling
    const finalScaleW = isTemplate ? 'main_w' : (isImagePath(clip.overlayPath) ? '-1' : 'main_w*0.3');
    const finalScaleH = isTemplate ? 'main_h' : (isImagePath(clip.overlayPath) ? 'main_h*0.8' : '-1');

    // Simple overlay logic
    // We need to ensure timestamps align. 
    // overlay=enable='between(t,start,end)'

    // Note: Prores video inputs [inIdx] include alpha.

    filters.push(`[${inIdx}:v]scale=${finalScaleW}:${finalScaleH}:force_original_aspect_ratio=decrease[${scaled}]`);

    filters.push(
      `[${current}][${scaled}]overlay=x=(W-w)/2:y=(H-h)/2:eof_action=pass:enable='between(t,${start},${end})'[${output}]`
    );
    current = output;
  }

  args.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    `[${current}]`,
    '-map',
    '0:a?',
    '-c:v',
    'libx264',
    '-preset',
    profile.preset,
    '-crf',
    String(profile.crf),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    outputPath,
  );

  try {
    await run('ffmpeg', args);
    return {
      appliedCount: resolved.length,
      warnings,
    };
  } catch (e) {
    console.error(e);
    warnings.push('Overlay compositor failed. Exported source-cut timeline only.');
    await fs.copyFile(stitchedPath, outputPath);
    return {
      appliedCount: 0,
      warnings,
    };
  }
}

async function main() {
  const projectId = readArg('--project-id');
  const outputName = readArg('--output-name');
  const quality = safeQuality(readArg('--quality', 'balanced'));
  const burnSubtitles = readArg('--burn-subtitles', 'false') === 'true';
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

  const projectDir = path.resolve('desktop', 'data', projectId);
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
      if (sourceClips.length === 0) {
        throw new Error('No source clips available in timeline for rendering.');
      }
      const profile = qualityProfile(quality);
      const defaultSourcePath = await resolveDefaultSourcePath(projectDir);
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

    await tracker.run('segment-render', async () => {
      for (let index = 0; index < sourceClips.length; index += 1) {
        const clip = sourceClips[index];
        const clipSourcePath = await resolveClipSourcePath(clip, defaultSourcePath);
        if (!clipSourcePath) {
          warnings.push(`Skipped clip ${clip.id}: source path unavailable.`);
          continue;
        }

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

    const finalOutputPath = path.join(renderDir, normalizeOutputName(outputName, projectId));
    let subtitlesBurned = false;
    const preSubtitlePath = compositedPath;

    await tracker.run('subtitle-finalize', async () => {
      if (burnSubtitles && (await exists(subtitlesPath))) {
        const subtitleTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lapaas-subtitles-'));
        const subtitleTempPath = path.join(subtitleTempDir, 'subtitles.srt');
        await fs.copyFile(subtitlesPath, subtitleTempPath);
        const escapedSubtitlePath = escapeSubtitlePath(subtitleTempPath);
        try {
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
                '-c:v',
                'libx264',
                '-preset',
                profile.preset,
                '-crf',
                String(Math.min(35, profile.crf + 1)),
                '-pix_fmt',
                'yuv420p',
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

main().catch(async (error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
