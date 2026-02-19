#!/usr/bin/env node

/**
 * Standalone cut-planning script.
 * Reads transcript.json from project dir, runs silence detection + cut planning.
 * Outputs cut plan JSON to stdout.
 *
 * Usage:
 *   node scripts/cut_plan_only.mjs \
 *     --project-id <id> \
 *     --input <video-path> \
 *     --source-ref media-xxx
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { validateCutPlan, validateCutRanges } from './lib/pipeline_schema.mjs';

const execFile = promisify(execFileCb);
const DEFAULT_DURATION_US = 10_000_000;
const FILLER_TOKENS = new Set(['um', 'uh', 'erm', 'hmm', 'like']);

function readArg(flag, fallback = '') {
    const idx = process.argv.indexOf(flag);
    if (idx === -1) return fallback;
    return process.argv[idx + 1] ?? fallback;
}

async function run(command, args = [], timeout = 120000) {
    const { stdout } = await execFile(command, args, { timeout, maxBuffer: 1024 * 1024 * 8 });
    return (stdout ?? '').toString().trim();
}

async function runWithOutput(command, args = [], timeout = 120000) {
    const { stdout, stderr } = await execFile(command, args, { timeout, maxBuffer: 1024 * 1024 * 8 });
    return { stdout: (stdout ?? '').toString().trim(), stderr: (stderr ?? '').toString().trim() };
}

async function commandExists(command) {
    const localBin = path.join(process.cwd(), 'bin', command);
    try { await fs.access(localBin, fs.constants.X_OK); return localBin; } catch { }
    try { const out = await run('which', [command], 8000); return out ? out.trim() : false; } catch { return false; }
}

// ── Duration ────────────────────────────────────────────────────────────────

async function getDurationUs(inputPath) {
    const hasFfprobe = await commandExists('ffprobe');
    if (!hasFfprobe) return DEFAULT_DURATION_US;
    try {
        const raw = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath]);
        const sec = Number(raw || '0');
        if (!Number.isFinite(sec) || sec <= 0) return DEFAULT_DURATION_US;
        return Math.round(sec * 1_000_000);
    } catch { return DEFAULT_DURATION_US; }
}

// ── Silence Detection ───────────────────────────────────────────────────────

function secondsToUs(seconds) {
    const value = Number(seconds || 0);
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.round(value * 1_000_000);
}

function parseSilenceRangesFromLog(stderr, durationUs) {
    const rows = String(stderr || '').split('\n').map(r => r.trim()).filter(Boolean);
    const ranges = [];
    let currentStartSec = null;

    for (const row of rows) {
        const startMatch = row.match(/silence_start:\s*([0-9.]+)/);
        if (startMatch) { currentStartSec = Number(startMatch[1]); continue; }
        const endMatch = row.match(/silence_end:\s*([0-9.]+)/);
        if (!endMatch) continue;
        const endSec = Number(endMatch[1]);
        if (!Number.isFinite(endSec)) continue;
        const startSec = Number.isFinite(currentStartSec) ? Number(currentStartSec) : Math.max(0, endSec - 0.35);
        currentStartSec = null;
        const startUs = Math.max(0, Math.min(durationUs, secondsToUs(startSec)));
        const endUs = Math.max(0, Math.min(durationUs, secondsToUs(endSec)));
        if (endUs - startUs < 220_000) continue;
        ranges.push({ startUs, endUs, reason: 'silence', confidence: 0.74 });
    }

    if (Number.isFinite(currentStartSec) && currentStartSec >= 0 && durationUs > 0) {
        const startUs = Math.max(0, Math.min(durationUs, secondsToUs(currentStartSec)));
        if (durationUs - startUs >= 220_000) {
            ranges.push({ startUs, endUs: durationUs, reason: 'silence', confidence: 0.7 });
        }
    }
    return ranges;
}

async function detectSilenceRanges(inputPath, durationUs) {
    const hasFfmpeg = await commandExists('ffmpeg');
    if (!hasFfmpeg) return [];
    try {
        const result = await runWithOutput('ffmpeg', ['-hide_banner', '-i', inputPath, '-af', 'silencedetect=noise=-35dB:d=0.6', '-f', 'null', '-'], 6 * 60 * 1000);
        return parseSilenceRangesFromLog(result.stderr, durationUs);
    } catch (error) {
        const stderr = String(error?.stderr || error?.message || '');
        return parseSilenceRangesFromLog(stderr, durationUs);
    }
}

// ── Cut Planning ────────────────────────────────────────────────────────────

function normalizeFingerprint(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
}

function detectRepetitionRanges(transcriptPayload, durationUs) {
    const seen = new Set();
    const ranges = [];
    for (const segment of (transcriptPayload?.segments || [])) {
        const fp = normalizeFingerprint(segment?.text || '');
        if (fp.length < 14) continue;
        if (!seen.has(fp)) { seen.add(fp); continue; }
        const startUs = Math.max(0, Number(segment?.startUs || 0));
        const endUs = Math.min(durationUs, Math.max(startUs, Number(segment?.endUs || 0)));
        if (endUs - startUs < 300_000) continue;
        ranges.push({ startUs, endUs, reason: 'repetition', confidence: 0.63 });
    }
    return ranges;
}

function clampRanges(ranges, durationUs) {
    const normalized = ranges
        .map(r => ({ startUs: Math.max(0, Math.min(durationUs, Math.round(r.startUs))), endUs: Math.max(0, Math.min(durationUs, Math.round(r.endUs))), reason: r.reason, confidence: r.confidence }))
        .filter(r => r.endUs > r.startUs)
        .sort((a, b) => a.startUs - b.startUs);

    const merged = [];
    for (const range of normalized) {
        const prev = merged[merged.length - 1];
        if (!prev || range.startUs > prev.endUs) { merged.push(range); continue; }
        if (range.endUs > prev.endUs) prev.endUs = range.endUs;
        prev.reason = `${prev.reason},${range.reason}`;
        prev.confidence = Math.max(prev.confidence, range.confidence);
    }
    return merged;
}

function buildHeuristicCutPlan(durationUs, transcriptPayload, { silenceRanges = [] } = {}) {
    const candidates = [];
    let fillerWordCount = 0;

    if (durationUs > 2_000_000) {
        candidates.push({ startUs: 400_000, endUs: 1_050_000, reason: 'intro-silence', confidence: 0.72 });
    }

    for (const word of (transcriptPayload.words || [])) {
        if (!FILLER_TOKENS.has(word.normalized)) continue;
        fillerWordCount++;
        candidates.push({ startUs: Math.max(0, word.startUs - 120_000), endUs: Math.min(durationUs, word.endUs + 120_000), reason: 'filler-word', confidence: 0.64 });
    }

    for (let i = 0; i < (transcriptPayload.segments || []).length - 1; i++) {
        const current = transcriptPayload.segments[i];
        const next = transcriptPayload.segments[i + 1];
        const gap = next.startUs - current.endUs;
        if (gap < 800_000) continue;
        const mid = current.endUs + Math.floor(gap / 2);
        candidates.push({ startUs: Math.max(0, mid - 140_000), endUs: Math.min(durationUs, mid + 140_000), reason: 'long-pause', confidence: 0.67 });
    }

    if (durationUs > 8_000_000) {
        const mid = Math.round(durationUs * 0.48);
        candidates.push({ startUs: Math.max(0, mid - 250_000), endUs: Math.min(durationUs, mid + 250_000), reason: 'filler-pause', confidence: 0.66 });
    }

    const normalizedSilence = (silenceRanges || [])
        .map(r => ({ startUs: Number(r?.startUs || 0), endUs: Number(r?.endUs || 0), reason: 'silence', confidence: Number(r?.confidence || 0.72) }))
        .filter(r => r.endUs > r.startUs)
        // Only cut silences longer than 800ms, and add 150ms padding on each side
        .filter(r => (r.endUs - r.startUs) > 800_000)
        .map(r => ({ ...r, startUs: r.startUs + 150_000, endUs: r.endUs - 150_000 }))
        .filter(r => r.endUs > r.startUs);
    candidates.push(...normalizedSilence);
    candidates.push(...detectRepetitionRanges(transcriptPayload, durationUs));

    return {
        removeRanges: clampRanges(candidates, durationUs),
        analysis: { silenceRangeCount: normalizedSilence.length, fillerWordCount, repetitionCount: detectRepetitionRanges(transcriptPayload, durationUs).length },
    };
}

// ── LLM Cut Planning ────────────────────────────────────────────────────────

import { runLLMPrompt, extractJsonFromLLMOutput } from './lib/llm_provider.mjs';

async function generateCutPlanWithLLM(transcriptPayload, llmConfig) {
    const simplified = (transcriptPayload.segments || []).map(s => ({ startUs: s.startUs, endUs: s.endUs, text: s.text }));
    const prompt = `You are an expert video editor AI. Analyze this transcript deeply.

Transcript segments:
${JSON.stringify(simplified, null, 1)}

Your tasks:
1. Identify sections to CUT (remove) - filler words, long pauses, repetitions, off-topic tangents
2. Label each remaining section with a type: intro, key-point, example, transition, conclusion, tangent

Respond ONLY with this JSON (no markdown, no explanation):
{
  "removeRanges": [
    { "startUs": 0, "endUs": 0, "reason": "filler-word|silence|repetition|tangent", "confidence": 0.9 }
  ]
}`;

    console.error(`[LLM] Generating cut plan with ${llmConfig.provider}/${llmConfig.model}...`);
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await runLLMPrompt(llmConfig, prompt, 180000);
            const result = extractJsonFromLLMOutput(response);
            if (!Array.isArray(result.removeRanges)) result.removeRanges = [];
            console.error(`[LLM] AI analysis: ${result.removeRanges.length} cuts`);
            return result;
        } catch (e) {
            console.error(`[LLM] Attempt ${attempt} failed: ${e.message}`);
            if (attempt === 2) throw e;
        }
    }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const projectId = readArg('--project-id');
    const input = readArg('--input');
    const sourceRef = readArg('--source-ref', 'source-video') || 'source-video';
    const mode = readArg('--mode', 'heuristic') || 'heuristic';
    const llmProvider = readArg('--llm-provider', process.env.LAPAAS_LLM_PROVIDER || 'ollama');
    const llmModel = readArg('--llm-model', process.env.LAPAAS_LLM_MODEL || 'qwen3:1.7b');

    if (!projectId) throw new Error('Missing --project-id');
    if (!input) throw new Error('Missing --input');

    const inputPath = path.resolve(input);
    const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
    const transcriptPath = path.join(projectDir, 'transcript.json');
    const cutPlanPath = path.join(projectDir, 'cut-plan.json');

    // 1. Read transcript
    let transcriptPayload;
    try {
        const raw = await fs.readFile(transcriptPath, 'utf8');
        transcriptPayload = JSON.parse(raw);
    } catch (e) {
        throw new Error(`Cannot read transcript.json: ${e.message}. Run transcribe_only.mjs first.`);
    }

    // 2. Get video duration
    const durationUs = transcriptPayload.source?.durationUs || await getDurationUs(inputPath);

    // 3. Detect silence
    console.error('[CutPlan] Detecting silence ranges...');
    const silenceRanges = await detectSilenceRanges(inputPath, durationUs);
    console.error(`[CutPlan] Found ${silenceRanges.length} silence ranges`);

    // 4. Generate cut plan
    let removeRanges;
    let cutAnalysis;
    const isLLM = mode !== 'heuristic';

    if (isLLM) {
        try {
            const llmResult = await generateCutPlanWithLLM(transcriptPayload, { provider: llmProvider, model: llmModel });
            removeRanges = validateCutRanges(clampRanges(llmResult.removeRanges || [], durationUs), durationUs);
            cutAnalysis = { silenceRangeCount: 0, fillerWordCount: 0, repetitionCount: 0, note: 'Generated by LLM' };
        } catch (e) {
            console.error('[CutPlan] LLM failed, falling back to heuristic:', e.message);
            const planned = buildHeuristicCutPlan(durationUs, transcriptPayload, { silenceRanges });
            removeRanges = validateCutRanges(planned.removeRanges, durationUs);
            cutAnalysis = planned.analysis;
        }
    } else {
        const planned = buildHeuristicCutPlan(durationUs, transcriptPayload, { silenceRanges });
        removeRanges = validateCutRanges(planned.removeRanges, durationUs);
        cutAnalysis = planned.analysis;
    }

    // 5. Build cut plan payload
    const cutPlanPayload = validateCutPlan({
        planId: `cp-${Date.now()}`,
        projectId,
        createdAt: new Date().toISOString(),
        mode,
        fallbackPolicy: 'heuristic',
        sourceRef,
        planner: { model: isLLM ? llmModel : 'heuristic', strategy: isLLM ? 'llm-cut-planner' : 'heuristic-cut-planner-v1' },
        analysis: cutAnalysis,
        removeRanges,
        rationale: removeRanges.map(r => ({ startUs: r.startUs, endUs: r.endUs, reason: r.reason, confidence: r.confidence })),
    }, durationUs);

    // 6. Write cut plan
    await fs.mkdir(path.dirname(cutPlanPath), { recursive: true });
    await fs.writeFile(cutPlanPath, JSON.stringify(cutPlanPayload, null, 2) + '\n', 'utf8');

    // 7. Output
    process.stdout.write(JSON.stringify({
        ok: true,
        projectId,
        durationUs,
        cutPlanPath,
        removeRangeCount: removeRanges.length,
        analysis: cutAnalysis,
        removeRanges,
    }, null, 2) + '\n');
}

main().catch(e => { process.stderr.write(`${e.message}\n`); process.exit(1); });
