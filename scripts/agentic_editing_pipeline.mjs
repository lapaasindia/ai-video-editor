#!/usr/bin/env node

/**
 * Agentic Editing Pipeline — Master Orchestrator
 *
 * Runs the full AI-driven editing workflow step-by-step:
 *   1. Transcribe (Sarvam/faster-whisper/Whisper.cpp)
 *   2. AI Cut Planning (Ollama)
 *   3. AI Template Selection (Ollama)
 *   4. AI Stock Media Suggestions (Ollama)
 *   5. Asset Resolution & Download
 *   6. Timeline Assembly
 *
 * Each step writes progress to agent_state.json for UI tracking.
 *
 * Usage:
 *   node scripts/agentic_editing_pipeline.mjs \
 *     --project-id <id> --input <path> \
 *     [--language hi] [--fps 30] [--mode hybrid]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { detectBestLLM } from './lib/llm_provider.mjs';

const execFileAsync = promisify(execFile);

function readArg(flag, fallback = '') {
    const idx = process.argv.indexOf(flag);
    if (idx === -1) return fallback;
    return process.argv[idx + 1] ?? fallback;
}

async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function exists(filePath) {
    try { await fs.access(filePath); return true; } catch { return false; }
}

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Step Runner ──────────────────────────────────────────────────────────────

async function runScriptStep(scriptName, args, timeoutMs = 10 * 60 * 1000) {
    const scriptPath = path.join(ROOT_DIR, 'scripts', scriptName);
    try {
        const { stdout, stderr } = await execFileAsync('node', [scriptPath, ...args], {
            cwd: ROOT_DIR,
            timeout: timeoutMs,
            maxBuffer: 1024 * 1024 * 8,
        });

        if (stderr) console.error(`[${scriptName}]`, stderr.slice(0, 800));

        const output = (stdout ?? '').toString().trim();
        try {
            return JSON.parse(output);
        } catch {
            return { raw: output };
        }
    } catch (e) {
        throw new Error(`Script ${scriptName} failed: ${e.message}`);
    }
}

// ── Main Agent Loop ──────────────────────────────────────────────────────────

async function main() {
    const projectId = readArg('--project-id');
    const input = readArg('--input');
    const language = readArg('--language', 'hi');
    const fps = readArg('--fps', '30');
    const mode = readArg('--mode', 'hybrid');
    const sourceRef = readArg('--source-ref', 'source-video');
    const fetchExternal = readArg('--fetch-external', 'true');
    // Auto-detect best LLM: Codex CLI → OpenAI → Google → Anthropic → Ollama
    const autoLLM = await detectBestLLM();
    const llmProvider = readArg('--llm-provider', process.env.LAPAAS_LLM_PROVIDER || autoLLM.provider);
    const llmModel = readArg('--llm-model', process.env.LAPAAS_LLM_MODEL || autoLLM.model);

    if (!projectId || !input) {
        throw new Error('Missing required args: --project-id and --input');
    }

    const projectDir = readArg('--project-dir') || path.resolve(ROOT_DIR, 'desktop', 'data', projectId);
    const agentStatePath = path.join(projectDir, 'agent_state.json');
    const startedAt = new Date().toISOString();

    const steps = [
        'transcription',
        'high_retention_analysis',
        'timeline_assembly',
    ];

    let currentStepIndex = 0;
    let results = {};

    async function updateProgress(step, status, detail = '') {
        const progress = {
            projectId,
            startedAt,
            currentStep: step,
            currentStepIndex,
            totalSteps: steps.length,
            status,
            detail,
            percent: Math.round((currentStepIndex / steps.length) * 100),
            updatedAt: new Date().toISOString(),
            completedSteps: steps.slice(0, currentStepIndex),
        };
        await writeJson(agentStatePath, progress);
        console.error(`[Agent] Step ${currentStepIndex + 1}/${steps.length}: ${step} — ${status} ${detail}`);
    }

    try {
        // ── Step 1: Transcription ────────────────────────────────────────────────
        currentStepIndex = 0;
        const transcriptPath = path.join(projectDir, 'transcript.json');
        const transcriptExists = await exists(transcriptPath);
        let startEditingResult;

        // Read duration from ingest metadata to skip ffprobe in child script
        let knownDurationSec = 0;
        const metadataPath = path.join(projectDir, 'media', 'metadata.json');
        try {
            const meta = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            knownDurationSec = meta.media?.durationSec ?? 0;
        } catch { /* metadata not available, child will probe */ }

        const transcribeArgs = [
            '--project-id', projectId,
            '--input', input,
            '--mode', mode,
            '--language', language,
            '--fps', fps,
            '--source-ref', sourceRef,
            '--transcription-model', 'sarvam',
            '--llm-provider', llmProvider,
            ...(llmModel ? ['--llm-model', llmModel] : []),
            ...(knownDurationSec > 0 ? ['--duration-sec', String(knownDurationSec)] : []),
        ];

        if (transcriptExists) {
            console.error('[Agent] Transcript already exists — skipping transcription step');
            const existing = JSON.parse(await fs.readFile(transcriptPath, 'utf8'));
            // Stub transcripts always have ':stub' in adapter.engine (e.g. 'api:sarvam:stub')
            // Secondary guard: first word literally 'Mock' (legacy synthetic transcripts)
            const engine = existing.adapter?.engine ?? '';
            const isMock = engine.includes('stub') || existing.words?.[0]?.text === 'Mock';
            if (isMock) {
                console.error('[Agent] Existing transcript is mock — running real transcription with Sarvam');
                await updateProgress('transcription', 'running', 'Transcribing with Sarvam AI...');
                startEditingResult = await runScriptStep('start_editing_pipeline.mjs', transcribeArgs);
            } else {
                await updateProgress('transcription', 'skipped', `Using existing transcript (${existing.segments?.length ?? 0} segments)`);
                startEditingResult = {
                    transcript: existing,
                    removeRanges: [],
                    durationUs: existing.source?.durationUs ?? 0,
                    adapter: existing.adapter?.runtime ?? 'cached',
                };
            }
        } else {
            await updateProgress('transcription', 'running', 'Transcribing with Sarvam AI...');
            startEditingResult = await runScriptStep('start_editing_pipeline.mjs', transcribeArgs);
        }

        results.transcription = {
            segments: startEditingResult.transcript?.segments?.length ?? 0,
            removeRanges: startEditingResult.removeRanges?.length ?? 0,
            durationUs: startEditingResult.durationUs ?? 0,
            adapter: startEditingResult.adapter || 'unknown',
        };

        await updateProgress('transcription', 'done',
            `${results.transcription.segments} segments, ${results.transcription.removeRanges} cuts`
        );

        // ── Step 2: High-Retention Chunk Analysis ────────────────────────────
        // Splits transcript into 2-3 sentence topic chunks (~5-7s each).
        // AI analyses each chunk with 2-min context window and decides:
        //   - Template to show, image/video B-roll query, cut decision
        // Guarantees something happens every 5-7 seconds.
        currentStepIndex = 1;
        await updateProgress('high_retention_analysis', 'running',
            'AI analysing transcript chunks for high-retention editing...');

        const hrResult = await runScriptStep('high_retention_pipeline.mjs', [
            '--project-id', projectId,
            '--project-dir', projectDir,
            '--llm-provider', llmProvider,
            ...(llmModel ? ['--llm-model', llmModel] : []),
        ], 20 * 60 * 1000); // 20 min timeout for full video analysis

        results.highRetention = {
            totalChunks: hrResult.stats?.totalChunks ?? 0,
            keptChunks: hrResult.stats?.keptChunks ?? 0,
            cutChunks: hrResult.stats?.cutChunks ?? 0,
            templates: hrResult.stats?.withTemplate ?? 0,
            images: hrResult.stats?.withImage ?? 0,
            videos: hrResult.stats?.withVideo ?? 0,
        };

        results.templates = {
            count: hrResult.templatePlacements?.length ?? 0,
            placements: (hrResult.templatePlacements || []).map(p => ({
                id: p.id,
                templateName: p.templateName,
                templateId: p.templateId || p.id,
                startUs: p.startUs,
                endUs: p.endUs,
                content: p.content,
                reason: p.aiReason || 'chunk-ai',
            })),
        };

        results.stockMedia = {
            count: hrResult.assetSuggestions?.length ?? 0,
            suggestions: (hrResult.assetSuggestions || []).map(a => ({
                id: a.id,
                query: a.query,
                kind: a.kind,
                startUs: a.startUs,
                endUs: a.endUs,
                provider: a.provider,
                localPath: a.localPath,
                reason: a.aiReason || 'chunk-ai',
            })),
        };

        await updateProgress('high_retention_analysis', 'done',
            `${results.highRetention.keptChunks} chunks kept, ${results.highRetention.cutChunks} cut, ` +
            `${results.templates.count} templates, ${results.stockMedia.count} assets`
        );

        // ── Step 3: Timeline Assembly ─────────────────────────────────────────
        currentStepIndex = 2;
        await updateProgress('timeline_assembly', 'done', 'Timeline enriched with high-retention AI edits');

        // ── Final Summary ─────────────────────────────────────────────────────
        const summary = {
            ok: true,
            projectId,
            startedAt,
            completedAt: new Date().toISOString(),
            steps: results,
            aiDecisions: {
                transcriptionAdapter: results.transcription?.adapter || 'unknown',
                cutsApplied: (results.transcription?.removeRanges || 0) + (results.highRetention?.cutChunks || 0),
                chunksAnalysed: results.highRetention?.totalChunks || 0,
                chunksKept: results.highRetention?.keptChunks || 0,
                chunksCut: results.highRetention?.cutChunks || 0,
                templatesSelected: results.templates?.count || 0,
                stockMediaSuggested: results.stockMedia?.count || 0,
                templateDetails: results.templates?.placements || [],
                stockMediaDetails: results.stockMedia?.suggestions || [],
            },
        };

        await updateProgress('complete', 'done', 'All steps finished');
        await writeJson(path.join(projectDir, 'agentic-edit-result.json'), summary);

        // Pipeline scripts print JSON to stdout for the backend to read
        process.stdout.write(JSON.stringify(summary, null, 2));
    } catch (e) {
        const errorResult = {
            ok: false,
            projectId,
            error: e.message,
            failedStep: steps[currentStepIndex],
            completedSteps: steps.slice(0, currentStepIndex),
        };
        await updateProgress(steps[currentStepIndex] || 'unknown', 'failed', e.message);
        process.stdout.write(JSON.stringify(errorResult, null, 2));
        process.exitCode = 1;
    }
}

main().catch(e => {
    console.error('[Agent] Fatal error:', e);
    process.exitCode = 1;
});
