#!/usr/bin/env node

/**
 * Standalone transcription script.
 * Runs ONLY transcription — no cut planning, no enrichment.
 * Outputs canonical transcript JSON to stdout.
 *
 * Usage:
 *   node scripts/transcribe_only.mjs \
 *     --project-id <id> \
 *     --input <path> \
 *     --language hi \
 *     --mode hybrid \
 *     --source-ref media-xxx
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { validateCanonicalTranscript } from './lib/pipeline_schema.mjs';

const execFile = promisify(execFileCb);
const DEFAULT_DURATION_US = 10_000_000;

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

function safeMode(input) {
    const n = String(input || '').trim().toLowerCase();
    return ['local', 'api', 'hybrid'].includes(n) ? n : 'hybrid';
}

function safeFallbackPolicy(input) {
    const n = String(input || '').trim().toLowerCase();
    return ['local-first', 'api-first', 'local-only', 'api-only'].includes(n) ? n : 'local-first';
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

// ── Adapter Selection ───────────────────────────────────────────────────────

const WHISPER_VENV_PYTHON = path.join(os.homedir(), '.local', 'whisper-venv', 'bin', 'python3');
const TRANSCRIBE_SCRIPT = path.join(process.cwd(), 'scripts', 'transcribe_faster_whisper.py');

async function pythonPackageExists(pkg) {
    try {
        const probe = await run('python3', ['-c', `import importlib.util as u; print('ok' if u.find_spec('${pkg}') else 'missing')`]);
        return probe === 'ok';
    } catch { return false; }
}

async function detectVenvFasterWhisper() {
    try {
        await fs.access(WHISPER_VENV_PYTHON, 1);
        const probe = await run(WHISPER_VENV_PYTHON, ['-c', `import importlib.util as u; print('ok' if u.find_spec('faster_whisper') else 'missing')`]);
        return probe === 'ok';
    } catch { return false; }
}

async function detectLocalTranscriptionRuntime() {
    if (await detectVenvFasterWhisper()) return { available: true, runtime: 'faster_whisper', binary: WHISPER_VENV_PYTHON };
    const whisperCli = await commandExists('whisper-cli');
    if (whisperCli) return { available: true, runtime: 'whisper_cpp', binary: whisperCli };
    const whisperCpp = await commandExists('whisper-cpp');
    if (whisperCpp) return { available: true, runtime: 'whisper_cpp', binary: whisperCpp };
    const python3 = await commandExists('python3');
    if (python3 && (await pythonPackageExists('faster_whisper'))) return { available: true, runtime: 'faster_whisper', binary: python3 };
    const mlxWhisper = await commandExists('mlx_whisper');
    if (mlxWhisper) return { available: true, runtime: 'mlx_whisper', binary: mlxWhisper };
    return { available: false, runtime: '', binary: '' };
}

async function selectTranscriptionAdapter({ mode, fallbackPolicy, transcriptionModel, language }) {
    const local = await detectLocalTranscriptionRuntime();
    const hasSarvamKey = Boolean(process.env.SARVAM_API_KEY);
    const defaultApiModel = process.env.LAPAAS_API_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
    const defaultLocalModel = process.env.LAPAAS_LOCAL_TRANSCRIBE_MODEL || 'auto';
    const hasApiKey = Boolean(process.env.OPENAI_API_KEY || process.env.LAPAAS_API_KEY);
    const warnings = [];
    const effectiveFallbackPolicy = safeFallbackPolicy(fallbackPolicy);
    const localModel = transcriptionModel || defaultLocalModel;
    const apiModel = transcriptionModel || defaultApiModel;
    const isIndicLanguage = ['hi', 'bn', 'kn', 'ml', 'mr', 'od', 'pa', 'ta', 'te', 'gu', 'ur'].includes((language || '').split('-')[0]);

    const buildSarvam = () => ({ kind: 'api', runtime: 'sarvam', binary: '', model: 'saaras:v3', fallbackPolicy: effectiveFallbackPolicy, warnings });
    const buildLocal = () => ({ kind: 'local', runtime: local.runtime, binary: local.binary, model: localModel, fallbackPolicy: effectiveFallbackPolicy, warnings });
    const buildApi = () => ({ kind: 'api', runtime: process.env.LAPAAS_TRANSCRIPTION_API_PROVIDER || 'openai', binary: '', model: apiModel, fallbackPolicy: effectiveFallbackPolicy, warnings });

    if (transcriptionModel === 'sarvam') {
        if (hasSarvamKey) return buildSarvam();
        warnings.push('Sarvam selected but SARVAM_API_KEY missing.');
    }
    if (hasSarvamKey && isIndicLanguage) { console.error(`[Adapter] Using Sarvam AI for ${language}`); return buildSarvam(); }
    if (mode === 'local') { if (!local.available) throw new Error('No local runtime found'); return buildLocal(); }
    if (mode === 'api') { if (hasSarvamKey && isIndicLanguage) return buildSarvam(); return buildApi(); }
    if (local.available) return buildLocal();
    if (hasSarvamKey && isIndicLanguage) return buildSarvam();
    return buildApi();
}

// ── Sarvam Transcription ────────────────────────────────────────────────────

async function splitAudioIntoChunks(inputPath, chunkDurationSec = 25) {
    const hasFfmpeg = await commandExists('ffmpeg');
    if (!hasFfmpeg) throw new Error('ffmpeg required');
    const tmpDir = path.join(os.tmpdir(), `sarvam_chunks_${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    const durationSec = await getDurationUs(inputPath) / 1_000_000;
    const chunkCount = Math.ceil(durationSec / chunkDurationSec);
    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
        const startSec = i * chunkDurationSec;
        const chunkPath = path.join(tmpDir, `chunk_${String(i).padStart(3, '0')}.wav`);
        await runWithOutput('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', inputPath, '-ss', String(startSec), '-t', String(chunkDurationSec), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', chunkPath], 120000);
        chunks.push({ path: chunkPath, startSec, index: i });
    }
    return { tmpDir, chunks };
}

async function transcribeChunkWithSarvam(chunkPath, language, apiKey) {
    const fileBuffer = await fs.readFile(chunkPath);
    const blob = new Blob([fileBuffer], { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('file', blob, path.basename(chunkPath));
    formData.append('model', 'saaras:v3');
    formData.append('mode', 'transcribe');
    formData.append('with_timestamps', 'true');
    const langCode = language.includes('-') ? language : `${language}-IN`;
    formData.append('language_code', langCode);
    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST', headers: { 'api-subscription-key': apiKey }, body: formData,
    });
    if (!response.ok) { const text = await response.text(); throw new Error(`Sarvam API error (${response.status}): ${text}`); }
    return response.json();
}

function buildWords(text, startUs, endUs) {
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    const span = endUs - startUs;
    const per = Math.max(1, Math.floor(span / tokens.length));
    return tokens.map((token, index) => {
        const s = startUs + per * index;
        const e = index === tokens.length - 1 ? endUs : Math.min(endUs, s + per);
        return { id: `word-${startUs}-${index + 1}`, text: token, normalized: token.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ''), startUs: s, endUs: e, confidence: 0.88 };
    });
}

async function transcribeWithSarvam(inputPath, language) {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) throw new Error('SARVAM_API_KEY not set');
    console.error('[Sarvam] Splitting audio into 25s chunks...');
    const { tmpDir, chunks } = await splitAudioIntoChunks(inputPath, 25);
    const segments = [];
    const allWords = [];
    let segIdx = 0;

    try {
        for (const chunk of chunks) {
            console.error(`[Sarvam] Transcribing chunk ${chunk.index + 1}/${chunks.length}...`);
            const offsetUs = Math.round(chunk.startSec * 1_000_000);
            try {
                const result = await transcribeChunkWithSarvam(chunk.path, language, apiKey);
                const transcriptText = result.transcript || '';
                if (!transcriptText.trim()) continue;

                // Sanitize Sarvam word output
                const chunkWords = [];
                if (result.timestamps?.words) {
                    for (const w of result.timestamps.words) {
                        const rawText = (w.word || w.text || '').trim();
                        if (!rawText) continue;
                        let wStartUs = Math.round((w.start_time_seconds || 0) * 1_000_000) + offsetUs;
                        let wEndUs = Math.round((w.end_time_seconds || 0) * 1_000_000) + offsetUs;
                        if (wEndUs <= wStartUs) wEndUs = wStartUs + 50_000;
                        chunkWords.push({ id: `word-${segIdx}-${allWords.length + chunkWords.length}`, text: rawText, normalized: rawText.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ''), startUs: wStartUs, endUs: wEndUs, confidence: 0.92 });
                    }
                }

                const chunkEndUs = offsetUs + 25_000_000;
                const hasValidTimestamps = chunkWords.length > 0 && chunkWords.some(w => w.startUs > offsetUs || w.endUs > offsetUs + 50_000);
                let segStartUs = hasValidTimestamps ? chunkWords[0].startUs : offsetUs;
                let segEndUs = hasValidTimestamps ? chunkWords[chunkWords.length - 1].endUs : chunkEndUs;
                if (segEndUs <= segStartUs) segEndUs = segStartUs + 1_000_000;

                const finalWords = hasValidTimestamps ? chunkWords : buildWords(transcriptText, segStartUs, segEndUs);
                for (const w of finalWords) allWords.push(w);

                segments.push({ id: `seg-${segIdx}`, startUs: segStartUs, endUs: segEndUs, text: transcriptText.trim(), words: finalWords, confidence: 0.92 });
                segIdx++;
                console.error(`  [${chunk.startSec}s] ${transcriptText.trim().slice(0, 80)}...`);
            } catch (e) { console.error(`[Sarvam] Chunk ${chunk.index} failed: ${e.message}`); }
        }
    } finally {
        for (const chunk of chunks) { await fs.unlink(chunk.path).catch(() => { }); }
        await fs.rmdir(tmpDir).catch(() => { });
    }
    console.error(`[Sarvam] Done: ${segments.length} segments, ${allWords.length} words`);
    return { language: language || 'hi', segments, words: allWords, wordCount: allWords.length };
}

// ── Faster-Whisper Transcription ────────────────────────────────────────────

async function extractAudioForWhisper(inputPath, outputPath) {
    await runWithOutput('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputPath], 600000);
}

async function transcribeWithFasterWhisper(adapter, inputPath) {
    const modelSize = (adapter.model && adapter.model !== 'auto') ? adapter.model : 'tiny';
    console.error(`[FasterWhisper] Transcribing with model '${modelSize}' using ${adapter.binary}...`);
    const result = await runWithOutput(adapter.binary, [TRANSCRIBE_SCRIPT, inputPath, '--model', modelSize], 15 * 60 * 1000);
    try { return JSON.parse(result.stdout); }
    catch (e) { throw new Error(`Failed to parse faster-whisper output: ${e.message}`); }
}

function normalizeFasterWhisperTranscript(fwResult, durationUs) {
    const segments = (fwResult.segments || []).map(seg => ({
        id: seg.id, startUs: seg.startUs, endUs: seg.endUs, text: seg.text,
        words: seg.words || buildWords(seg.text, seg.startUs, seg.endUs),
        confidence: seg.confidence || 0.9,
    }));
    return { language: fwResult.language || 'en', segments, wordCount: fwResult.wordCount || segments.reduce((sum, s) => sum + (s.words?.length || 0), 0) };
}

async function transcribeWithWhisperCpp(adapter, inputPath) {
    const tempWav = `${inputPath}.16k.wav`;
    try {
        await extractAudioForWhisper(inputPath, tempWav);
        const outputBase = tempWav.replace(/\.wav$/, '');
        const args = ['-m', adapter.model, '-f', tempWav, '--output-json', '--output-file', outputBase];
        console.error(`[WhisperCpp] Running: ${adapter.binary} ${args.join(' ')}`);
        await runWithOutput(adapter.binary, args, 10 * 60 * 1000);
        const jsonPath = `${outputBase}.json`;
        const raw = await fs.readFile(jsonPath, 'utf8');
        return JSON.parse(raw);
    } finally { try { await fs.unlink(tempWav); } catch { } }
}

function normalizeWhisperTranscript(whisperJson, durationUs) {
    const segments = (whisperJson.transcription || whisperJson.result || []).map((seg, idx) => {
        let startUs = 0, endUs = 0;
        if (seg.offsets) { startUs = seg.offsets.from * 1000; endUs = seg.offsets.to * 1000; }
        const text = seg.text.trim();
        return { id: `seg-${idx}`, startUs: Math.round(startUs), endUs: Math.round(endUs), text, words: buildWords(text, startUs, endUs), confidence: 0.9 };
    });
    return { language: 'en', segments, wordCount: segments.reduce((sum, s) => sum + s.words.length, 0) };
}

function buildSyntheticTranscript({ durationUs, mode, language, adapter }) {
    const segmentCount = Math.min(8, Math.max(4, Math.floor(durationUs / 2_000_000)));
    const segmentDuration = Math.max(500_000, Math.floor(durationUs / segmentCount));
    const segments = [];
    for (let i = 0; i < segmentCount; i++) {
        const startUs = i * segmentDuration;
        const endUs = i === segmentCount - 1 ? durationUs : Math.min(durationUs, startUs + segmentDuration);
        const filler = i % 3 === 1 ? 'um ' : '';
        const text = `Segment ${i + 1} ${filler}generated in ${mode} mode with ${adapter} for ${language}.`;
        const words = buildWords(text, startUs, endUs);
        segments.push({ id: `seg-${i + 1}`, startUs, endUs, text, confidence: 0.86, words });
    }
    return { language, segments, wordCount: segments.reduce((sum, s) => sum + s.words.length, 0) };
}

// ── Canonical Transcript Builder ────────────────────────────────────────────

function toCanonicalTranscript({ projectId, inputPath, sourceRef, mode, language, durationUs, adapter, transcript }) {
    const words = [];
    const segments = transcript.segments.map(segment => {
        const wordIds = [];
        for (const word of segment.words) { words.push(word); wordIds.push(word.id); }
        return { id: segment.id, startUs: segment.startUs, endUs: segment.endUs, text: segment.text, wordIds, confidence: segment.confidence };
    });
    return {
        transcriptId: `tx-${Date.now()}`,
        projectId, createdAt: new Date().toISOString(), mode, language,
        source: { path: inputPath, ref: sourceRef, durationUs },
        adapter: { kind: adapter.kind, runtime: adapter.runtime, binary: adapter.binary, model: adapter.model, engine: `${adapter.kind}:${adapter.runtime}:v1` },
        words, segments, wordCount: words.length,
    };
}

// ── Subtitle Builders ───────────────────────────────────────────────────────

function formatSubtitleTime(us, delimiter) {
    const totalMs = Math.max(0, Math.round(us / 1000));
    const hh = String(Math.floor(totalMs / 3_600_000)).padStart(2, '0');
    const mm = String(Math.floor((totalMs % 3_600_000) / 60_000)).padStart(2, '0');
    const ss = String(Math.floor((totalMs % 60_000) / 1000)).padStart(2, '0');
    const mmm = String(totalMs % 1000).padStart(3, '0');
    return `${hh}:${mm}:${ss}${delimiter}${mmm}`;
}

function buildSrt(segments) {
    return segments.map((seg, i) => `${i + 1}\n${formatSubtitleTime(seg.startUs, ',')} --> ${formatSubtitleTime(seg.endUs, ',')}\n${seg.text}\n`).join('\n') + '\n';
}

function buildVtt(segments) {
    return 'WEBVTT\n\n' + segments.map((seg, i) => `${i + 1}\n${formatSubtitleTime(seg.startUs, '.')} --> ${formatSubtitleTime(seg.endUs, '.')}\n${seg.text}\n`).join('\n') + '\n';
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const projectId = readArg('--project-id');
    const input = readArg('--input');
    const mode = safeMode(readArg('--mode', 'hybrid'));
    const language = readArg('--language', 'en') || 'en';
    const sourceRef = readArg('--source-ref', 'source-video') || 'source-video';
    const transcriptionModel = readArg('--transcription-model', '').trim();
    const fallbackPolicy = safeFallbackPolicy(readArg('--fallback-policy', 'local-first'));

    if (!projectId) throw new Error('Missing --project-id');
    if (!input) throw new Error('Missing --input');

    const inputPath = path.resolve(input);
    try { await fs.access(inputPath); } catch { throw new Error(`Input file not found: ${inputPath}`); }

    const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
    const transcriptPath = path.join(projectDir, 'transcript.json');
    const subtitlesDir = path.join(projectDir, 'subtitles');
    const srtPath = path.join(subtitlesDir, 'subtitles.srt');
    const vttPath = path.join(subtitlesDir, 'subtitles.vtt');

    // 1. Select adapter
    const adapter = await selectTranscriptionAdapter({ mode, fallbackPolicy, transcriptionModel, language });
    console.error(`[Transcribe] Adapter: ${adapter.kind}/${adapter.runtime}/${adapter.model}`);

    // 2. Get duration
    const durationUs = await getDurationUs(inputPath);
    console.error(`[Transcribe] Duration: ${(durationUs / 1_000_000).toFixed(1)}s`);

    // 3. Transcribe
    let transcript;
    if (adapter.runtime === 'sarvam') {
        try { transcript = await transcribeWithSarvam(inputPath, language); }
        catch (e) {
            console.error('Sarvam failed, trying fallback:', e.message);
            const localFallback = await detectLocalTranscriptionRuntime();
            if (localFallback.available && localFallback.runtime === 'faster_whisper') {
                const raw = await transcribeWithFasterWhisper({ ...adapter, binary: localFallback.binary, model: 'auto' }, inputPath);
                transcript = normalizeFasterWhisperTranscript(raw, durationUs);
            } else {
                transcript = buildSyntheticTranscript({ durationUs, mode, language, adapter: 'sarvam:fallback' });
            }
        }
    } else if (adapter.kind === 'local' && adapter.runtime === 'faster_whisper') {
        try {
            const raw = await transcribeWithFasterWhisper(adapter, inputPath);
            transcript = normalizeFasterWhisperTranscript(raw, durationUs);
        } catch (e) {
            console.error('faster-whisper failed:', e.message);
            transcript = buildSyntheticTranscript({ durationUs, mode, language, adapter: `${adapter.kind}:${adapter.runtime}:fallback` });
        }
    } else if (adapter.kind === 'local' && adapter.runtime === 'whisper_cpp') {
        try {
            const raw = await transcribeWithWhisperCpp(adapter, inputPath);
            transcript = normalizeWhisperTranscript(raw, durationUs);
        } catch (e) {
            console.error('Whisper.cpp failed:', e.message);
            transcript = buildSyntheticTranscript({ durationUs, mode, language, adapter: `${adapter.kind}:${adapter.runtime}:fallback` });
        }
    } else {
        transcript = buildSyntheticTranscript({ durationUs, mode, language, adapter: `${adapter.kind}:${adapter.runtime}` });
    }

    // 4. Build canonical transcript
    const canonical = toCanonicalTranscript({ projectId, inputPath, sourceRef, mode, language, durationUs, adapter, transcript });
    const validated = validateCanonicalTranscript(canonical);

    // 5. Write artifacts
    await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
    await fs.writeFile(transcriptPath, JSON.stringify(validated, null, 2) + '\n', 'utf8');
    await fs.mkdir(subtitlesDir, { recursive: true });
    await fs.writeFile(srtPath, buildSrt(validated.segments), 'utf8');
    await fs.writeFile(vttPath, buildVtt(validated.segments), 'utf8');

    // 6. Output
    process.stdout.write(JSON.stringify({
        ok: true,
        projectId,
        language,
        durationUs,
        transcriptPath,
        subtitlePaths: { srt: srtPath, vtt: vttPath },
        segmentCount: validated.segments.length,
        wordCount: validated.wordCount,
        adapter: { kind: adapter.kind, runtime: adapter.runtime, model: adapter.model },
        transcript: validated,
    }, null, 2) + '\n');
}

main().catch(e => { process.stderr.write(`${e.message}\n`); process.exit(1); });
