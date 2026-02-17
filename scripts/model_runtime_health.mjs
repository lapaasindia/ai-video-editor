#!/usr/bin/env node

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

async function run(command, args = [], timeout = 25000) {
  const started = process.hrtime.bigint();
  const { stdout, stderr } = await execFile(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    stdout: String(stdout || '').trim(),
    stderr: String(stderr || '').trim(),
    elapsedMs: elapsedMs(started),
  };
}

async function commandPath(command) {
  try {
    const result = await run('which', [command], 8000);
    return {
      available: Boolean(result.stdout),
      path: result.stdout || '',
    };
  } catch {
    return {
      available: false,
      path: '',
    };
  }
}

function normalizeStatus(value) {
  const text = String(value || '').toLowerCase().trim();
  if (text === 'healthy') return 'healthy';
  if (text === 'degraded') return 'degraded';
  if (text === 'unavailable') return 'unavailable';
  return 'unknown';
}

function buildSummary(runtimes) {
  const summary = {
    healthy: 0,
    degraded: 0,
    unavailable: 0,
    unknown: 0,
  };
  for (const runtime of runtimes) {
    const status = normalizeStatus(runtime?.status);
    if (status in summary) {
      summary[status] += 1;
    } else {
      summary.unknown += 1;
    }
  }
  return summary;
}

async function healthOllama(modelHint) {
  const runtime = 'ollama';
  const pathProbe = await commandPath('ollama');
  if (!pathProbe.available) {
    return {
      runtime,
      status: 'unavailable',
      available: false,
      path: '',
      latencyMs: null,
      details: {
        modelCount: 0,
        selectedModel: modelHint || '',
      },
      warnings: ['Ollama CLI not found in PATH.'],
    };
  }

  const warnings = [];
  let modelCount = 0;
  let selectedModelInstalled = null;
  let latencyMs = null;
  try {
    const listResult = await run('ollama', ['list'], 25000);
    latencyMs = listResult.elapsedMs;
    const lines = listResult.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    modelCount = Math.max(0, lines.length - 1);
    if (modelHint) {
      const normalizedHint = String(modelHint).trim().toLowerCase();
      selectedModelInstalled = lines.some((line) =>
        line.toLowerCase().startsWith(normalizedHint),
      );
      if (!selectedModelInstalled) {
        warnings.push(`Requested model hint not found in local Ollama list: ${modelHint}`);
      }
    }
  } catch (error) {
    return {
      runtime,
      status: 'degraded',
      available: true,
      path: pathProbe.path,
      latencyMs: null,
      details: {
        modelCount: 0,
        selectedModel: modelHint || '',
      },
      warnings: [`Ollama probe failed: ${String(error?.message || error)}`],
    };
  }

  if (modelCount === 0) {
    warnings.push('Ollama is installed but no local models are present.');
  }

  return {
    runtime,
    status: warnings.length > 0 ? 'degraded' : 'healthy',
    available: true,
    path: pathProbe.path,
    latencyMs: Number(latencyMs?.toFixed(1) || 0),
    details: {
      modelCount,
      selectedModel: modelHint || '',
      selectedModelInstalled,
    },
    warnings,
  };
}

async function healthWhisperCpp() {
  const runtime = 'whisper_cpp';
  const candidates = ['whisper-cli', 'whisper-cpp'];
  for (const candidate of candidates) {
    const pathProbe = await commandPath(candidate);
    if (!pathProbe.available) {
      continue;
    }
    try {
      const result = await run(candidate, ['--help'], 15000);
      return {
        runtime,
        status: 'healthy',
        available: true,
        path: pathProbe.path,
        latencyMs: Number(result.elapsedMs.toFixed(1)),
        details: {
          binary: candidate,
        },
        warnings: [],
      };
    } catch (error) {
      return {
        runtime,
        status: 'degraded',
        available: true,
        path: pathProbe.path,
        latencyMs: null,
        details: {
          binary: candidate,
        },
        warnings: [`Whisper.cpp command exists but probe failed: ${String(error?.message || error)}`],
      };
    }
  }

  return {
    runtime,
    status: 'unavailable',
    available: false,
    path: '',
    latencyMs: null,
    details: {},
    warnings: ['whisper.cpp CLI not found in PATH.'],
  };
}

