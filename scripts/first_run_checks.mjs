#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

async function run(command, args = [], timeout = 30000) {
  const { stdout, stderr } = await execFile(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 10,
  });
  return {
    stdout: String(stdout || '').trim(),
    stderr: String(stderr || '').trim(),
  };
}

async function commandExists(command) {
  try {
    const out = await run('which', [command], 10000);
    return {
      ok: Boolean(out.stdout),
      path: out.stdout || '',
    };
  } catch {
    return {
      ok: false,
      path: '',
    };
  }
}

async function collectCpuInfo() {
  if (process.platform !== 'darwin') {
    return {
      brand: os.cpus()?.[0]?.model || 'unknown',
    };
  }
  try {
    const out = await run('sysctl', ['-n', 'machdep.cpu.brand_string'], 8000);
    return {
      brand: out.stdout || os.cpus()?.[0]?.model || 'unknown',
    };
  } catch {
    return {
      brand: os.cpus()?.[0]?.model || 'unknown',
    };
  }
}

async function collectOsInfo() {
  if (process.platform !== 'darwin') {
    return {
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      node: process.version,
    };
  }

  const [productName, productVersion, buildVersion] = await Promise.all([
    run('sw_vers', ['-productName']).catch(() => ({ stdout: '' })),
    run('sw_vers', ['-productVersion']).catch(() => ({ stdout: '' })),
    run('sw_vers', ['-buildVersion']).catch(() => ({ stdout: '' })),
  ]);

  return {
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    node: process.version,
    productName: productName.stdout || 'macOS',
    productVersion: productVersion.stdout || '',
    buildVersion: buildVersion.stdout || '',
  };
}

function supportPolicy() {
  const platform = process.platform;
  const arch = process.arch;
  const primary = platform === 'darwin' && arch === 'arm64';
  const secondary = platform === 'darwin' && arch === 'x64';

  if (primary) {
    return {
      tier: 'primary',
      status: 'supported',
      summary: 'Apple Silicon macOS (Metal accelerated) is fully supported for v1.',
    };
  }

  if (secondary) {
    return {
      tier: 'secondary',
      status: 'supported_with_limits',
      summary: 'Intel macOS is supported in v1 with reduced performance and no Apple Silicon Metal path.',
    };
  }

  return {
    tier: 'unsupported',
    status: 'unsupported',
    summary: 'Only macOS hosts are supported for Lapaas AI Editor desktop v1.',
  };
}

async function checkWritableDirectory(targetPath) {
  try {
    await fs.mkdir(targetPath, { recursive: true });
    const probePath = path.join(targetPath, `.probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`);
    await fs.writeFile(probePath, 'ok\n', 'utf8');
    await fs.unlink(probePath);
    return {
      path: targetPath,
      ok: true,
      message: 'Writable',
    };
  } catch (error) {
    return {
      path: targetPath,
      ok: false,
      message: `Not writable: ${String(error?.message || error)}`,
    };
  }
}

async function collectRuntimeDiscovery() {
  const scriptPath = path.resolve('scripts', 'model_runtime_discovery.mjs');
  try {
    const out = await run('node', [scriptPath], 40000);
    return JSON.parse(out.stdout || '{}');
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error),
      runtimes: [],
      recommendedModels: [],
    };
  }
}

function summarizeRuntimeReadiness(discovery) {
  const runtimes = Array.isArray(discovery?.runtimes) ? discovery.runtimes : [];
  const requiredKeys = ['ollama'];
  const optionalTranscription = ['whisper_cpp', 'faster_whisper', 'mlx'];
  const runtimeByKey = new Map(runtimes.map((runtime) => [String(runtime?.runtime || ''), runtime]));

  const required = requiredKeys.map((key) => {
    const runtime = runtimeByKey.get(key);
    return {
      runtime: key,
      ok: Boolean(runtime?.installed),
      status: String(runtime?.status || 'not_installed'),
    };
  });

  const transcriptionAny = optionalTranscription.some((key) => Boolean(runtimeByKey.get(key)?.installed));
  return {
    required,
    transcriptionRuntimeAvailable: transcriptionAny,
  };
}

function overallStatus({ support, ffmpeg, ffprobe, writableChecks, runtimeReadiness }) {
  if (support.status === 'unsupported') {
    return 'fail';
  }
  if (!ffmpeg.ok || !ffprobe.ok) {
    return 'warn';
  }
  if (writableChecks.some((check) => !check.ok)) {
    return 'warn';
  }
  if (runtimeReadiness.required.some((runtime) => !runtime.ok)) {
    return 'warn';
  }
  if (!runtimeReadiness.transcriptionRuntimeAvailable) {
    return 'warn';
  }
  return 'pass';
}

async function main() {
  const [osInfo, cpu, ffmpeg, ffprobe, runtimeDiscovery] = await Promise.all([
    collectOsInfo(),
    collectCpuInfo(),
    commandExists('ffmpeg'),
    commandExists('ffprobe'),
    collectRuntimeDiscovery(),
  ]);

  const support = supportPolicy();
  const writableChecks = await Promise.all([
    checkWritableDirectory(path.resolve('desktop', 'data')),
    checkWritableDirectory(path.resolve(os.tmpdir(), 'lapaas-ai-editor')),
  ]);

  const runtimeReadiness = summarizeRuntimeReadiness(runtimeDiscovery);
  const status = overallStatus({
    support,
    ffmpeg,
    ffprobe,
    writableChecks,
    runtimeReadiness,
  });

  const recommendations = [];
  if (support.status === 'supported_with_limits') {
    recommendations.push('Intel macOS detected. Expect slower local inference and rendering than Apple Silicon.');
  }
  if (!ffmpeg.ok || !ffprobe.ok) {
    recommendations.push('Install ffmpeg (including ffprobe) and ensure both binaries are available in PATH.');
  }
  if (runtimeReadiness.required.some((runtime) => !runtime.ok)) {
    recommendations.push('Install Ollama runtime for local cut/template planner models.');
  }
  if (!runtimeReadiness.transcriptionRuntimeAvailable) {
    recommendations.push('Install at least one local transcription runtime: whisper.cpp, faster-whisper, or MLX.');
  }
  for (const check of writableChecks) {
    if (!check.ok) {
      recommendations.push(`Fix write permissions for ${check.path}.`);
    }
  }

  const result = {
    ok: true,
    status,
    checkedAt: new Date().toISOString(),
    support,
    os: osInfo,
    cpu,
    binaries: {
      ffmpeg,
      ffprobe,
    },
    writableChecks,
    runtimeReadiness,
    runtimeDiscoverySummary: runtimeDiscovery?.summary || {},
    recommendations,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.message || error)}\n`);
  process.exit(1);
});
