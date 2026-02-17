#!/usr/bin/env node

import { execFile as execFileCb } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

const PRETTY_FLAG = '--pretty';
const pretty = process.argv.includes(PRETTY_FLAG);
const TASKS_BY_RUNTIME = {
  ollama: ['cut-planner', 'template-planner'],
  whisper_cpp: ['transcription'],
  faster_whisper: ['transcription'],
  mlx: ['transcription'],
};

const RECOMMENDED_MODELS = [
  {
    id: 'llama3.2:3b',
    task: 'cut-planner',
    runtime: 'ollama',
    label: 'Llama 3.2 3B',
    installHint: 'ollama pull llama3.2:3b',
  },
  {
    id: 'qwen2.5:7b',
    task: 'template-planner',
    runtime: 'ollama',
    label: 'Qwen2.5 7B',
    installHint: 'ollama pull qwen2.5:7b',
  },
  {
    id: 'faster-whisper-large-v3',
    task: 'transcription',
    runtime: 'faster_whisper',
    label: 'Faster Whisper Large v3',
    installHint: 'pip install faster-whisper',
  },
  {
    id: 'whisper.cpp-large-v3',
    task: 'transcription',
    runtime: 'whisper_cpp',
    label: 'whisper.cpp Large v3',
    installHint: 'install whisper.cpp and model files',
  },
  {
    id: 'mlx-whisper-large-v3',
    task: 'transcription',
    runtime: 'mlx',
    label: 'MLX Whisper Large v3',
    installHint: 'install mlx_lm + MLX whisper package',
  },
];

async function run(command, args = [], timeout = 15000) {
  try {
    const { stdout, stderr } = await execFile(command, args, {
      timeout,
      maxBuffer: 1024 * 1024 * 4,
    });
    return {
      ok: true,
      stdout: (stdout ?? '').toString().trim(),
      stderr: (stderr ?? '').toString().trim(),
    };
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      stderr: String(error?.stderr ?? error?.message ?? error),
    };
  }
}

async function commandExists(command) {
  const result = await run('which', [command]);
  if (!result.ok || !result.stdout) {
    return { exists: false, path: '' };
  }
  return { exists: true, path: result.stdout.split('\n')[0].trim() };
}

function parseOllamaList(stdout) {
  if (!stdout) {
    return [];
  }

  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  // Expected shape:
  // NAME                  ID              SIZE      MODIFIED
  // llama3.2:3b           abcdef...       2.0 GB    2 days ago
  return lines.slice(1).map((line) => {
    const parts = line.split(/\s{2,}/).map((item) => item.trim()).filter(Boolean);
    return {
      name: parts[0] ?? line,
      id: parts[1] ?? '',
      size: parts[2] ?? '',
      modified: parts[3] ?? '',
      raw: line,
    };
  });
}

async function discoverOllama() {
  const binary = await commandExists('ollama');
  if (!binary.exists) {
    return {
      runtime: 'ollama',
      installed: false,
      status: 'not_installed',
      path: '',
      version: '',
      models: [],
      notes: 'Ollama binary not found in PATH.',
    };
  }

  const versionResult = await run('ollama', ['--version']);
  const listResult = await run('ollama', ['list']);

  return {
    runtime: 'ollama',
    installed: true,
    status: 'installed',
    path: binary.path,
    version: versionResult.ok ? versionResult.stdout : '',
    models: listResult.ok ? parseOllamaList(listResult.stdout) : [],
    notes: listResult.ok ? '' : 'Ollama installed but model listing failed.',
  };
}

