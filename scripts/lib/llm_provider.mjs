/**
 * Unified LLM Provider Abstraction
 *
 * Supports:
 *  - ollama     (local, any model including Airavata)
 *  - openai     (cloud, GPT-4o / GPT-4o-mini / GPT-3.5)
 *  - google     (cloud, Gemini 2.0 Flash / 1.5 Pro)
 *  - anthropic  (cloud, Claude Sonnet / Haiku)
 *  - sarvam     (cloud, Sarvam-M — Hindi-optimized)
 *
 * Usage:
 *   import { runLLMPrompt, getAvailableModels } from './lib/llm_provider.mjs';
 *   const response = await runLLMPrompt({ provider: 'ollama', model: 'qwen3:1.7b' }, prompt);
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

// ── Provider Catalog ────────────────────────────────────────────────────────

export const PROVIDER_CATALOG = {
    codex: {
        label: 'OpenAI Codex CLI',
        type: 'local-cli',
        envKey: 'OPENAI_API_KEY',
        models: [
            { id: 'gpt-5.2', label: 'GPT-5.2 (Default)', default: true },
            { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
            { id: 'o4-mini', label: 'o4-mini' },
            { id: 'o3', label: 'o3 (Reasoning)' },
        ],
    },
    ollama: {
        label: 'Ollama (Local)',
        type: 'local',
        envKey: null,
        models: [
            { id: 'qwen3:1.7b', label: 'Qwen3 1.7B (Fast, Hindi OK)', default: true },
            { id: 'qwen3:4b', label: 'Qwen3 4B (Better quality)' },
            { id: 'qwen3:8b', label: 'Qwen3 8B (High quality)' },
            { id: 'qwen3:14b', label: 'Qwen3 14B (Best quality)' },
            { id: 'qwen3:32b', label: 'Qwen3 32B (Premium)' },
            { id: 'llama3.3:70b', label: 'Llama 3.3 70B' },
            { id: 'llama3.2:3b', label: 'Llama 3.2 3B' },
            { id: 'llama3.2:1b', label: 'Llama 3.2 1B (Ultra fast)' },
            { id: 'llama3.1:8b', label: 'Llama 3.1 8B' },
            { id: 'gemma3:4b', label: 'Gemma 3 4B' },
            { id: 'gemma3:12b', label: 'Gemma 3 12B' },
            { id: 'gemma3:27b', label: 'Gemma 3 27B' },
            { id: 'phi4:14b', label: 'Phi-4 14B (Microsoft)' },
            { id: 'mistral:7b', label: 'Mistral 7B' },
            { id: 'mixtral:8x7b', label: 'Mixtral 8x7B' },
            { id: 'deepseek-r1:7b', label: 'DeepSeek R1 7B' },
            { id: 'deepseek-r1:14b', label: 'DeepSeek R1 14B' },
            { id: 'command-r:35b', label: 'Command R 35B (Cohere)' },
            { id: 'aya:8b', label: 'Aya 8B (Cohere, Hindi + 23 languages)' },
            { id: 'custom', label: 'Custom model...' },
        ],
    },
    openai: {
        label: 'OpenAI',
        type: 'cloud',
        envKey: 'OPENAI_API_KEY',
        models: [
            { id: 'gpt-4o', label: 'GPT-4o (Flagship)', default: true },
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast, affordable)' },
            { id: 'gpt-4.1', label: 'GPT-4.1 (Latest)' },
            { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
            { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (Fastest)' },
            { id: 'o3', label: 'o3 (Reasoning)' },
            { id: 'o3-mini', label: 'o3-mini (Fast reasoning)' },
            { id: 'o4-mini', label: 'o4-mini (Latest reasoning)' },
            { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Legacy, cheapest)' },
        ],
    },
    google: {
        label: 'Google Gemini',
        type: 'cloud',
        envKey: 'GOOGLE_API_KEY',
        models: [
            { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash (Latest)', default: true },
            { id: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro (Best quality)' },
            { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
            { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (Fastest)' },
            { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
            { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
            { id: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B (Cheapest)' },
        ],
    },
    anthropic: {
        label: 'Anthropic',
        type: 'cloud',
        envKey: 'ANTHROPIC_API_KEY',
        models: [
            { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Best balance)', default: true },
            { id: 'claude-opus-4-20250514', label: 'Claude Opus 4 (Most capable)' },
            { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
            { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet v2' },
            { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fastest)' },
            { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
            { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Legacy fast)' },
        ],
    },
    sarvam: {
        label: 'Sarvam AI',
        type: 'cloud',
        envKey: 'SARVAM_API_KEY',
        models: [
            { id: 'sarvam-m', label: 'Sarvam-M (Hindi-optimized)', default: true },
        ],
    },
};

export function getAvailableModels(provider) {
    const catalog = PROVIDER_CATALOG[provider];
    if (!catalog) return [];
    return catalog.models;
}

export function getDefaultModel(provider) {
    const models = getAvailableModels(provider);
    const def = models.find(m => m.default);
    return def ? def.id : models[0]?.id || '';
}

export function getProviderType(provider) {
    return PROVIDER_CATALOG[provider]?.type || 'local';
}

// Cache codex availability so we don't shell out on every call
let _codexAvailable = null;

export async function isCodexAvailable() {
    if (_codexAvailable !== null) return _codexAvailable;
    return new Promise((resolve) => {
        execFile('which', ['codex'], (err) => {
            if (!err) { _codexAvailable = true; resolve(true); return; }
            // Also check npx @openai/codex availability via OPENAI_API_KEY presence
            // (npx can run it but we need the key)
            _codexAvailable = false;
            resolve(false);
        });
    });
}

export function isProviderAvailable(provider) {
    const catalog = PROVIDER_CATALOG[provider];
    if (!catalog) return false;
    if (catalog.type === 'local') return true; // Assumed available if Ollama running
    if (catalog.type === 'local-cli') return true; // Codex uses ChatGPT login (no API key needed)
    return Boolean(process.env[catalog.envKey]);
}

// ── LLM Execution ───────────────────────────────────────────────────────────

// Fallback chain: if a model is unavailable/errors, try the next one
const CODEX_MODEL_FALLBACKS = ['gpt-5.2', 'gpt-5.3-codex', 'o4-mini', 'o3'];

function runCodexWithModel(model, prompt, timeoutMs) {
    return new Promise((resolve, reject) => {
        const args = ['exec', '--sandbox', 'workspace-write'];

        // Only override model if it differs from config.toml default (gpt-5.2)
        if (model && model !== 'gpt-5.2') {
            args.push('-m', model);
        }

        args.push(prompt);

        const child = execFile('codex', args, {
            env: { ...process.env },
            maxBuffer: 10 * 1024 * 1024,
            cwd: process.cwd(),
        }, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(`Codex CLI error (${model}): ${err.message}\n${stderr}`));
                return;
            }
            
            // Codex CLI outputs a preamble and tokens used at the end.
            // We want just the actual response block.
            let output = stdout.trim();
            
            // Strip out preamble:
            // --------
            // workdir: ...
            // --------
            // user
            // <prompt>
            // codex
            const codexHeaderIndex = output.indexOf('\ncodex\n');
            if (codexHeaderIndex !== -1) {
                output = output.slice(codexHeaderIndex + 7);
            }

            // Strip out suffix:
            // tokens used
            // 1,580
            // <duplicate final answer>
            const tokensUsedIndex = output.indexOf('\ntokens used\n');
            if (tokensUsedIndex !== -1) {
                output = output.slice(0, tokensUsedIndex);
            }

            resolve(output.trim());
        });

        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`Codex CLI timed out after ${timeoutMs}ms (model: ${model})`));
        }, timeoutMs);

        child.on('close', () => clearTimeout(timer));
    });
}

async function runCodex(model, prompt, timeoutMs) {
    // Build fallback chain starting from the requested model
    const startIdx = CODEX_MODEL_FALLBACKS.indexOf(model);
    const chain = startIdx >= 0
        ? CODEX_MODEL_FALLBACKS.slice(startIdx)
        : [model, ...CODEX_MODEL_FALLBACKS];

    let lastError;
    for (const m of chain) {
        try {
            console.error(`[Codex] Trying model: ${m}`);
            const result = await runCodexWithModel(m, prompt, timeoutMs);
            if (m !== model) {
                console.error(`[Codex] Fell back to ${m} (${model} unavailable)`);
            }
            return result;
        } catch (e) {
            lastError = e;
            const msg = e.message || '';
            // Only fall back on model-unavailable errors, not on logic/timeout errors
            const isModelError = msg.includes('model') || msg.includes('not found') ||
                msg.includes('unavailable') || msg.includes('does not exist') ||
                msg.includes('invalid model');
            if (!isModelError) throw e; // Hard error — don't retry
            console.error(`[Codex] ${m} failed: ${msg.slice(0, 120)} — trying next model...`);
        }
    }
    throw lastError;
}

async function runOllama(model, prompt, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false,
                options: {
                    num_ctx: 8192, // Increased context window
                    temperature: 0.3
                }
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Ollama API error (${res.status}): ${text}`);
        }

        const data = await res.json();
        return data.response || '';
    } catch (e) {
        if (e.name === 'AbortError') {
            throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
        }
        // Fallback check: is Ollama running?
        const isConnRefused = e.message.includes('ECONNREFUSED');
        if (isConnRefused) {
            throw new Error('Ollama is not running. Please start Ollama (http://127.0.0.1:11434).');
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

async function runOpenAI(model, prompt, timeoutMs) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 4096,
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`OpenAI API error (${res.status}): ${text}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    } finally {
        clearTimeout(timeout);
    }
}

async function runGoogle(model, prompt, timeoutMs) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY not set');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Google Gemini API error (${res.status}): ${text}`);
        }

        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } finally {
        clearTimeout(timeout);
    }
}

async function runAnthropic(model, prompt, timeoutMs) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }],
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Anthropic API error (${res.status}): ${text}`);
        }

        const data = await res.json();
        return data.content?.[0]?.text || '';
    } finally {
        clearTimeout(timeout);
    }
}

async function runSarvam(model, prompt, timeoutMs) {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) throw new Error('SARVAM_API_KEY not set');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch('https://api.sarvam.ai/v2/text/chat', {
            method: 'POST',
            headers: {
                'api-subscription-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'sarvam-m',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4096,
                temperature: 0.3,
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Sarvam API error (${res.status}): ${text}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    } finally {
        clearTimeout(timeout);
    }
}

// ── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run a prompt against any configured LLM provider.
 *
 * @param {{ provider: string, model: string }} config
 * @param {string} prompt
 * @param {number} [timeoutMs=180000]
 * @returns {Promise<string>}
 */
