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
            maxBuffer: 1024 * 1024 * 64,
        });

        if (stderr) console.error(`[${scriptName}]`, stderr.slice(0, 800));

        const output = (stdout ?? '').toString().trim();
        if (!output) {
            throw new Error(`Script returned empty output. Stderr: ${stderr}`);
        }
        
        // Try direct parse first, then extract last JSON object/array from mixed output
        try {
            return JSON.parse(output);
        } catch (_directParseErr) {
            // Scripts may mix log lines (e.g. [Diarize]) with JSON — extract last { or [ block
            const jsonMatch = output.match(/[\s\S]*(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[1]);
                } catch (_) { /* fall through */ }
            }
            throw new Error(`Script output was not valid JSON. Output: ${output.slice(0, 500)}...`);
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
    // Auto-detect best LLM only if not provided by user/frontend
    const requestedProvider = readArg('--llm-provider');
    const requestedModel = readArg('--llm-model');
    const autoLLM = requestedProvider ? null : await detectBestLLM();
    const llmProvider = requestedProvider || process.env.LAPAAS_LLM_PROVIDER || autoLLM?.provider || 'ollama';
    const llmModel = requestedModel || process.env.LAPAAS_LLM_MODEL || autoLLM?.model || 'qwen3:1.7b';

    if (!projectId || !input) {
        throw new Error('Missing required args: --project-id and --input');
    }

    const projectDir = readArg('--project-dir') || path.resolve(ROOT_DIR, 'desktop', 'data', projectId);
    const agentStatePath = path.join(projectDir, 'agent_state.json');
    const startedAt = new Date().toISOString();

    const steps = [
        'transcription',
        'transcript_annotation',
        'semantic_chunking',
        'high_retention_analysis',
        'chunk_qc',
        'asset_quality',
        'cut_safety_review',
        'seam_quality',
        'cross_chunk_review',
        'global_analysis',
        'pre_render_qa',
        'timeline_assembly',
    ];

    const stepLabels = {
        transcription: 'Transcription',
        transcript_annotation: 'Transcript Annotation',
        semantic_chunking: 'Semantic Chunking',
        high_retention_analysis: 'High-Retention Analysis',
        chunk_qc: 'Chunk Quality Control',
        asset_quality: 'Asset Quality Gate',
        cut_safety_review: 'Cut Safety Review',
        seam_quality: 'Seam Quality Analysis',
        cross_chunk_review: 'Cross-Chunk Consistency',
        global_analysis: 'Global Video Intelligence',
        pre_render_qa: 'Pre-Render QA',
        timeline_assembly: 'Timeline Assembly',
    };

    let currentStepIndex = 0;
    let results = {};
    const stageLog = [];

    async function updateProgress(step, status, detail = '', subStage = '') {
        const entry = {
            step,
            label: stepLabels[step] || step,
            stepIndex: currentStepIndex,
            status,
            detail,
            subStage,
            timestamp: new Date().toISOString(),
        };
        stageLog.push(entry);

        const progress = {
            projectId,
            startedAt,
            currentStep: step,
            currentStepIndex,
            totalSteps: steps.length,
            status,
            detail,
            subStage,
            percent: Math.round((currentStepIndex / steps.length) * 100),
            updatedAt: new Date().toISOString(),
            completedSteps: steps.slice(0, currentStepIndex),
            stageLog,
            llmProvider,
            llmModel,
            mode,
            fps,
            language
        };
        await writeJson(agentStatePath, progress);
        const sub = subStage ? ` [${subStage}]` : '';
        console.error(`[Agent] Step ${currentStepIndex + 1}/${steps.length}: ${stepLabels[step] || step}${sub} — ${status} ${detail} [LLM: ${llmProvider}/${llmModel}]`);
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
            '--project-dir', projectDir,
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
                await updateProgress('transcription', 'running', 'Transcribing with Sarvam AI...', 'sarvam_transcribe');
                startEditingResult = await runScriptStep('start_editing_pipeline.mjs', transcribeArgs);
            } else {
                await updateProgress('transcription', 'skipped', `Using existing transcript (${existing.segments?.length ?? 0} segments)`, 'cache_check');
                startEditingResult = {
                    transcript: existing,
                    removeRanges: [],
                    durationUs: existing.source?.durationUs ?? 0,
                    adapter: existing.adapter?.runtime ?? 'cached',
                };
            }
        } else {
            await updateProgress('transcription', 'running', 'Transcribing with Sarvam AI...', 'sarvam_transcribe');
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

        // ── Step 2: Transcript Annotation ─────────────────────────────────────
        currentStepIndex = 1;
        await updateProgress('transcript_annotation', 'running', 'Annotating transcript quality flags...', 'quality_flags');

        try {
            const annotationResult = await runScriptStep('annotate_transcript.mjs', [
                '--project-id', projectId,
                '--project-dir', projectDir,
            ], 3 * 60 * 1000);

            results.annotation = {
                reliability: annotationResult.reliability?.overall ?? 'unknown',
                score: annotationResult.reliability?.score ?? 0,
                flaggedSegments: annotationResult.reliability?.flaggedSegments ?? 0,
                highRiskSegments: annotationResult.reliability?.highRiskSegments ?? 0,
            };
            await updateProgress('transcript_annotation', 'done',
                `Reliability: ${results.annotation.reliability} (${results.annotation.score}/100), ${results.annotation.flaggedSegments} flagged`
            );
        } catch (e) {
            console.error(`[Agent] Transcript annotation failed (non-blocking): ${e.message}`);
            results.annotation = { reliability: 'unknown', score: 0, error: e.message };
            await updateProgress('transcript_annotation', 'skipped', 'Annotation failed — continuing');
        }

        // ── Speaker Diarization (sub-step after annotation) ──────────────────
        try {
            await updateProgress('transcript_annotation', 'running', 'Running speaker diarization...', 'speaker_diarization');
            const diarizeResult = await runScriptStep('lib/speaker_diarization.mjs', [
                '--project-id', projectId,
                '--project-dir', projectDir,
                '--input', input,
                '--max-speakers', '4',
            ], 5 * 60 * 1000);

            results.diarization = {
                method: diarizeResult.method || 'unknown',
                speakerCount: diarizeResult.speakerCount || 0,
            };
            console.error(`[Agent] Speaker diarization: ${results.diarization.speakerCount} speakers (${results.diarization.method})`);
        } catch (e) {
            console.error(`[Agent] Speaker diarization failed (non-blocking): ${e.message}`);
            results.diarization = { method: 'failed', speakerCount: 0, error: e.message };
        }

        // ── Step 3: Semantic Chunking ──────────────────────────────────────────
        currentStepIndex = 2;
        await updateProgress('semantic_chunking', 'running', 'Splitting transcript into semantic topic chunks...');

        try {
            const chunkResult = await runScriptStep('lib/semantic_chunker.mjs', [
                '--project-id', projectId,
                '--project-dir', projectDir,
            ], 5 * 60 * 1000);

            results.semanticChunking = {
                totalChunks: chunkResult.stats?.totalChunks ?? 0,
                avgDurationSec: chunkResult.stats?.avgChunkDurationSec ?? 0,
                intents: chunkResult.stats?.intentDistribution ?? {},
                fixes: chunkResult.stats?.validationFixes ?? 0,
            };
            await updateProgress('semantic_chunking', 'done',
                `${results.semanticChunking.totalChunks} chunks (avg ${results.semanticChunking.avgDurationSec}s), ${results.semanticChunking.fixes} fixes`
            );
        } catch (e) {
            console.error(`[Agent] Semantic chunking failed (non-blocking): ${e.message}`);
            results.semanticChunking = { error: e.message };
            await updateProgress('semantic_chunking', 'skipped', 'Semantic chunking failed — HR pipeline will use basic splitter');
        }

        // ── Step 4: High-Retention Chunk Analysis ────────────────────────────
        // AI analyses each chunk with 2-min context window and decides:
        //   - Template to show, image/video B-roll query, cut decision
        // Guarantees something happens every 5-7 seconds.
        currentStepIndex = 3;
        await updateProgress('high_retention_analysis', 'running',
            'AI analysing transcript chunks for high-retention editing...', 'llm_chunk_analysis');

        const hrResult = await runScriptStep('high_retention_pipeline.mjs', [
            '--project-id', projectId,
            '--project-dir', projectDir,
            '--llm-provider', llmProvider,
            ...(llmModel ? ['--llm-model', llmModel] : []),
        ], 45 * 60 * 1000); // 45 min timeout for full video analysis (149+ chunks × Codex CLI)

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

        // ── Step 5: Chunk QC Scoring + Iterative Re-Plan Loop ────────────────
        currentStepIndex = 4;
        await updateProgress('chunk_qc', 'running', 'Scoring chunk edit plan quality...', 'qc_scoring');

        try {
            // Initial QC scoring
            const chunkQcResult = await runScriptStep('lib/chunk_qc.mjs', [
                '--project-id', projectId,
                '--project-dir', projectDir,
            ], 5 * 60 * 1000);

            results.chunkQc = {
                totalChunks: chunkQcResult.totalChunks ?? 0,
                passed: chunkQcResult.summary?.passed ?? 0,
                failed: chunkQcResult.summary?.failed ?? 0,
                avgScore: chunkQcResult.summary?.avgScore ?? 0,
                passRate: chunkQcResult.summary?.passRate ?? 0,
            };

            // If chunks failed, run iterative re-plan loop
            if (results.chunkQc.failed > 0) {
                await updateProgress('chunk_qc', 'running',
                    `${results.chunkQc.failed} chunks below threshold — re-planning with improvement hints...`, 'iterative_replan'
                );

                try {
                    const replanResult = await runScriptStep('lib/chunk_replan.mjs', [
                        '--project-id', projectId,
                        '--project-dir', projectDir,
                        '--llm-provider', llmProvider,
                        ...(llmModel ? ['--llm-model', llmModel] : []),
                        '--max-iterations', '2',
                    ], 10 * 60 * 1000);

                    results.chunkQc.replan = {
                        replanned: replanResult.replanned ?? 0,
                        iterations: replanResult.iterations ?? 0,
                    };

                    // Re-score after re-plan
                    const rescoreResult = await runScriptStep('lib/chunk_qc.mjs', [
                        '--project-id', projectId,
                        '--project-dir', projectDir,
                    ], 5 * 60 * 1000);

                    results.chunkQc.afterReplan = {
                        passed: rescoreResult.summary?.passed ?? 0,
                        failed: rescoreResult.summary?.failed ?? 0,
                        avgScore: rescoreResult.summary?.avgScore ?? 0,
                    };
                } catch (replanErr) {
                    console.error(`[Agent] Chunk re-plan failed (non-blocking): ${replanErr.message}`);
                    results.chunkQc.replan = { error: replanErr.message };
                }
            }

            const qcSummary = results.chunkQc.afterReplan || results.chunkQc;
            await updateProgress('chunk_qc', 'done',
                `${qcSummary.passed ?? results.chunkQc.passed} passed, ${qcSummary.failed ?? results.chunkQc.failed} failed (avg ${qcSummary.avgScore ?? results.chunkQc.avgScore}/100)` +
                (results.chunkQc.replan?.replanned ? ` — ${results.chunkQc.replan.replanned} re-planned` : '')
            );
        } catch (e) {
            console.error(`[Agent] Chunk QC failed (non-blocking): ${e.message}`);
            results.chunkQc = { error: e.message };
            await updateProgress('chunk_qc', 'skipped', 'Chunk QC failed — continuing');
        }

        // ── Step 6: Asset Quality Gate ──────────────────────────────────────────
        currentStepIndex = 5;
        await updateProgress('asset_quality', 'running', 'Validating fetched assets...', 'validate_assets');

        try {
            const assetQResult = await runScriptStep('lib/asset_quality.mjs', [
                '--project-id', projectId,
                '--project-dir', projectDir,
            ], 5 * 60 * 1000);

            results.assetQuality = {
                totalAssets: assetQResult.totalAssets ?? 0,
                pass: assetQResult.summary?.pass ?? 0,
                warn: assetQResult.summary?.warn ?? 0,
                fail: assetQResult.summary?.fail ?? 0,
                duplicates: assetQResult.summary?.duplicates ?? 0,
            };
            await updateProgress('asset_quality', 'done',
                `${results.assetQuality.pass} pass, ${results.assetQuality.warn} warn, ${results.assetQuality.fail} fail, ${results.assetQuality.duplicates} dupes`
            );
        } catch (e) {
            console.error(`[Agent] Asset quality gate failed (non-blocking): ${e.message}`);
            results.assetQuality = { error: e.message };
            await updateProgress('asset_quality', 'skipped', 'Asset quality gate failed — continuing');
        }

        // ── Step 7: Cut Safety Review ──────────────────────────────────────────
        currentStepIndex = 6;
        await updateProgress('cut_safety_review', 'running', 'Reviewing cut safety and seam quality...', 'safety_check');

        try {
            const cutSafetyResult = await runScriptStep('lib/cut_safety.mjs', [
                '--project-id', projectId,
                '--project-dir', projectDir,
            ], 5 * 60 * 1000);

            results.cutSafety = {
                totalCuts: cutSafetyResult.totalCuts ?? 0,
                safeCuts: cutSafetyResult.safeCuts ?? 0,
                riskyCuts: cutSafetyResult.riskyCuts ?? 0,
                downgradedCuts: cutSafetyResult.downgradedCuts ?? 0,
            };
            await updateProgress('cut_safety_review', 'done',
                `${results.cutSafety.safeCuts} safe, ${results.cutSafety.riskyCuts} risky, ${results.cutSafety.downgradedCuts} downgraded`
            );
        } catch (e) {
            console.error(`[Agent] Cut safety review failed (non-blocking): ${e.message}`);
            results.cutSafety = { error: e.message };
            await updateProgress('cut_safety_review', 'skipped', 'Cut safety review failed — continuing');
        }

        // ── Step 8: Seam Quality Analysis ──────────────────────────────────────
        currentStepIndex = 7;
        await updateProgress('seam_quality', 'running', 'Analysing audio seam quality at cut points...', 'audio_analysis');

        try {
            const seamResult = await runScriptStep('lib/seam_quality.mjs', [
                '--project-id', projectId,
                '--project-dir', projectDir,
            ], 5 * 60 * 1000);

            results.seamQuality = {
                seamCount: seamResult.seamCount ?? 0,
                good: (seamResult.seams || []).filter(s => s.seamQuality === 'good').length,
                fair: (seamResult.seams || []).filter(s => s.seamQuality === 'fair').length,
                poor: (seamResult.seams || []).filter(s => s.seamQuality === 'poor').length,
            };
            await updateProgress('seam_quality', 'done',
                `${results.seamQuality.seamCount} seams: ${results.seamQuality.good} good, ${results.seamQuality.fair} fair, ${results.seamQuality.poor} poor`
            );
        } catch (e) {
            console.error(`[Agent] Seam quality analysis failed (non-blocking): ${e.message}`);
            results.seamQuality = { error: e.message };
            await updateProgress('seam_quality', 'skipped', 'Seam quality analysis failed — continuing');
        }

        // ── Step 9: Cross-Chunk Consistency Review ──────────────────────────────
        currentStepIndex = 8;
        await updateProgress('cross_chunk_review', 'running', 'Reviewing cross-chunk consistency...', 'consistency_review');

        try {
            const crossResult = await runScriptStep('lib/cross_chunk_review.mjs', [
                '--project-id', projectId,
                '--project-dir', projectDir,
            ], 5 * 60 * 1000);

            results.crossChunk = {
                issueCount: crossResult.issueCount ?? 0,
                high: crossResult.severity?.high ?? 0,
                medium: crossResult.severity?.medium ?? 0,
                low: crossResult.severity?.low ?? 0,
            };
            await updateProgress('cross_chunk_review', 'done',
                `${results.crossChunk.issueCount} issues (${results.crossChunk.high}H/${results.crossChunk.medium}M/${results.crossChunk.low}L)`
            );
        } catch (e) {
            console.error(`[Agent] Cross-chunk review failed (non-blocking): ${e.message}`);
            results.crossChunk = { error: e.message };
            await updateProgress('cross_chunk_review', 'skipped', 'Cross-chunk review failed — continuing');
        }

        // ── Step 10: Global Video Intelligence ──────────────────────────────────
        currentStepIndex = 9;
        await updateProgress('global_analysis', 'running', 'Running global video intelligence pass...', 'video_intelligence');

        try {
            const globalResult = await runScriptStep('global_video_analysis.mjs', [
                '--project-id', projectId,
                '--project-dir', projectDir,
            ], 5 * 60 * 1000);

            results.globalAnalysis = {
                hookScore: globalResult.hook?.score ?? 0,
                retentionRisks: globalResult.retentionRisks?.count ?? 0,
                overloadZones: globalResult.overloadZones?.count ?? 0,
                shortsCandidates: globalResult.shortsCandidates?.count ?? 0,
            };
            await updateProgress('global_analysis', 'done',
                `Hook ${results.globalAnalysis.hookScore}/100, ${results.globalAnalysis.retentionRisks} retention risks, ${results.globalAnalysis.shortsCandidates} shorts candidates`
            );
        } catch (e) {
            console.error(`[Agent] Global analysis failed (non-blocking): ${e.message}`);
            results.globalAnalysis = { error: e.message };
            await updateProgress('global_analysis', 'skipped', 'Global analysis failed — continuing');
        }

        // ── Step 11: Pre-Render QA ──────────────────────────────────────────
        currentStepIndex = 10;
        await updateProgress('pre_render_qa', 'running', 'Running pre-render quality checks...', 'qa_checks');

        try {
            const preQaResult = await runScriptStep('lib/pre_render_qa.mjs', [
                '--project-id', projectId,
                '--project-dir', projectDir,
            ], 5 * 60 * 1000);

            results.preRenderQa = {
                overallStatus: preQaResult.overallStatus ?? 'unknown',
                pass: preQaResult.summary?.pass ?? 0,
                warn: preQaResult.summary?.warn ?? 0,
                fail: preQaResult.summary?.fail ?? 0,
            };
            await updateProgress('pre_render_qa', 'done',
                `${results.preRenderQa.overallStatus.toUpperCase()}: ${results.preRenderQa.pass}P/${results.preRenderQa.warn}W/${results.preRenderQa.fail}F`
            );
        } catch (e) {
            console.error(`[Agent] Pre-render QA failed (non-blocking): ${e.message}`);
            results.preRenderQa = { error: e.message };
            await updateProgress('pre_render_qa', 'skipped', 'Pre-render QA failed — continuing');
        }

        // ── Step 12: Timeline Assembly ──────────────────────────────────────
        currentStepIndex = 11;
        await updateProgress('timeline_assembly', 'running', 'Assembling final timeline from AI decisions...', 'build_timeline');

        // Apply human review decisions: mark rejected chunks as cut in the HR plan
        try {
            const reviewPath = path.join(projectDir, 'chunk_review_decisions.json');
            const hrPlanPath = path.join(projectDir, 'high-retention-plan.json');
            const reviewRaw = await fs.readFile(reviewPath, 'utf8').catch(() => null);
            if (reviewRaw) {
                const review = JSON.parse(reviewRaw);
                const decisions = review.decisions || {};
                const rejectedIndices = Object.entries(decisions)
                    .filter(([, v]) => v === 'rejected')
                    .map(([k]) => Number(k));

                if (rejectedIndices.length > 0) {
                    const hrPlanRaw = await fs.readFile(hrPlanPath, 'utf8').catch(() => null);
                    if (hrPlanRaw) {
                        const hrPlan = JSON.parse(hrPlanRaw);
                        let patched = 0;
                        for (const idx of rejectedIndices) {
                            if (hrPlan.decisions?.[idx] && !hrPlan.decisions[idx].cut) {
                                hrPlan.decisions[idx].cut = true;
                                hrPlan.decisions[idx].cutReason = 'human_rejected';
                                patched++;
                            }
                        }
                        if (patched > 0) {
                            hrPlan.humanReviewApplied = true;
                            hrPlan.humanReviewAt = new Date().toISOString();
                            await writeJson(hrPlanPath, hrPlan);
                            console.error(`[Agent] Applied human review: ${patched} chunks marked as rejected`);
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`[Agent] Human review application failed (non-blocking): ${e.message}`);
        }

        // ── Build timeline.json from pipeline artifacts ──────────────────────
        try {
            const transcriptPath = path.join(projectDir, 'transcript.json');
            const cutPlanPath = path.join(projectDir, 'cut-plan.json');
            const hrPlanPath = path.join(projectDir, 'high-retention-plan.json');
            const timelinePath = path.join(projectDir, 'timeline.json');

            const transcript = await readJson(transcriptPath).catch(() => ({}));
            const cutPlan = await readJson(cutPlanPath).catch(() => ({}));
            const hrPlan = await readJson(hrPlanPath).catch(() => ({}));

            const durationUs = Number(transcript.source?.durationUs || 0);
            const fpsNum = Number(fps || 30);
            const now = new Date().toISOString();

            // Collect all remove ranges (from silence cuts + HR cut decisions)
            const removeRanges = [
                ...(cutPlan.removeRanges || []),
                ...(hrPlan.removeRanges || []),
            ].sort((a, b) => Number(a.startUs) - Number(b.startUs));

            // Also mark HR decisions with cut=true as remove ranges
            const hrDecisions = Array.isArray(hrPlan.decisions) ? hrPlan.decisions : [];
            for (const d of hrDecisions) {
                if (d.cut && d.startUs != null && d.endUs != null) {
                    removeRanges.push({ startUs: Number(d.startUs), endUs: Number(d.endUs), reason: d.cutReason || 'ai-cut' });
                }
            }
            removeRanges.sort((a, b) => Number(a.startUs) - Number(b.startUs));

            // Merge overlapping remove ranges
            const mergedRemove = [];
            for (const r of removeRanges) {
                const s = Number(r.startUs), e = Number(r.endUs);
                if (mergedRemove.length > 0 && s <= mergedRemove[mergedRemove.length - 1].endUs) {
                    mergedRemove[mergedRemove.length - 1].endUs = Math.max(mergedRemove[mergedRemove.length - 1].endUs, e);
                } else {
                    mergedRemove.push({ startUs: s, endUs: e });
                }
            }

            // Build source clips from kept ranges (inverse of remove ranges)
            const sourceClips = [];
            let cursor = 0;
            let timelineCursor = 0;
            for (const r of mergedRemove) {
                if (r.startUs > cursor) {
                    const clipDur = r.startUs - cursor;
                    sourceClips.push({
                        clipId: `source-${sourceClips.length + 1}`,
                        trackId: 'track-video-main',
                        clipType: 'source_clip',
                        startUs: timelineCursor,
                        endUs: timelineCursor + clipDur,
                        sourceStartUs: cursor,
                        sourceEndUs: r.startUs,
                        sourceRef: sourceRef,
                        effects: {},
                        transform: {},
                        meta: { generatedBy: 'agentic-pipeline' },
                    });
                    timelineCursor += clipDur;
                }
                cursor = r.endUs;
            }
            // Final segment after last cut
            if (cursor < durationUs) {
                const clipDur = durationUs - cursor;
                sourceClips.push({
                    clipId: `source-${sourceClips.length + 1}`,
                    trackId: 'track-video-main',
                    clipType: 'source_clip',
                    startUs: timelineCursor,
                    endUs: timelineCursor + clipDur,
                    sourceStartUs: cursor,
                    sourceEndUs: durationUs,
                    sourceRef: sourceRef,
                    effects: {},
                    transform: {},
                    meta: { generatedBy: 'agentic-pipeline' },
                });
                timelineCursor += clipDur;
            }

            // If no cuts, single source clip for the whole video
            if (sourceClips.length === 0) {
                sourceClips.push({
                    clipId: 'source-1',
                    trackId: 'track-video-main',
                    clipType: 'source_clip',
                    startUs: 0,
                    endUs: durationUs,
                    sourceStartUs: 0,
                    sourceEndUs: durationUs,
                    sourceRef: sourceRef,
                    effects: {},
                    transform: {},
                    meta: { generatedBy: 'agentic-pipeline' },
                });
                timelineCursor = durationUs;
            }

            // Build template clips
            const templatePlacements = hrPlan.templatePlacements || [];
            const templateClips = templatePlacements.map((p, i) => ({
                clipId: p.id || `tpl-clip-${i + 1}`,
                trackId: 'track-template-overlay',
                clipType: 'template_clip',
                templateId: p.templateId || p.id,
                templateName: p.templateName || '',
                startUs: Number(p.startUs || 0),
                endUs: Number(p.endUs || 0),
                sourceRef: '',
                content: p.content || {},
                effects: {},
                transform: {},
                meta: { generatedBy: 'agentic-pipeline', aiReason: p.aiReason || '' },
            }));

            // Build asset / B-roll clips
            const assetSuggestions = hrPlan.assetSuggestions || [];
            const assetClips = assetSuggestions.map((a, i) => ({
                clipId: a.id || `asset-clip-${i + 1}`,
                trackId: 'track-broll',
                clipType: 'asset_clip',
                startUs: Number(a.startUs || 0),
                endUs: Number(a.endUs || 0),
                sourceRef: a.localPath || '',
                effects: {},
                transform: {},
                meta: {
                    generatedBy: 'agentic-pipeline',
                    kind: a.kind || 'image',
                    query: a.query || '',
                    provider: a.provider || '',
                    license: a.license || '',
                    aiReason: a.aiReason || '',
                },
            }));

            const allClips = [...sourceClips, ...templateClips, ...assetClips]
                .sort((a, b) => Number(a.startUs || 0) - Number(b.startUs || 0));

            const finalDurationUs = Math.max(timelineCursor, durationUs,
                ...allClips.map(c => Number(c.endUs || 0)));

            const timeline = {
                id: `timeline-${Date.now()}`,
                projectId,
                version: 1,
                status: 'ENRICHED_TIMELINE_READY',
                fps: fpsNum,
                durationUs: finalDurationUs,
                createdAt: now,
                updatedAt: now,
                tracks: [
                    { id: 'track-video-main', name: 'Main Video', kind: 'video', order: 0, locked: false },
                    { id: 'track-template-overlay', name: 'Template Overlay', kind: 'template', order: 1, locked: false },
                    { id: 'track-broll', name: 'B-roll / Assets', kind: 'video', order: 2, locked: false },
                    { id: 'track-captions', name: 'Captions', kind: 'caption', order: 3, locked: false },
                ],
                clips: allClips,
            };

            await writeJson(timelinePath, timeline);
            console.error(`[Agent] Timeline assembled: ${sourceClips.length} source, ${templateClips.length} template, ${assetClips.length} asset clips`);

            results.timelineAssembly = {
                sourceClips: sourceClips.length,
                templateClips: templateClips.length,
                assetClips: assetClips.length,
                totalClips: allClips.length,
                durationUs: finalDurationUs,
                cutsApplied: mergedRemove.length,
            };
        } catch (e) {
            console.error(`[Agent] Timeline assembly failed: ${e.message}`);
            results.timelineAssembly = { error: e.message };
        }

        await updateProgress('timeline_assembly', 'done', 'Timeline assembled with source clips, templates, and B-roll');

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
                semanticChunks: results.semanticChunking?.totalChunks || 0,
                seamQuality: results.seamQuality || null,
                chunkQcPassRate: results.chunkQc?.passRate ?? null,
                chunkQcReplanned: results.chunkQc?.replan?.replanned ?? 0,
                crossChunkIssues: results.crossChunk?.issueCount ?? 0,
                globalHookScore: results.globalAnalysis?.hookScore ?? null,
                preRenderQaStatus: results.preRenderQa?.overallStatus ?? null,
            },
        };

        await updateProgress('complete', 'done', 'All steps finished');
        await writeJson(path.join(projectDir, 'agentic-edit-result.json'), summary);

        // Learn style preferences from this project (non-blocking)
        try {
            const stylePrefsScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib', 'style_preferences.mjs');
            await execFileAsync('node', [stylePrefsScript, '--project-id', projectId, '--project-dir', projectDir], {
                timeout: 15000, maxBuffer: 1024 * 1024,
            });
            console.error('[Agent] Style preferences updated from this project');
        } catch (e) {
            console.error(`[Agent] Style preference learning failed (non-blocking): ${e.message}`);
        }

        // Pipeline scripts print JSON to stdout for the backend to read
        await new Promise((resolve) => process.stdout.write(JSON.stringify(summary, null, 2), resolve));
    } catch (e) {
        const errorResult = {
            ok: false,
            projectId,
            error: e.message,
            failedStep: steps[currentStepIndex],
            completedSteps: steps.slice(0, currentStepIndex),
        };
        await updateProgress(steps[currentStepIndex] || 'unknown', 'failed', e.message);
        await new Promise((resolve) => process.stdout.write(JSON.stringify(errorResult, null, 2), resolve));
        process.exitCode = 1;
    }
}

main().then(() => {
    process.exit(0);
}).catch(e => {
    console.error('[Agent] Fatal error:', e);
    process.exit(1);
});
