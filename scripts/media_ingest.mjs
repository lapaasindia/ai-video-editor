#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function run(command, args = [], timeout = 120000) {
  const { stdout, stderr } = await execFile(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    stdout: (stdout ?? '').toString().trim(),
    stderr: (stderr ?? '').toString().trim(),
  };
}

async function commandExists(command) {
  try {
    const { stdout } = await run('which', [command], 8000);
    return Boolean(stdout);
  } catch {
    return false;
  }
}

function parseRate(rate) {
  if (!rate) return 0;
  if (!rate.includes('/')) return Number(rate) || 0;
  const [a, b] = rate.split('/');
  const n = Number(a);
  const d = Number(b);
  if (!d) return 0;
  return n / d;
}

async function probeMedia(inputPath) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-show_format',
    '-show_streams',
    '-print_format',
    'json',
    inputPath,
  ]);

  const payload = JSON.parse(stdout);
  const streams = payload.streams ?? [];
  const format = payload.format ?? {};

  const video = streams.find((stream) => stream.codec_type === 'video') ?? null;
  const audio = streams.find((stream) => stream.codec_type === 'audio') ?? null;

  return {
    durationSec: Number(format.duration || 0),
    sizeBytes: Number(format.size || 0),
    formatName: format.format_name || '',
    video: video
      ? {
          codec: video.codec_name || '',
          width: Number(video.width || 0),
          height: Number(video.height || 0),
          fps: parseRate(video.r_frame_rate || video.avg_frame_rate || '0/1'),
          pixFmt: video.pix_fmt || '',
        }
      : null,
    audio: audio
      ? {
          codec: audio.codec_name || '',
          channels: Number(audio.channels || 0),
          sampleRate: Number(audio.sample_rate || 0),
        }
      : null,
  };
}

async function maybeGenerateProxy(inputPath, outputPath) {
  try {
    await run(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-vf',
        "scale='min(1280,iw)':-2",
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '28',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outputPath,
      ],
      30 * 60 * 1000,
    );
    return { ok: true, path: outputPath };
  } catch (error) {
    return { ok: false, path: '', error: String(error?.message ?? error) };
  }
}

async function maybeGenerateWaveform(inputPath, outputPath) {
  try {
    await run(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-filter_complex',
        'aformat=channel_layouts=mono,showwavespic=s=1920x300:colors=white',
        '-frames:v',
        '1',
        outputPath,
      ],
      10 * 60 * 1000,
    );
    return { ok: true, path: outputPath };
  } catch (error) {
    return { ok: false, path: '', error: String(error?.message ?? error) };
  }
}

async function main() {
  const input = readArg('--input');
  const projectId = readArg('--project-id', 'default-project');
  const generateProxy = readArg('--generate-proxy', 'true') !== 'false';
  const generateWaveform = readArg('--generate-waveform', 'true') !== 'false';

  if (!input) {
    throw new Error('Missing required argument: --input <file>');
  }

  const absInput = path.resolve(input);
  const ffprobeExists = await commandExists('ffprobe');
  if (!ffprobeExists) {
    throw new Error('ffprobe is required for media ingest but was not found in PATH.');
  }

  const ffmpegExists = await commandExists('ffmpeg');

  const mediaMeta = await probeMedia(absInput);
  const mediaDir = path.resolve('desktop', 'data', projectId, 'media');
  await fs.mkdir(mediaDir, { recursive: true });

  const proxyPath = path.join(mediaDir, 'proxy.mp4');
  const waveformPath = path.join(mediaDir, 'waveform.png');
  const metadataPath = path.join(mediaDir, 'metadata.json');

  const proxyResult =
    ffmpegExists && generateProxy
      ? await maybeGenerateProxy(absInput, proxyPath)
      : { ok: false, path: '', error: ffmpegExists ? 'Proxy generation disabled.' : 'ffmpeg not available.' };

  const waveformResult =
    ffmpegExists && generateWaveform
      ? await maybeGenerateWaveform(absInput, waveformPath)
      : { ok: false, path: '', error: ffmpegExists ? 'Waveform generation disabled.' : 'ffmpeg not available.' };

  const payload = {
    projectId,
    sourcePath: absInput,
    ffmpegAvailable: ffmpegExists,
    ingestedAt: new Date().toISOString(),
    media: mediaMeta,
    proxy: proxyResult,
    waveform: waveformResult,
  };

  await fs.writeFile(metadataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        metadataPath,
        ...payload,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});

