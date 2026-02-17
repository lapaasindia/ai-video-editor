#!/usr/bin/env node

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return '';
  return process.argv[idx + 1] ?? '';
}

async function run(command, args = []) {
  const { stdout, stderr } = await execFile(command, args, {
    timeout: 30 * 60 * 1000,
    maxBuffer: 1024 * 1024 * 4,
  });
  return {
    stdout: (stdout ?? '').toString().trim(),
    stderr: (stderr ?? '').toString().trim(),
  };
}

async function commandExists(command) {
  try {
    const result = await run('which', [command]);
    return Boolean(result.stdout);
  } catch {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

async function installOllamaModel(model, steps) {
  if (!model) {
    throw new Error('Missing required --model value for Ollama install.');
  }

  const ollamaInstalled = await commandExists('ollama');
  if (!ollamaInstalled) {
    throw new Error('Runtime `ollama` is not installed or not available in PATH.');
  }

  steps.push({
    stage: 'runtime-check',
    status: 'done',
    at: nowIso(),
    detail: 'Ollama runtime detected.',
  });

  steps.push({
    stage: 'model-pull',
    status: 'started',
    at: nowIso(),
    detail: `Pulling model ${model}`,
  });

  const commandResult = await run('ollama', ['pull', model]);

  steps.push({
    stage: 'model-pull',
    status: 'done',
    at: nowIso(),
    detail: `Model ${model} pull finished.`,
  });

  return commandResult;
}

function usage() {
  process.stdout.write(
    [
      'Usage:',
      '  node scripts/model_runtime_install.mjs --runtime ollama --model llama3.2:3b',
      '',
      'Supported runtimes:',
      '  ollama',
    ].join('\n'),
  );
  process.stdout.write('\n');
}

async function main() {
  const runtime = readArg('--runtime');
  const model = readArg('--model');
  const startedAt = nowIso();
  const steps = [
    {
      stage: 'validate-input',
      status: 'done',
      at: startedAt,
      detail: 'Install request validated.',
    },
  ];

  if (!runtime) {
    usage();
    throw new Error('Missing required --runtime argument.');
  }

  let commandOutput = {
    stdout: '',
    stderr: '',
  };

  if (runtime === 'ollama') {
    commandOutput = await installOllamaModel(model, steps);
  } else {
    throw new Error(`Unsupported runtime: ${runtime}`);
  }

  const completedAt = nowIso();
  const payload = {
    ok: true,
    runtime,
    model: model || '',
    startedAt,
    completedAt,
    steps,
    status: 'installed',
    output: commandOutput.stdout,
    diagnostics: {
      stderr: commandOutput.stderr,
    },
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
