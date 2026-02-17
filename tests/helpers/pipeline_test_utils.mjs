import assert from 'node:assert/strict';
import { execFile as execFileCb } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..', '..');

export async function run(command, args = [], options = {}) {
  const result = await execFile(command, args, {
    cwd: ROOT_DIR,
    timeout: options.timeout ?? 120000,
    maxBuffer: 1024 * 1024 * 16,
    env: {
      ...process.env,
      ...(options.env || {}),
    },
  });
  return {
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  };
}

export async function commandExists(command) {
  try {
    const { stdout } = await run('which', [command], { timeout: 10000 });
    return Boolean(stdout);
  } catch {
    return false;
  }
}

export async function runNodeScript(scriptRelativePath, args = [], options = {}) {
  const scriptPath = path.resolve(ROOT_DIR, scriptRelativePath);
  return run('node', [scriptPath, ...args], options);
}

export async function ensureSampleVideo({
  fileName = 'pipeline-test-source.mp4',
  durationSeconds = 6,
  width = 1280,
  height = 720,
  fps = 30,
} = {}) {
  const fixturesDir = path.join(ROOT_DIR, 'desktop', 'data', 'test-fixtures');
  await fs.mkdir(fixturesDir, { recursive: true });
  const outputPath = path.join(fixturesDir, fileName);
  const ffmpegAvailable = await commandExists('ffmpeg');
  if (!ffmpegAvailable) {
    throw new Error('ffmpeg is required to generate test fixtures.');
  }

  await run(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `testsrc=size=${width}x${height}:rate=${fps}`,
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=48000',
      '-t',
      String(durationSeconds),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      outputPath,
    ],
    { timeout: 180000 },
  );

  return outputPath;
}

export function randomProjectId(prefix = 'proj-test') {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function assertJsonFile(filePath, message = 'Expected JSON file to exist.') {
  const exists = await fileExists(filePath);
  assert.equal(exists, true, message);
  const payload = await readJson(filePath);
  assert.ok(payload && typeof payload === 'object', 'Expected JSON payload object.');
  return payload;
}