export async function runLLMPrompt(config, prompt, timeoutMs = 180000) {
    const provider = (config?.provider || 'ollama').toLowerCase();
    const model = config?.model || getDefaultModel(provider);

    console.error(`[LLM] Provider: ${provider}, Model: ${model}`);

    switch (provider) {
        case 'codex':
            await isCodexAvailable(); // warm the cache
            return runCodex(model, prompt, timeoutMs);
        case 'ollama':
            return runOllama(model, prompt, timeoutMs);
        case 'openai':
            return runOpenAI(model, prompt, timeoutMs);
        case 'google':
            return runGoogle(model, prompt, timeoutMs);
        case 'anthropic':
            return runAnthropic(model, prompt, timeoutMs);
        case 'sarvam':
            return runSarvam(model, prompt, timeoutMs);
        default:
            throw new Error(`Unknown LLM provider: ${provider}. Use: codex, ollama, openai, google, anthropic, sarvam`);
    }
}

/**
 * Extract JSON from LLM output, handling markdown code blocks and extra text.
 * Finds the largest valid JSON object/array — important for Codex CLI which
 * wraps the actual response in a session log with many small JSON fragments.
 */
export function extractJsonFromLLMOutput(text) {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Find all candidate JSON blocks (objects and arrays), pick the largest valid one
    const candidates = [];

    for (const startChar of ['{', '[']) {
        const endChar = startChar === '{' ? '}' : ']';
        let idx = 0;
        while (idx < cleaned.length) {
            const start = cleaned.indexOf(startChar, idx);
            if (start === -1) break;

            // Walk forward to find matching close bracket
            let depth = 0;
            let inString = false;
            let escape = false;
            let end = -1;
            for (let i = start; i < cleaned.length; i++) {
                const ch = cleaned[i];
                if (escape) { escape = false; continue; }
                if (ch === '\\' && inString) { escape = true; continue; }
                if (ch === '"') { inString = !inString; continue; }
                if (inString) continue;
                if (ch === startChar) depth++;
                else if (ch === endChar) {
                    depth--;
                    if (depth === 0) { end = i; break; }
                }
            }

            if (end !== -1) {
                const candidate = cleaned.slice(start, end + 1);
                try {
                    const parsed = JSON.parse(candidate);
                    candidates.push({ parsed, length: candidate.length });
                } catch { /* not valid JSON */ }
            }
            idx = start + 1;
        }
    }

    if (candidates.length === 0) {
        throw new Error('No valid JSON found in LLM output');
    }

    // Return the largest valid JSON (most likely to be the actual response)
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0].parsed;
}

