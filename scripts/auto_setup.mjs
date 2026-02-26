#!/usr/bin/env node

/**
 * Auto-Setup Script
 *
 * Runs automatically on app startup. Detects and installs all missing
 * dependencies so the user needs ZERO technical know-how.
 *
 * What it handles:
 *  1. Node modules (npm install if node_modules missing or outdated)
 *  2. Homebrew (installs if missing on macOS)
 *  3. ffmpeg + ffprobe (via brew)
 *  4. Ollama (via brew)
 *  5. Pull default Ollama model (qwen3:1.7b)
 *  6. Create required data directories
 *  7. Create .env file if missing
 *
 * Safe to run multiple times — skips anything already installed.
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile as execFileCb, exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCb);
const exec = promisify(execCb);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const LOG_PREFIX = '[auto-setup]';
function log(msg) { process.stderr.write(`${LOG_PREFIX} ${msg}\n`); }
function logOk(msg) { process.stderr.write(`${LOG_PREFIX} ✓ ${msg}\n`); }
function logWarn(msg) { process.stderr.write(`${LOG_PREFIX} ⚠ ${msg}\n`); }
function logInstall(msg) { process.stderr.write(`${LOG_PREFIX} ⬇ ${msg}\n`); }

// ── Helpers ──────────────────────────────────────────────────────────────────

async function commandExists(cmd) {
    try {
        const { stdout } = await execFile('which', [cmd], { timeout: 5000 });
        return stdout.trim() || false;
    } catch { return false; }
}

async function runShell(cmd, opts = {}) {
    const timeout = opts.timeout || 300_000; // 5 min default
    try {
        const { stdout, stderr } = await exec(cmd, {
            timeout,
            maxBuffer: 50 * 1024 * 1024,
            env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: '1' },
            ...opts,
        });
        return { ok: true, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() };
    } catch (err) {
        return { ok: false, stdout: '', stderr: String(err?.message || err) };
    }
}

// ── 1. Node Modules ─────────────────────────────────────────────────────────

async function ensureNodeModules() {
    const nodeModules = path.join(ROOT, 'node_modules');
    const packageJson = path.join(ROOT, 'package.json');

    if (!existsSync(nodeModules) || !existsSync(path.join(nodeModules, '.package-lock.json'))) {
        logInstall('Installing Node dependencies (npm install)...');
        const result = await runShell('npm install --prefer-offline --no-audit --no-fund', {
            cwd: ROOT,
            timeout: 600_000, // 10 min
        });
        if (!result.ok) {
            logWarn(`npm install had issues: ${result.stderr.slice(0, 200)}`);
        } else {
            logOk('Node modules installed');
        }
    } else {
        logOk('Node modules present');
    }
}

// ── 2. Homebrew ─────────────────────────────────────────────────────────────

async function ensureHomebrew() {
    if (process.platform !== 'darwin') return;

    if (await commandExists('brew')) {
        logOk('Homebrew installed');
        return;
    }

    logInstall('Installing Homebrew (this may take a minute)...');
    const result = await runShell(
        '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
        { timeout: 600_000 }
    );

    if (!result.ok) {
        logWarn('Could not auto-install Homebrew. Please install it manually: https://brew.sh');
    } else {
        // Add brew to PATH for this session
        const brewPaths = ['/opt/homebrew/bin', '/usr/local/bin'];
        for (const bp of brewPaths) {
            if (existsSync(path.join(bp, 'brew')) && !process.env.PATH.includes(bp)) {
                process.env.PATH = `${bp}:${process.env.PATH}`;
            }
        }
        logOk('Homebrew installed');
    }
}

// ── 3. ffmpeg ───────────────────────────────────────────────────────────────

async function ensureFFmpeg() {
    if (await commandExists('ffmpeg') && await commandExists('ffprobe')) {
        logOk('ffmpeg + ffprobe installed');
        return;
    }

    if (process.platform !== 'darwin') {
        logWarn('ffmpeg not found. Please install ffmpeg for your platform.');
        return;
    }

    if (!(await commandExists('brew'))) {
        logWarn('Cannot auto-install ffmpeg without Homebrew.');
        return;
    }

    logInstall('Installing ffmpeg via Homebrew (this may take a few minutes)...');
    const result = await runShell('brew install ffmpeg', { timeout: 600_000 });
    if (!result.ok) {
        logWarn(`ffmpeg install issue: ${result.stderr.slice(0, 200)}`);
    } else {
        logOk('ffmpeg installed');
    }
}

// ── 4. Ollama ───────────────────────────────────────────────────────────────

async function ensureOllama() {
    if (await commandExists('ollama')) {
        logOk('Ollama installed');
        return true;
    }

    if (process.platform !== 'darwin') {
        logWarn('Ollama not found. Please install from https://ollama.ai');
        return false;
    }

    // Try brew first
    if (await commandExists('brew')) {
        logInstall('Installing Ollama via Homebrew...');
        const result = await runShell('brew install ollama', { timeout: 300_000 });
        if (result.ok && await commandExists('ollama')) {
            logOk('Ollama installed via Homebrew');
            return true;
        }
    }

    // Try direct download
    logInstall('Installing Ollama via direct download...');
    const result = await runShell('curl -fsSL https://ollama.ai/install.sh | sh', { timeout: 300_000 });
    if (result.ok && await commandExists('ollama')) {
        logOk('Ollama installed');
        return true;
    }

    logWarn('Could not auto-install Ollama. Please install from https://ollama.ai');
    return false;
}

// ── 5. Ollama Model ─────────────────────────────────────────────────────────

async function ensureOllamaModel(model = 'qwen3:1.7b') {
    // Check if Ollama is running
    try {
        const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        if (!resp.ok) throw new Error('not ok');
        const data = await resp.json();
        const models = (data.models || []).map(m => m.name);
        if (models.some(m => m === model || m.startsWith(model.split(':')[0]))) {
            logOk(`Ollama model ${model} available`);
            return;
        }
    } catch {
        // Ollama not running, try to start it
        log('Starting Ollama service...');
        // On macOS, Ollama app auto-starts the service. Try launching it.
        if (process.platform === 'darwin') {
            await runShell('open -a Ollama 2>/dev/null || ollama serve &', { timeout: 10_000 }).catch(() => {});
            // Wait for it to come up
            for (let i = 0; i < 10; i++) {
                await new Promise(r => setTimeout(r, 2000));
                try {
                    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
                    if (r.ok) break;
                } catch { /* keep waiting */ }
            }
        }
    }

    // Pull the model
    logInstall(`Pulling Ollama model ${model} (this may take a few minutes on first run)...`);
    const result = await runShell(`ollama pull ${model}`, { timeout: 600_000 });
    if (result.ok) {
        logOk(`Model ${model} pulled`);
    } else {
        logWarn(`Could not pull ${model}: ${result.stderr.slice(0, 200)}`);
    }
}