async function healthFasterWhisper() {
  const runtime = 'faster_whisper';
  const py = await commandPath('python3');
  if (!py.available) {
    return {
      runtime,
      status: 'unavailable',
      available: false,
      path: '',
      latencyMs: null,
      details: {},
      warnings: ['python3 not available in PATH.'],
    };
  }

  try {
    const result = await run(
      'python3',
      [
        '-c',
        "import importlib.util as u; spec=u.find_spec('faster_whisper'); print('MISSING' if spec is None else 'FOUND')",
      ],
      15000,
    );
    const probe = String(result.stdout || '').trim();
    if (probe !== 'FOUND') {
      return {
        runtime,
        status: 'unavailable',
        available: false,
        path: py.path,
        latencyMs: Number(result.elapsedMs.toFixed(1)),
        details: {},
        warnings: ['faster-whisper Python package is not installed.'],
      };
    }

    const versionResult = await run(
      'python3',
      [
        '-c',
        "import faster_whisper as fw; print(getattr(fw, '__version__', 'unknown'))",
      ],
      15000,
    );
    const version = String(versionResult.stdout || '').trim() || 'unknown';

    return {
      runtime,
      status: 'healthy',
      available: true,
      path: py.path,
      latencyMs: Number((result.elapsedMs + versionResult.elapsedMs).toFixed(1)),
      details: {
        version,
      },
      warnings: [],
    };
  } catch (error) {
    return {
      runtime,
      status: 'degraded',
      available: true,
      path: py.path,
      latencyMs: null,
      details: {},
      warnings: [`faster-whisper probe failed: ${String(error?.message || error)}`],
    };
  }
}

async function healthMlx() {
  const runtime = 'mlx';
  const pathProbe = await commandPath('mlx_lm');
  if (!pathProbe.available) {
    return {
      runtime,
      status: 'unavailable',
      available: false,
      path: '',
      latencyMs: null,
      details: {},
      warnings: ['mlx_lm not found in PATH.'],
    };
  }

  try {
    const result = await run('mlx_lm', ['--help'], 15000);
    return {
      runtime,
      status: 'healthy',
      available: true,
      path: pathProbe.path,
      latencyMs: Number(result.elapsedMs.toFixed(1)),
      details: {},
      warnings: [],
    };
  } catch (error) {
    return {
      runtime,
      status: 'degraded',
      available: true,
      path: pathProbe.path,
      latencyMs: null,
      details: {},
      warnings: [`mlx_lm probe failed: ${String(error?.message || error)}`],
    };
  }
}

function recommendations(runtimes) {
  const suggestions = [];
  const runtimeByKey = new Map(runtimes.map((runtime) => [runtime.runtime, runtime]));

  if (normalizeStatus(runtimeByKey.get('ollama')?.status) !== 'healthy') {
    suggestions.push('Install and start Ollama, then pull at least one planner model.');
  }
  const transcriptionHealthy = ['whisper_cpp', 'faster_whisper', 'mlx'].some(
    (key) => normalizeStatus(runtimeByKey.get(key)?.status) === 'healthy',
  );
  if (!transcriptionHealthy) {
    suggestions.push('Install at least one local transcription runtime (whisper.cpp, faster-whisper, or MLX).');
  }
  return suggestions;
}

async function main() {
  const modelHint = String(readArg('--model', '') || '').trim();
  const runtimes = await Promise.all([
    healthOllama(modelHint),
    healthWhisperCpp(),
    healthFasterWhisper(),
    healthMlx(),
  ]);

  const summary = buildSummary(runtimes);
  const result = {
    ok: true,
    generatedAt: nowIso(),
    summary,
    runtimes,
    recommendations: recommendations(runtimes),
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`model health check failed: ${String(error?.message || error)}\n`);
  process.exit(1);
});