async function discoverWhisperCpp() {
  const candidates = ['whisper-cli', 'whisper-cpp', 'main']; // 'main' is default build name for whisper.cpp
  const commonPaths = [
    path.join(process.cwd(), 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    path.join(os.homedir(), '.local/bin')
  ];

  for (const candidate of candidates) {
    // Check PATH first
    let binary = await commandExists(candidate);

    // Check common paths if not found in PATH
    if (!binary.exists) {
      for (const searchPath of commonPaths) {
        const fullPath = path.join(searchPath, candidate);
        try {
          await fs.access(fullPath, fs.constants.X_OK);
          binary = { exists: true, path: fullPath };
          break;
        } catch { }
      }
    }

    if (!binary.exists) {
      continue;
    }

    const versionResult = await run(binary.path, ['--help']);
    return {
      runtime: 'whisper_cpp',
      installed: true,
      status: 'installed',
      path: binary.path,
      version: versionResult.ok ? 'available' : '',
      models: [],
      notes: 'Binary found. Model files should be in "models/" directory.',
    };
  }

  return {
    runtime: 'whisper_cpp',
    installed: false,
    status: 'not_installed',
    path: '',
    version: '',
    models: [],
    notes: 'whisper.cpp binary not found in PATH or common locations.',
  };
}

async function discoverFasterWhisper() {
  const py = await commandExists('python3');
  if (!py.exists) {
    return {
      runtime: 'faster_whisper',
      installed: false,
      status: 'not_installed',
      path: '',
      version: '',
      models: [],
      notes: 'python3 not found; cannot probe faster-whisper.',
    };
  }

  const probe = await run('python3', [
    '-c',
    "import importlib.util as u; print('ok' if u.find_spec('faster_whisper') else 'missing')",
  ]);

  if (!probe.ok || probe.stdout !== 'ok') {
    return {
      runtime: 'faster_whisper',
      installed: false,
      status: 'not_installed',
      path: py.path,
      version: '',
      models: [],
      notes: 'Python present, but faster-whisper package not detected.',
    };
  }

  const version = await run('python3', [
    '-c',
    "import faster_whisper as fw; print(getattr(fw, '__version__', 'unknown'))",
  ]);

  return {
    runtime: 'faster_whisper',
    installed: true,
    status: 'installed',
    path: py.path,
    version: version.ok ? version.stdout : '',
    models: [],
    notes: 'Python package detected. Model cache probing is not yet implemented.',
  };
}

async function discoverMlx() {
  const binary = await commandExists('mlx_lm');
  if (!binary.exists) {
    return {
      runtime: 'mlx',
      installed: false,
      status: 'not_installed',
      path: '',
      version: '',
      models: [],
      notes: 'mlx_lm CLI not found in PATH.',
    };
  }

  const versionResult = await run('mlx_lm', ['--help']);

  return {
    runtime: 'mlx',
    installed: true,
    status: 'installed',
    path: binary.path,
    version: versionResult.ok ? 'available' : '',
    models: [],
    notes: 'MLX CLI detected. Model listing to be added in next iteration.',
  };
}

function runtimeCompatibility(runtime, machine) {
  const platform = String(machine?.platform || '');
  const arch = String(machine?.arch || '');

  if (runtime === 'mlx') {
    if (platform !== 'darwin') {
      return {
        status: 'incompatible',
        reason: 'MLX runtime is supported only on macOS.',
      };
    }
    if (arch !== 'arm64') {
      return {
        status: 'incompatible',
        reason: 'MLX runtime requires Apple Silicon for optimal Metal acceleration.',
      };
    }
    return {
      status: 'compatible',
      reason: 'Compatible with Apple Silicon + Metal.',
    };
  }

  if (runtime === 'whisper_cpp' || runtime === 'faster_whisper') {
    if (platform === 'darwin' && arch === 'arm64') {
      return {
        status: 'compatible',
        reason: 'Compatible and can leverage Metal-backed acceleration paths.',
      };
    }
    return {
      status: 'compatible',
      reason: 'Compatible on this machine.',
    };
  }

  if (runtime === 'ollama') {
    return {
      status: 'compatible',
      reason: 'Compatible local LLM runtime.',
    };
  }

  return {
    status: 'unknown',
    reason: 'Compatibility rules not defined.',
  };
}

function enrichRuntime(runtime, machine) {
  const compatibility = runtimeCompatibility(runtime.runtime, machine);
  const tasks = TASKS_BY_RUNTIME[runtime.runtime] ?? [];
  const status = compatibility.status === 'incompatible' ? 'incompatible' : runtime.status;
  const installable = runtime.runtime === 'ollama';

  return {
    ...runtime,
    status,
    compatibility,
    tasks,
    installable,
  };
}

function buildRecommendedModels(runtimes) {
  const runtimeByKey = new Map();
  for (const runtime of runtimes) {
    runtimeByKey.set(runtime.runtime, runtime);
  }

  const ollamaModels = new Set(
    (runtimeByKey.get('ollama')?.models || [])
      .map((model) => String(model?.name || '').trim().toLowerCase())
      .filter(Boolean),
  );

  return RECOMMENDED_MODELS.map((model) => {
    const runtime = runtimeByKey.get(model.runtime);
    if (!runtime) {
      return {
        ...model,
        status: 'not_installed',
        reason: `Runtime ${model.runtime} not found.`,
      };
    }

    if (runtime.compatibility?.status === 'incompatible') {
      return {
        ...model,
        status: 'incompatible',
        reason: runtime.compatibility.reason || 'Runtime is incompatible with current machine.',
      };
    }

    if (!runtime.installed) {
      return {
        ...model,
        status: 'not_installed',
        reason: `Runtime ${model.runtime} is not installed.`,
      };
    }

    if (model.runtime === 'ollama') {
      const installed = ollamaModels.has(String(model.id).toLowerCase());
      return {
        ...model,
        status: installed ? 'installed' : 'not_installed',
        reason: installed ? 'Model available in local Ollama store.' : 'Model not yet pulled in Ollama.',
      };
    }

    return {
      ...model,
      status: 'installed',
      reason: `Runtime ${model.runtime} is installed.`,
    };
  });
}

function summarizeDiscovery(runtimes, recommendedModels) {
  const runtimeStatusCounts = {
    installed: 0,
    not_installed: 0,
    incompatible: 0,
    unknown: 0,
  };
  const modelStatusCounts = {
    installed: 0,
    not_installed: 0,
    incompatible: 0,
    needs_update: 0,
    unknown: 0,
  };

  for (const runtime of runtimes) {
    const key = String(runtime.status || 'unknown');
    if (key in runtimeStatusCounts) {
      runtimeStatusCounts[key] += 1;
    } else {
      runtimeStatusCounts.unknown += 1;
    }
  }

  for (const model of recommendedModels) {
    const key = String(model.status || 'unknown');
    if (key in modelStatusCounts) {
      modelStatusCounts[key] += 1;
    } else {
      modelStatusCounts.unknown += 1;
    }
  }

  return {
    runtimeStatusCounts,
    modelStatusCounts,
  };
}

async function main() {
  const machine = {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
  };

  const discoveredRuntimes = await Promise.all([
    discoverOllama(),
    discoverWhisperCpp(),
    discoverFasterWhisper(),
    discoverMlx(),
  ]);
  const runtimes = discoveredRuntimes.map((runtime) => enrichRuntime(runtime, machine));
  const recommendedModels = buildRecommendedModels(runtimes);

  const payload = {
    generatedAt: new Date().toISOString(),
    machine,
    summary: summarizeDiscovery(runtimes, recommendedModels),
    runtimes,
    recommendedModels,
  };

  if (pretty) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

main().catch((error) => {
  process.stderr.write(`model discovery failed: ${String(error?.message ?? error)}\n`);
  process.exit(1);
});