// ── 6. Data Directories ─────────────────────────────────────────────────────

async function ensureDirectories() {
    const dirs = [
        path.join(ROOT, 'desktop', 'data'),
        path.join(ROOT, 'desktop', 'data', 'assets'),
        path.join(os.tmpdir(), 'lapaas-ai-editor'),
    ];

    for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
    }
    logOk('Data directories ready');
}

// ── 7. Env File ─────────────────────────────────────────────────────────────

async function ensureEnvFile() {
    const envPath = path.join(ROOT, '.env');
    if (existsSync(envPath)) {
        logOk('.env file present');
        return;
    }

    const template = `# Lapaas AI Editor — Environment Variables
# Add your API keys below. The app will auto-detect available providers.

# OpenAI (for GPT-5 Mini / Codex fallback)
# OPENAI_API_KEY=sk-...

# Sarvam AI (for Hindi transcription)
# SARVAM_API_KEY=...

# Google Gemini (optional)
# GOOGLE_API_KEY=...

# Anthropic Claude (optional)
# ANTHROPIC_API_KEY=...

# Pexels (for stock footage)
# PEXELS_API_KEY=...

# Pixabay (for stock footage)
# PIXABAY_API_KEY=...
`;

    await fs.writeFile(envPath, template, 'utf8');
    logOk('.env template created — add your API keys to enable cloud features');
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function autoSetup({ silent = false } = {}) {
    const start = Date.now();
    if (!silent) log('Running auto-setup checks...');

    try {
        // Phase 1: Quick checks (parallel)
        await ensureDirectories();
        await ensureEnvFile();

        // Phase 2: Node modules
        await ensureNodeModules();

        // Phase 3: System deps (sequential — may need brew first)
        await ensureHomebrew();
        await ensureFFmpeg();

        // Phase 4: Ollama + model
        const ollamaInstalled = await ensureOllama();
        if (ollamaInstalled) {
            await ensureOllamaModel('qwen3:1.7b');
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        if (!silent) log(`Auto-setup complete in ${elapsed}s`);

        return { ok: true, elapsed };
    } catch (err) {
        logWarn(`Auto-setup error: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

// ── CLI entry point ─────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
    autoSetup().then(result => {
        if (!result.ok) process.exit(1);
    });
}
