#!/usr/bin/env node

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

async function run(command, args = [], timeout = 30000) {
  const { stdout } = await execFile(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 8,
  });
  return String(stdout || '').trim();
}

async function commandExists(command) {
  try {
    const out = await run('which', [command], 8000);
    return Boolean(out);
  } catch {
    return false;
  }
}

async function collectCpuInfo() {
  try {
    const brand = await run('sysctl', ['-n', 'machdep.cpu.brand_string'], 8000);
    return { brand: brand || 'unknown' };
  } catch {
    return { brand: 'unknown' };
  }
}

async function collectOsInfo() {
  if (process.platform !== 'darwin') {
    return {
      platform: process.platform,
      release: process.release.name,
      version: process.version,
    };
  }

  const [productName, productVersion, buildVersion] = await Promise.all([
    run('sw_vers', ['-productName']).catch(() => ''),
    run('sw_vers', ['-productVersion']).catch(() => ''),
    run('sw_vers', ['-buildVersion']).catch(() => ''),
  ]);

  return {
    platform: process.platform,
    release: process.release.name,
    version: process.version,
    productName: productName || 'macOS',
    productVersion: productVersion || '',
    buildVersion: buildVersion || '',
  };
}

function extractMetalStrings(displayNode, result) {
  if (!displayNode || typeof displayNode !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(displayNode)) {
    if (key.toLowerCase().includes('metal') && typeof value === 'string') {
      result.push(value);
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        extractMetalStrings(child, result);
      }
      continue;
    }

    if (value && typeof value === 'object') {
      extractMetalStrings(value, result);
    }
  }
}

async function collectMetalDiagnostics() {
  if (process.platform !== 'darwin') {
    return {
      supported: false,
      diagnosticsSource: 'non-darwin',
      details: [],
      warnings: ['Metal diagnostics are available only on macOS hosts.'],
    };
  }

  const warnings = [];
  try {
    const raw = await run('system_profiler', ['SPDisplaysDataType', '-json'], 45000);
    const parsed = JSON.parse(raw || '{}');
    const displays = Array.isArray(parsed.SPDisplaysDataType) ? parsed.SPDisplaysDataType : [];
    const metalDetails = [];
    for (const display of displays) {
      extractMetalStrings(display, metalDetails);
    }

    const uniqueDetails = [...new Set(metalDetails.filter(Boolean))];
    const supported = uniqueDetails.some((value) => /supported/i.test(value));

    if (!supported) {
      warnings.push('Metal support was not detected from system_profiler output.');
    }

    return {
      supported,
      diagnosticsSource: 'system_profiler',
      details: uniqueDetails,
      warnings,
    };
  } catch (error) {
    return {
      supported: false,
      diagnosticsSource: 'system_profiler',
      details: [],
      warnings: [`Failed to collect Metal diagnostics: ${String(error?.message || error)}`],
    };
  }
}

async function collectFfmpegDiagnostics() {
  const hasFfmpeg = await commandExists('ffmpeg');
  if (!hasFfmpeg) {
    return {
      available: false,
      hwaccels: [],
      hasVideoToolboxHwaccel: false,
      hasVideoToolboxEncoder: false,
      warnings: ['ffmpeg is not installed.'],
    };
  }

  const warnings = [];
  let hwaccels = [];
  let hasVideoToolboxEncoder = false;

  try {
    const rawHwaccels = await run('ffmpeg', ['-hide_banner', '-hwaccels'], 20000);
    hwaccels = rawHwaccels
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.toLowerCase().includes('hardware acceleration methods'));
  } catch (error) {
    warnings.push(`Unable to query ffmpeg hwaccels: ${String(error?.message || error)}`);
  }

  try {
    const rawEncoders = await run('ffmpeg', ['-hide_banner', '-encoders'], 30000);
    hasVideoToolboxEncoder = /h264_videotoolbox|hevc_videotoolbox/i.test(rawEncoders);
  } catch (error) {
    warnings.push(`Unable to query ffmpeg encoders: ${String(error?.message || error)}`);
  }

  const hasVideoToolboxHwaccel = hwaccels.some((item) => item.toLowerCase() === 'videotoolbox');
  if (!hasVideoToolboxHwaccel) {
    warnings.push('ffmpeg does not report videotoolbox in available hardware accelerators.');
  }
  if (!hasVideoToolboxEncoder) {
    warnings.push('ffmpeg does not report h264/hevc videotoolbox encoders.');
  }

  return {
    available: true,
    hwaccels,
    hasVideoToolboxHwaccel,
    hasVideoToolboxEncoder,
    warnings,
  };
}

async function collectLocalRuntimeAvailability() {
  const [ollama, whisperCli, whisperCpp, mlxWhisper, python3] = await Promise.all([
    commandExists('ollama'),
    commandExists('whisper-cli'),
    commandExists('whisper-cpp'),
    commandExists('mlx_whisper'),
    commandExists('python3'),
  ]);

  return {
    ollama,
    whisperCli,
    whisperCpp,
    mlxWhisper,
    python3,
  };
}

function buildRecommendations({ metal, ffmpeg, runtimes }) {
  const recommendations = [];

  if (!metal.supported) {
    recommendations.push('Metal support not detected. Verify macOS GPU capability and OS-level Metal availability.');
  }

  if (!ffmpeg.available) {
    recommendations.push('Install ffmpeg to enable media processing and hardware acceleration checks.');
  } else if (!ffmpeg.hasVideoToolboxHwaccel || !ffmpeg.hasVideoToolboxEncoder) {
    recommendations.push(
      'Use an ffmpeg build with videotoolbox hwaccel and h264/hevc videotoolbox encoders for better macOS performance.',
    );
  }

  if (!runtimes.ollama) {
    recommendations.push('Install Ollama for local LLM workflows.');
  }
  if (!runtimes.whisperCli && !runtimes.whisperCpp && !runtimes.mlxWhisper) {
    recommendations.push('Install whisper.cpp or mlx_whisper for local transcription paths.');
  }

  return recommendations;
}

async function main() {
  const [cpu, os, metal, ffmpeg, runtimes] = await Promise.all([
    collectCpuInfo(),
    collectOsInfo(),
    collectMetalDiagnostics(),
    collectFfmpegDiagnostics(),
    collectLocalRuntimeAvailability(),
  ]);

  const result = {
    ok: true,
    timestamp: new Date().toISOString(),
    os,
    architecture: process.arch,
    cpu,
    metal,
    ffmpeg,
    runtimes,
    recommendations: buildRecommendations({ metal, ffmpeg, runtimes }),
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.message || error)}\n`);
  process.exit(1);
});