/**
 * Auto-detect the best available LLM provider.
 * Priority: Codex CLI → OpenAI → Google → Anthropic → Ollama (local)
 *
 * @returns {Promise<{ provider: string, model: string }>}
 */
export async function detectBestLLM() {
    // Honour explicit env override first
    if (process.env.LAPAAS_LLM_PROVIDER) {
        const provider = process.env.LAPAAS_LLM_PROVIDER;
        const model = process.env.LAPAAS_LLM_MODEL || getDefaultModel(provider);
        console.error(`[LLM] Using env override: ${provider}/${model}`);
        return { provider, model };
    }

    // 1. OpenAI API directly (if key set)
    if (process.env.OPENAI_API_KEY) {
        console.error('[LLM] Using OpenAI API (gpt-4o-mini)');
        return { provider: 'openai', model: 'gpt-4o-mini' };
    }

    // 2. Google Gemini
    if (process.env.GOOGLE_API_KEY) {
        console.error('[LLM] Using Google Gemini (gemini-2.0-flash)');
        return { provider: 'google', model: 'gemini-2.0-flash' };
    }

    // 3. Anthropic Claude
    if (process.env.ANTHROPIC_API_KEY) {
        console.error('[LLM] Using Anthropic Claude (claude-3-5-haiku-20241022)');
        return { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' };
    }

    // 4. Codex CLI — uses ChatGPT login, no API key needed
    if (await isCodexAvailable()) {
        console.error('[LLM] Using Codex CLI (gpt-5.2 via ChatGPT login)');
        return { provider: 'codex', model: 'gpt-5.2' };
    }

    // 5. Ollama local — always available as last resort
    console.error('[LLM] Using Ollama local (qwen3:1.7b)');
    return { provider: 'ollama', model: 'qwen3:1.7b' };
}

/**
 * Returns the full catalog for serialization to the frontend.
 */
export function getProviderCatalog() {
    return Object.entries(PROVIDER_CATALOG).map(([key, val]) => ({
        id: key,
        label: val.label,
        type: val.type,
        available: isProviderAvailable(key),
        models: val.models,
    }));
}
