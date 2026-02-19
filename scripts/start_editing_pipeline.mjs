#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { createStageTracker, recordProjectTelemetry } from './lib/pipeline_telemetry.mjs';
import { runLLMPrompt, extractJsonFromLLMOutput, detectBestLLM } from './lib/llm_provider.mjs';
import { audioExtractArgs, parallelMap, detectHWAccel, isMlxWhisperAvailable, transcribeWithMlxWhisper } from './lib/metal_accel.mjs';
import {
  validateCanonicalTranscript,
  validateCutPlan,
  validateCutRanges,
} from './lib/pipeline_schema.mjs';

const execFile = promisify(execFileCb);
const DEFAULT_DURATION_US = 10_000_000;
const FILLER_TOKENS = new Set(['um', 'uh', 'erm', 'hmm', 'like']);

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function run(command, args = [], timeout = 120000) {
  const result = await runWithOutput(command, args, timeout);
  return result.stdout;
}

async function runWithOutput(command, args = [], timeout = 120000) {
  const { stdout, stderr } = await execFile(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    stdout: (stdout ?? '').toString().trim(),
    stderr: (stderr ?? '').toString().trim(),
  };
}

async function commandExists(command) {
  // Check local bin first
  const localBin = path.join(process.cwd(), 'bin', command);
  try {
    await fs.access(localBin, fs.constants.X_OK);
    return localBin;
  } catch { }

  try {
    const out = await run('which', [command], 8000);
    return out ? out.trim() : false;
  } catch {
    return false;
  }
}

function safeMode(input) {
  const normalized = String(input || '').trim().toLowerCase();
  if (normalized === 'local' || normalized === 'api' || normalized === 'hybrid') {
    return normalized;
  }
  return 'hybrid';
}

function safeFallbackPolicy(input) {
  const normalized = String(input || '').trim().toLowerCase();
  if (
    normalized === 'local-first' ||
    normalized === 'api-first' ||
    normalized === 'local-only' ||
    normalized === 'api-only'
  ) {
    return normalized;
  }
  return 'local-first';
}

async function pythonPackageExists(packageName) {
  try {
    const probe = await run('python3', [
      '-c',
      `import importlib.util as u; print('ok' if u.find_spec('${packageName}') else 'missing')`,
    ]);
    return probe === 'ok';
  } catch {
    return false;
  }
}

// Check for faster-whisper in a known venv location
const WHISPER_VENV_PYTHON = path.join(os.homedir(), '.local', 'whisper-venv', 'bin', 'python3');
const TRANSCRIBE_SCRIPT = path.join(process.cwd(), 'scripts', 'transcribe_faster_whisper.py');

async function detectVenvFasterWhisper() {
  try {
    await fs.access(WHISPER_VENV_PYTHON, 1 /* fs.constants.X_OK */);
    const probe = await run(WHISPER_VENV_PYTHON, [
      '-c',
      `import importlib.util as u; print('ok' if u.find_spec('faster_whisper') else 'missing')`,
    ]);
    return probe === 'ok';
  } catch {
    return false;
  }
}

async function detectLocalTranscriptionRuntime() {
  // 1. Check venv-based faster-whisper (preferred — always available after install)
  if (await detectVenvFasterWhisper()) {
    return { available: true, runtime: 'faster_whisper', binary: WHISPER_VENV_PYTHON };
  }

  // 2. Check whisper.cpp CLI
  const whisperCli = await commandExists('whisper-cli');
  if (whisperCli) {
    return { available: true, runtime: 'whisper_cpp', binary: whisperCli };
  }

  const whisperCpp = await commandExists('whisper-cpp');
  if (whisperCpp) {
    return { available: true, runtime: 'whisper_cpp', binary: whisperCpp };
  }

  // 3. Check system-level faster_whisper
  const python3 = await commandExists('python3');
  if (python3 && (await pythonPackageExists('faster_whisper'))) {
    return { available: true, runtime: 'faster_whisper', binary: python3 };
  }

  // 4. Check mlx_whisper
  const mlxWhisper = await commandExists('mlx_whisper');
  if (mlxWhisper) {
    return { available: true, runtime: 'mlx_whisper', binary: mlxWhisper };
  }

  return { available: false, runtime: '', binary: '' };
}

async function selectTranscriptionAdapter({ mode, fallbackPolicy, transcriptionModel, language }) {
  const local = await detectLocalTranscriptionRuntime();
  const hasSarvamKey = Boolean(process.env.SARVAM_API_KEY);
  const apiProvider = process.env.LAPAAS_TRANSCRIPTION_API_PROVIDER || 'openai';
  const defaultApiModel = process.env.LAPAAS_API_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
  const defaultLocalModel = process.env.LAPAAS_LOCAL_TRANSCRIBE_MODEL || 'auto';
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY || process.env.LAPAAS_API_KEY);
  const warnings = [];
  const effectiveFallbackPolicy = safeFallbackPolicy(fallbackPolicy);
  const localModel = transcriptionModel || defaultLocalModel;
  const apiModel = transcriptionModel || defaultApiModel;

  // Sarvam is optimal for Hindi/Indian languages
  const isIndicLanguage = ['hi', 'bn', 'kn', 'ml', 'mr', 'od', 'pa', 'ta', 'te', 'gu', 'ur'].includes((language || '').split('-')[0]);

  const buildSarvamAdapter = () => ({
    kind: 'api',
    runtime: 'sarvam',
    binary: '',
    model: 'saaras:v3',
    fallbackPolicy: effectiveFallbackPolicy,
    warnings,
  });

  // Explicit Sarvam selection by user
  if (transcriptionModel === 'sarvam') {
    if (hasSarvamKey) return buildSarvamAdapter();
    warnings.push('User selected Sarvam AI but SARVAM_API_KEY is missing. Falling back to default selection logic.');
  }

  const buildLocalAdapter = () => ({
    kind: 'local',
    runtime: local.runtime,
    binary: local.binary,
    model: localModel,
    fallbackPolicy: effectiveFallbackPolicy,
    warnings,
  });

  const buildApiAdapter = () => ({
    kind: 'api',
    runtime: apiProvider,
    binary: '',
    model: apiModel,
    fallbackPolicy: effectiveFallbackPolicy,
    warnings,
  });

  // Priority: Sarvam (for Hindi/Indic) → local faster-whisper → other API
  if (hasSarvamKey && isIndicLanguage) {
    console.error(`[Adapter] Using Sarvam AI Saaras for ${language} transcription`);
    return buildSarvamAdapter();
  }

  if (mode === 'local') {
    if (!local.available) {
      throw new Error(
        'Local mode requested but no local transcription runtime detected. Install whisper.cpp, faster-whisper, or mlx_whisper.',
      );
    }
    return buildLocalAdapter();
  }

  if (mode === 'api') {
    // If Sarvam key is available, prefer it for Indic
    if (hasSarvamKey && isIndicLanguage) return buildSarvamAdapter();
    if (!hasApiKey) {
      warnings.push(
        'API mode selected but OPENAI_API_KEY/LAPAAS_API_KEY is missing. Stub transcription output was generated.',
      );
    }
    return buildApiAdapter();
  }

  if (effectiveFallbackPolicy === 'local-only') {
    if (!local.available) {
      throw new Error(
        'Fallback policy local-only requested but no local transcription runtime detected.',
      );
    }
    return buildLocalAdapter();
  }

  if (effectiveFallbackPolicy === 'api-only') {
    if (hasSarvamKey && isIndicLanguage) return buildSarvamAdapter();
    if (!hasApiKey) {
      warnings.push(
        'API-only fallback policy selected but OPENAI_API_KEY/LAPAAS_API_KEY is missing. Stub transcription output was generated.',
      );
    }
    return buildApiAdapter();
  }

  if (effectiveFallbackPolicy === 'api-first') {
    if (hasSarvamKey && isIndicLanguage) return buildSarvamAdapter();
    if (hasApiKey) return buildApiAdapter();
    warnings.push('api-first fallback: API keys missing, trying local runtime.');
    if (local.available) return buildLocalAdapter();
    warnings.push('No API key and no local runtime. Stub transcription output was generated.');
    return buildApiAdapter();
  }

  // Hybrid / local-first default
  if (local.available) {
    return buildLocalAdapter();
  }

  if (hasSarvamKey && isIndicLanguage) return buildSarvamAdapter();

  warnings.push('Hybrid mode fallback: no local runtime detected, using API adapter path.');
  if (!hasApiKey) {
    warnings.push(
      'OPENAI_API_KEY/LAPAAS_API_KEY is missing. Stub transcription output was generated.',
    );
  }
  return buildApiAdapter();
}

// ── Sarvam AI Saaras Transcription ──────────────────────────────────────────

async function splitAudioIntoChunks(inputPath, chunkDurationSec = 25) {
  const hasFfmpeg = await commandExists('ffmpeg');
  if (!hasFfmpeg) throw new Error('ffmpeg required for audio chunking');

  const tmpDir = path.join(os.tmpdir(), `sarvam_chunks_${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  // Get total duration
  const durationSec = await getDurationUs(inputPath) / 1_000_000;
  const chunkCount = Math.ceil(durationSec / chunkDurationSec);

  // Build chunk descriptors
  const chunkDescs = Array.from({ length: chunkCount }, (_, i) => ({
    index: i,
    startSec: i * chunkDurationSec,
    path: path.join(tmpDir, `chunk_${String(i).padStart(3, '0')}.wav`),
  }));

  // Use VideoToolbox hardware decode on Apple Silicon for faster demux
  const hwArgs = await audioExtractArgs();

  // Extract all chunks in parallel (6 concurrent — optimal for M3 Max)
  await parallelMap(chunkDescs, async (chunk) => {
    await runWithOutput('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      ...hwArgs,
      '-i', inputPath,
      '-ss', String(chunk.startSec),
      '-t', String(chunkDurationSec),
      '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
      chunk.path,
    ], 120000);
  }, 6);

  return { tmpDir, chunks: chunkDescs };
}

async function transcribeChunkWithSarvam(chunkPath, language, apiKey) {
  const fileBuffer = await fs.readFile(chunkPath);
  const blob = new Blob([fileBuffer], { type: 'audio/wav' });

  const formData = new FormData();
  formData.append('file', blob, path.basename(chunkPath));
  formData.append('model', 'saaras:v3');
  formData.append('mode', 'transcribe');
  formData.append('with_timestamps', 'true');

  // Map language codes: hi -> hi-IN
  const langCode = language.includes('-') ? language : `${language}-IN`;
  formData.append('language_code', langCode);

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sarvam API error (${response.status}): ${text}`);
  }

  return response.json();
}

async function transcribeWithSarvam(inputPath, language) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error('SARVAM_API_KEY not set');

  console.error('[Sarvam] Splitting audio into 25s chunks for API...');
  const { tmpDir, chunks } = await splitAudioIntoChunks(inputPath, 25);

  // Transcribe all chunks in parallel (concurrency=4 — Sarvam API rate limit safe)
  console.error(`[Sarvam] Transcribing ${chunks.length} chunks in parallel (concurrency=4)...`);
  const chunkResults = await parallelMap(chunks, async (chunk) => {
    console.error(`[Sarvam] Transcribing chunk ${chunk.index + 1}/${chunks.length}...`);
    try {
      const result = await transcribeChunkWithSarvam(chunk.path, language, apiKey);
      return { chunk, result, error: null };
    } catch (e) {
      console.error(`[Sarvam] Chunk ${chunk.index} failed: ${e.message}`);
      return { chunk, result: null, error: e.message };
    }
  }, 4);

  const segments = [];
  const allWords = [];
  let segIdx = 0;

  try {
    for (const { chunk, result, error } of chunkResults) {
      if (error || !result) continue;
      const offsetUs = Math.round(chunk.startSec * 1_000_000);

      try {
        const transcriptText = result.transcript || '';

        if (!transcriptText.trim()) continue;

        // Build segment from chunk — sanitize Sarvam output
        const chunkWords = [];
        if (result.timestamps?.words) {
          for (const w of result.timestamps.words) {
            const rawText = (w.word || w.text || '').trim();
            // Skip words with empty text
            if (!rawText) continue;

            let wStartUs = Math.round((w.start_time_seconds || 0) * 1_000_000) + offsetUs;
            let wEndUs = Math.round((w.end_time_seconds || 0) * 1_000_000) + offsetUs;

            // Ensure endUs > startUs — assign minimum 50ms duration if needed
            if (wEndUs <= wStartUs) {
              wEndUs = wStartUs + 50_000; // 50ms minimum word duration
            }

            const wordObj = {
              id: `word-${segIdx}-${allWords.length + chunkWords.length}`,
              text: rawText,
              normalized: rawText.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ''),
              startUs: wStartUs,
              endUs: wEndUs,
              confidence: 0.92,
            };
            chunkWords.push(wordObj);
          }
        }

        // Determine segment timing
        const chunkEndUs = offsetUs + 25_000_000;
        let segStartUs, segEndUs;

        // Check if word timestamps are actually valid (not all zeros)
        const hasValidWordTimestamps = chunkWords.length > 0 &&
          chunkWords.some(w => w.startUs > offsetUs || w.endUs > offsetUs + 50_000);

        if (hasValidWordTimestamps) {
          segStartUs = chunkWords[0].startUs;
          segEndUs = chunkWords[chunkWords.length - 1].endUs;
        } else {
          // Word timestamps are all zeros/invalid — use chunk-level timing instead
          segStartUs = offsetUs;
          segEndUs = chunkEndUs;
        }

        // Ensure segment endUs > startUs
        if (segEndUs <= segStartUs) {
          segEndUs = segStartUs + 1_000_000; // 1 second minimum segment duration
        }

        // Use buildWords to synthesize proper word timing if word timestamps were invalid
        const finalWords = hasValidWordTimestamps ? chunkWords : buildWords(transcriptText, segStartUs, segEndUs);

        // Add words to allWords
        for (const w of finalWords) {
          allWords.push(w);
        }

        const seg = {
          id: `seg-${segIdx}`,
          startUs: segStartUs,
          endUs: segEndUs,
          text: transcriptText.trim(),
          words: finalWords,
          confidence: 0.92,
        };
        segments.push(seg);
        segIdx++;

        console.error(`  [${chunk.startSec}s] ${transcriptText.trim().slice(0, 80)}...`);
      } catch (e) {
        console.error(`[Sarvam] Chunk ${chunk.index} failed: ${e.message}`);
      }
    }
  } finally {
    // Cleanup temp chunks
    for (const chunk of chunks) {
      await fs.unlink(chunk.path).catch(() => { });
    }
    await fs.rmdir(tmpDir).catch(() => { });
  }

  console.error(`[Sarvam] Done: ${segments.length} segments, ${allWords.length} words`);

  return {
    language: language || 'hi',
    segments,
    words: allWords,
    wordCount: allWords.length,
  };
}

async function getDurationUs(inputPath) {
  const hasFfprobe = await commandExists('ffprobe');
  if (!hasFfprobe) {
    return DEFAULT_DURATION_US;
  }

  try {
    const raw = await run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ]);
    const durationSec = Number(raw || '0');
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return DEFAULT_DURATION_US;
    }
    return Math.round(durationSec * 1_000_000);
  } catch {
    return DEFAULT_DURATION_US;
  }
}

function secondsToUs(seconds) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value * 1_000_000);
}

function parseSilenceRangesFromLog(stderr, durationUs) {
  const rows = String(stderr || '')
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);

  const ranges = [];
  let currentStartSec = null;

  for (const row of rows) {
    const startMatch = row.match(/silence_start:\s*([0-9.]+)/);
    if (startMatch) {
      currentStartSec = Number(startMatch[1]);
      continue;
    }

    const endMatch = row.match(/silence_end:\s*([0-9.]+)/);
    if (!endMatch) {
      continue;
    }
    const endSec = Number(endMatch[1]);
    if (!Number.isFinite(endSec)) {
      continue;
    }
    const startSec = Number.isFinite(currentStartSec) ? Number(currentStartSec) : Math.max(0, endSec - 0.35);
    currentStartSec = null;
    const startUs = Math.max(0, Math.min(durationUs, secondsToUs(startSec)));
    const endUs = Math.max(0, Math.min(durationUs, secondsToUs(endSec)));
    if (endUs - startUs < 220_000) {
      continue;
    }
    ranges.push({
      startUs,
      endUs,
      reason: 'silence',
      confidence: 0.74,
    });
  }

  if (Number.isFinite(currentStartSec) && currentStartSec >= 0 && durationUs > 0) {
    const startUs = Math.max(0, Math.min(durationUs, secondsToUs(currentStartSec)));
    if (durationUs - startUs >= 220_000) {
      ranges.push({
        startUs,
        endUs: durationUs,
        reason: 'silence',
        confidence: 0.7,
      });
    }
  }

  return ranges;
}

async function detectSilenceRanges(inputPath, durationUs) {
  const hasFfmpeg = await commandExists('ffmpeg');
  if (!hasFfmpeg) {
    return [];
  }

  try {
    // Use VideoToolbox hardware decode for faster silence analysis on Apple Silicon
    const hwArgs = await audioExtractArgs();
    const result = await runWithOutput(
      'ffmpeg',
      [
        '-hide_banner',
        ...hwArgs,
        '-i', inputPath,
        '-af', 'silencedetect=noise=-35dB:d=0.6',
        '-f', 'null', '-',
      ],
      6 * 60 * 1000,
    );
    return parseSilenceRangesFromLog(result.stderr, durationUs);
  } catch (error) {
    const stderr = String(error?.stderr || error?.message || '');
    return parseSilenceRangesFromLog(stderr, durationUs);
  }
}

function buildWords(text, startUs, endUs) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const span = endUs - startUs;
  const per = Math.max(1, Math.floor(span / tokens.length));

  return tokens.map((token, index) => {
    const s = startUs + per * index;
    const e = index === tokens.length - 1 ? endUs : Math.min(endUs, s + per);
    const normalized = token.toLowerCase().replace(/[^a-z0-9']/g, '');
    return {
      id: `word-${startUs}-${index + 1}`,
      text: token,
      normalized,
      startUs: s,
      endUs: e,
      confidence: 0.88,
    };
  });
}

async function extractAudioForWhisper(inputPath, outputPath) {
  // Whisper.cpp expects 16kHz WAV
  await runWithOutput('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-i', inputPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    outputPath
  ], 600000);
}

async function transcribeWithWhisperCpp(adapter, inputPath) {
  const { binary, model } = adapter;
  const tempWav = `${inputPath}.16k.wav`;
  try {
    await extractAudioForWhisper(inputPath, tempWav);
    const outputBase = tempWav.replace(/\.wav$/, '');
    const args = [
      '-m', model,
      '-f', tempWav,
      '--output-json',
      '--output-file', outputBase
    ];

    console.error(`[WhisperCpp] Running: ${binary} ${args.join(' ')}`);
    await runWithOutput(binary, args, 10 * 60 * 1000);

    const jsonPath = `${outputBase}.json`;
    try {
      const raw = await fs.readFile(jsonPath, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`Failed to read whisper output: ${e.message}`);
    }
  } finally {
    try { await fs.unlink(tempWav); } catch { }
  }
}

async function transcribeWithFasterWhisper(adapter, inputPath) {
  const { binary } = adapter;
  const modelSize = (adapter.model && adapter.model !== 'auto') ? adapter.model : 'tiny';

  console.error(`[FasterWhisper] Transcribing with model '${modelSize}' using ${binary}...`);

  const result = await runWithOutput(binary, [
    TRANSCRIBE_SCRIPT,
    inputPath,
    '--model', modelSize,
  ], 15 * 60 * 1000); // 15 min timeout for large files

  try {
    return JSON.parse(result.stdout);
  } catch (e) {
    console.error('[FasterWhisper] Raw stdout:', result.stdout?.slice(0, 500));
    console.error('[FasterWhisper] Stderr:', result.stderr?.slice(0, 500));
    throw new Error(`Failed to parse faster-whisper output: ${e.message}`);
  }
}

function normalizeFasterWhisperTranscript(fwResult, durationUs) {
  const segments = (fwResult.segments || []).map((seg) => {
    return {
      id: seg.id,
      startUs: seg.startUs,
      endUs: seg.endUs,
      text: seg.text,
      words: seg.words || buildWords(seg.text, seg.startUs, seg.endUs),
      confidence: seg.confidence || 0.9,
    };
  });

  return {
    language: fwResult.language || 'en',
    segments,
    wordCount: fwResult.wordCount || segments.reduce((sum, s) => sum + (s.words?.length || 0), 0),
  };
}

function normalizeWhisperTranscript(whisperJson, durationUs) {
  // Whisper.cpp JSON format:
  // { transcription: [ { timestamps: { from: "00:00:00,000", to: ... }, text: "...", tokens: [] } ] }
  // OR older: { result: [ { from: 0, to: 100, text: "..." } ] }
  // We need to adapt based on actual output.

  // Standard whisper.cpp JSON output usually looks like:
  // { "transcription": [ { "timestamps": { "from": "...", "to": "..." }, "offsets": { "from": 0, "to": 2000 }, "text": "...", "tokens": [...] } ] }

  const segments = (whisperJson.transcription || whisperJson.result || []).map((seg, idx) => {
    // timestamps.from is "HH:MM:SS,mmm"
    // offsets.from is ms

    let startUs = 0;
    let endUs = 0;

    if (seg.offsets) {
      startUs = seg.offsets.from * 1000; // ms to us
      endUs = seg.offsets.to * 1000;
    } else {
      // Parse timestamp string if needed, or fallback
      // Simplified for now
    }

    const text = seg.text.trim();
    const words = []; // Whisper.cpp doesn't always give word-level timestamps in simple JSON mode unless -ml 1 is used?
    // Actually, it produces tokens. Mapping tokens to words is hard without robust logic.
    // We will synthesize word-level timing from segment timing for now if words are missing.

    return {
      id: `seg-${idx}`,
      startUs: Math.round(startUs),
      endUs: Math.round(endUs),
      text,
      words: buildWords(text, startUs, endUs), // Use existing helper to distribute words evenly
      confidence: 0.9 // Placeholder
    };
  });

  return {
    language: 'en', // TODO: detect language?
    segments,
    wordCount: segments.reduce((sum, s) => sum + s.words.length, 0)
  };
}

function buildSyntheticTranscript({ durationUs, mode, language, adapter }) {
  // If we are using a local adapter and it is indeed Whisper, we shouldn't be here in "Synthetic" function 
  // unless we failed or fallback.
  // But wait, the original pipeline calls this "buildSyntheticTranscript".
  // We will rename the flow in main() to call real transcription if available.

  const segmentCount = Math.min(8, Math.max(4, Math.floor(durationUs / 2_000_000)));
  const segmentDuration = Math.max(500_000, Math.floor(durationUs / segmentCount));
  const segments = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const startUs = index * segmentDuration;
    const endUs = index === segmentCount - 1 ? durationUs : Math.min(durationUs, startUs + segmentDuration);
    const filler = index % 3 === 1 ? 'um ' : '';
    const text = `Segment ${index + 1} ${filler}generated in ${mode} mode with ${adapter} for ${language} workflow.`;
    const words = buildWords(text, startUs, endUs);
    segments.push({
      id: `seg-${index + 1}`,
      startUs,
      endUs,
      text,
      confidence: 0.86,
      words,
    });
  }

  return {
    language,
    segments,
    wordCount: segments.reduce((sum, segment) => sum + segment.words.length, 0),
  };
}

function normalizeFingerprint(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(' ');
}

function detectRepetitionRanges(transcriptPayload, durationUs) {
  const seen = new Set();
  const ranges = [];
  const segments = Array.isArray(transcriptPayload?.segments) ? transcriptPayload.segments : [];

  for (const segment of segments) {
    const fingerprint = normalizeFingerprint(segment?.text || '');
    if (fingerprint.length < 14) {
      continue;
    }
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      continue;
    }
    const startUs = Math.max(0, Number(segment?.startUs || 0));
    const endUs = Math.min(durationUs, Math.max(startUs, Number(segment?.endUs || 0)));
    if (endUs - startUs < 300_000) {
      continue;
    }
    ranges.push({
      startUs,
      endUs,
      reason: 'repetition',
      confidence: 0.63,
    });
  }

  return ranges;
}

function toCanonicalTranscript({
  projectId,
  inputPath,
  sourceRef,
  mode,
  language,
  durationUs,
  adapter,
  transcript,
}) {
  const words = [];
  const segments = transcript.segments.map((segment) => {
    const wordIds = [];
    for (const word of segment.words) {
      words.push(word);
      wordIds.push(word.id);
    }
    return {
      id: segment.id,
      startUs: segment.startUs,
      endUs: segment.endUs,
      text: segment.text,
      wordIds,
      confidence: segment.confidence,
    };
  });

  return {
    transcriptId: `tx-${Date.now()}`,
    projectId,
    createdAt: new Date().toISOString(),
    mode,
    language,
    source: {
      path: inputPath,
      ref: sourceRef,
      durationUs,
    },
    adapter: {
      kind: adapter.kind,
      runtime: adapter.runtime,
      binary: adapter.binary,
      model: adapter.model,
      engine: `${adapter.kind}:${adapter.runtime}:stub`,
    },
    words,
    segments,
    wordCount: words.length,
  };
}

function clampRanges(ranges, durationUs) {
  const normalized = ranges
    .map((range) => ({
      startUs: Math.max(0, Math.min(durationUs, Math.round(range.startUs))),
      endUs: Math.max(0, Math.min(durationUs, Math.round(range.endUs))),
      reason: range.reason,
      confidence: range.confidence,
    }))
    .filter((range) => range.endUs > range.startUs)
    .sort((a, b) => a.startUs - b.startUs);

  const merged = [];
  for (const range of normalized) {
    const prev = merged[merged.length - 1];
    if (!prev || range.startUs > prev.endUs) {
      merged.push(range);
      continue;
    }
    if (range.endUs > prev.endUs) {
      prev.endUs = range.endUs;
    }
    prev.reason = `${prev.reason},${range.reason}`;
    prev.confidence = Math.max(prev.confidence, range.confidence);
  }

  return merged;
}



async function generateCutPlanWithOllama(transcriptPayload, llmConfig) {
  const segments = (transcriptPayload.segments || []);
  const MAX_SEGMENTS = 25;
  // Limit to 25 segments max to keep prompt size manageable for any LLM
  const trimmed = segments.slice(0, MAX_SEGMENTS);
  if (segments.length > MAX_SEGMENTS) {
    console.error(`[LLM] Warning: transcript has ${segments.length} segments — analyzing first ${MAX_SEGMENTS} only`);
  }

  const simplifiedTranscript = trimmed.map(s => ({
    startUs: s.startUs,
    endUs: s.endUs,
    text: (s.text || '').slice(0, 150),
  }));

  // Compute the exact time range the LLM is seeing so it can't hallucinate cuts outside it
  const rangeStartUs = trimmed.length > 0 ? trimmed[0].startUs : 0;
  const rangeEndUs = trimmed.length > 0 ? trimmed[trimmed.length - 1].endUs : 0;

  const prompt = `You are an expert video editor AI. Analyze this Hindi/Hinglish transcript.

Transcript segments (${simplifiedTranscript.length} of ${segments.length} total):
${JSON.stringify(simplifiedTranscript, null, 1)}

IMPORTANT: You are only analyzing the time range ${rangeStartUs}–${rangeEndUs} microseconds.
All startUs/endUs values in your response MUST be within this range. Do NOT suggest cuts outside it.

Tasks:
1. Identify sections to CUT - repetitions, tangents, filler phrases
2. Label each section: intro, key-point, example, transition, conclusion
3. Suggest overlay text for 3-5 most important moments

Output ONLY raw JSON, no prose, no markdown:
{
  "removeRanges": [
    { "startUs": ${rangeStartUs}, "endUs": ${rangeStartUs}, "reason": "repetition|tangent|filler", "confidence": 0.9 }
  ],
  "sections": [
    { "startUs": ${rangeStartUs}, "endUs": ${rangeEndUs}, "type": "intro|key-point|example|transition|conclusion", "summary": "brief" }
  ],
  "overlayTexts": [
    { "startUs": ${rangeStartUs}, "endUs": ${rangeStartUs}, "text": "Key insight to show on screen" }
  ]
}`;

  console.error(`[LLM] Generating AI cut plan with ${llmConfig.provider}/${llmConfig.model}...`);

  // Retry up to 2 times if JSON parsing fails
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await runLLMPrompt(llmConfig, prompt, 300000); // 5 min timeout for gpt-5.2
      const result = extractJsonFromLLMOutput(response);

      // Ensure required fields exist
      if (!Array.isArray(result.removeRanges)) result.removeRanges = [];
      if (!Array.isArray(result.sections)) result.sections = [];
      if (!Array.isArray(result.overlayTexts)) result.overlayTexts = [];

      // Clamp: discard any entries outside the analyzed time range (LLM hallucination guard)
      if (rangeEndUs > 0) {
        const inRange = r => Number(r.startUs) >= rangeStartUs && Number(r.endUs) <= rangeEndUs + 1_000_000;
        const before = result.removeRanges.length;
        result.removeRanges = result.removeRanges.filter(inRange);
        result.sections = result.sections.filter(inRange);
        result.overlayTexts = result.overlayTexts.filter(inRange);
        const dropped = before - result.removeRanges.length;
        if (dropped > 0) console.error(`[LLM] Dropped ${dropped} out-of-range cut suggestions`);
      }

      console.error(`[LLM] AI analysis: ${result.removeRanges.length} cuts, ${result.sections.length} sections, ${result.overlayTexts.length} overlays`);
      return result;
    } catch (e) {
      console.error(`[LLM] Attempt ${attempt} failed:`, e.message);
      if (attempt === 2) throw e;
    }
  }
}

function buildSyntheticCutPlan(durationUs, transcriptPayload, { silenceRanges = [] } = {}) {
  const candidates = [];
  let fillerWordCount = 0;

  if (durationUs > 2_000_000) {
    candidates.push({
      startUs: 400_000,
      endUs: 1_050_000,
      reason: 'intro-silence',
      confidence: 0.72,
    });
  }

  for (const word of transcriptPayload.words) {
    if (!FILLER_TOKENS.has(word.normalized)) {
      continue;
    }
    fillerWordCount += 1;
    candidates.push({
      startUs: Math.max(0, word.startUs - 120_000),
      endUs: Math.min(durationUs, word.endUs + 120_000),
      reason: 'filler-word',
      confidence: 0.64,
    });
  }

  for (let index = 0; index < transcriptPayload.segments.length - 1; index += 1) {
    const current = transcriptPayload.segments[index];
    const next = transcriptPayload.segments[index + 1];
    const gap = next.startUs - current.endUs;
    if (gap < 800_000) {
      continue;
    }
    const midpoint = current.endUs + Math.floor(gap / 2);
    candidates.push({
      startUs: Math.max(0, midpoint - 100_000),
      endUs: Math.min(durationUs, midpoint + 100_000),
      reason: 'long-pause',
      confidence: 0.67,
    });
  }

  if (durationUs > 8_000_000) {
    const mid = Math.round(durationUs * 0.48);
    candidates.push({
      startUs: Math.max(0, mid - 250_000),
      endUs: Math.min(durationUs, mid + 250_000),
      reason: 'filler-pause',
      confidence: 0.66,
    });
  }

  const normalizedSilence = Array.isArray(silenceRanges)
    ? silenceRanges
      .map((range) => ({
        startUs: Number(range?.startUs || 0),
        endUs: Number(range?.endUs || 0),
        reason: 'silence',
        confidence: Number(range?.confidence || 0.72),
      }))
      .filter((range) => range.endUs > range.startUs)
      // Only cut silences longer than 800ms, and add 150ms padding on each side
      .filter((range) => (range.endUs - range.startUs) > 800_000)
      .map((range) => ({
        ...range,
        startUs: range.startUs + 150_000,  // keep 150ms of silence before cut
        endUs: range.endUs - 150_000,      // keep 150ms of silence after cut
      }))
      .filter((range) => range.endUs > range.startUs)
    : [];
  candidates.push(...normalizedSilence);

  const repetitionRanges = detectRepetitionRanges(transcriptPayload, durationUs);
  candidates.push(...repetitionRanges);

  const removeRanges = clampRanges(candidates, durationUs);
  return {
    removeRanges,
    analysis: {
      silenceRangeCount: normalizedSilence.length,
      fillerWordCount,
      repetitionCount: repetitionRanges.length,
    },
  };
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function writeText(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function formatSubtitleTime(us, delimiter) {
  const totalMs = Math.max(0, Math.round(us / 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');
  return `${hh}:${mm}:${ss}${delimiter}${mmm}`;
}

function buildSrt(segments) {
  const lines = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    lines.push(String(index + 1));
    lines.push(
      `${formatSubtitleTime(segment.startUs, ',')} --> ${formatSubtitleTime(segment.endUs, ',')}`,
    );
    lines.push(segment.text);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function buildVtt(segments) {
  const lines = ['WEBVTT', ''];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    lines.push(String(index + 1));
    lines.push(
      `${formatSubtitleTime(segment.startUs, '.')} --> ${formatSubtitleTime(segment.endUs, '.')}`,
    );
    lines.push(segment.text);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const projectId = readArg('--project-id');
  const input = readArg('--input');
  const mode = safeMode(readArg('--mode', 'hybrid'));
  const language = readArg('--language', 'en') || 'en';
  const sourceRef = readArg('--source-ref', 'source-video') || 'source-video';
  const fps = Number(readArg('--fps', '30')) || 30;
  const fallbackPolicy = safeFallbackPolicy(readArg('--fallback-policy', 'local-first'));
  const transcriptionModel = readArg('--transcription-model', '').trim();
  // Accept pre-known duration (from ingest metadata) to skip ffprobe on large files
  const knownDurationSec = Number(readArg('--duration-sec', '0')) || 0;
  // Auto-detect best LLM: Codex CLI → OpenAI → Google → Anthropic → Ollama
  const autoLLM = await detectBestLLM();
  const cutPlannerModel =
    readArg('--cut-planner-model', '').trim() ||
    process.env.LAPAAS_CUT_PLANNER_MODEL ||
    autoLLM.model;
  const llmProvider = readArg('--llm-provider', process.env.LAPAAS_LLM_PROVIDER || autoLLM.provider);
  const llmModel = readArg('--llm-model', process.env.LAPAAS_LLM_MODEL || cutPlannerModel);
  const llmConfig = { provider: llmProvider, model: llmModel };

  if (!projectId) {
    throw new Error('Missing required argument: --project-id');
  }

  if (!input) {
    throw new Error('Missing required argument: --input');
  }

  const inputPath = path.resolve(input);
  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const cutPlanPath = path.join(projectDir, 'cut-plan.json');
  const jobPath = path.join(projectDir, 'start-editing-job.json');
  const subtitlesDir = path.join(projectDir, 'subtitles');
  const srtPath = path.join(subtitlesDir, 'subtitles.srt');
  const vttPath = path.join(subtitlesDir, 'subtitles.vtt');
  const tracker = createStageTracker();
  let adapter = null;
  let durationUs = 0;
  let transcriptPayload = null;
  let cutPlanPayload = null;
  let removeRanges = [];
  let silenceRanges = [];
  let cutAnalysis = {
    silenceRangeCount: 0,
    fillerWordCount: 0,
    repetitionCount: 0,
  };
  const startedAt = new Date().toISOString();

  try {
    adapter = await tracker.run('adapter-selection', () =>
      selectTranscriptionAdapter({
        mode,
        fallbackPolicy,
        transcriptionModel,
        language,
      }),
    );

    await writeJson(jobPath, {
      projectId,
      status: 'TRANSCRIPTION_IN_PROGRESS',
      mode,
      fallbackPolicy,
      adapter,
      startedAt,
    });

    // Use pre-known duration from ingest metadata if available — skips ffprobe on large files
    durationUs = knownDurationSec > 0
      ? Math.round(knownDurationSec * 1_000_000)
      : await tracker.run('duration-probe', () => getDurationUs(inputPath));
    // Skip CPU-heavy silence detection for all API-based transcription providers.
    // AI cut planning (Codex) will derive cuts from the transcript instead.
    if (adapter.kind === 'api') {
      console.error(`[Pipeline] API transcription (${adapter.runtime}) — skipping local silence detection`);
      silenceRanges = [];
    } else {
      silenceRanges = await tracker.run('silence-analysis', () => detectSilenceRanges(inputPath, durationUs));
    }

    transcriptPayload = await tracker.run('transcription-synthesis', async () => {
      let transcript;

      if (adapter.runtime === 'sarvam') {
        // Sarvam AI Saaras — best for Hindi/Indian languages
        try {
          console.error('Starting Sarvam AI transcription (Hindi-optimized)...');
          transcript = await transcribeWithSarvam(inputPath, language);
        } catch (e) {
          console.error('Sarvam transcription failed, trying mlx_whisper (Metal GPU) fallback:', e.message);
          try {
            const mlxAvailable = await isMlxWhisperAvailable();
            if (mlxAvailable) {
              console.error('[Metal] Running mlx_whisper large-v3-turbo on Metal GPU...');
              const tmpOut = path.join(os.tmpdir(), `mlx_whisper_${Date.now()}`);
              await fs.mkdir(tmpOut, { recursive: true });
              await transcribeWithMlxWhisper(inputPath, language, tmpOut);
              const jsonFile = path.join(tmpOut, path.basename(inputPath) + '.json');
              const raw = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
              // Normalize mlx_whisper output to canonical transcript format
              const mlxSegments = (raw.segments || []).map((s, i) => ({
                id: `seg-${i}`,
                startUs: Math.round((s.start || 0) * 1_000_000),
                endUs: Math.round((s.end || 0) * 1_000_000),
                text: (s.text || '').trim(),
                words: buildWords((s.text || '').trim(),
                  Math.round((s.start || 0) * 1_000_000),
                  Math.round((s.end || 0) * 1_000_000)),
                confidence: 0.9,
              }));
              transcript = {
                language,
                segments: mlxSegments,
                words: mlxSegments.flatMap(s => s.words),
                wordCount: mlxSegments.reduce((n, s) => n + s.words.length, 0),
              };
              await fs.rm(tmpOut, { recursive: true }).catch(() => {});
            } else {
              throw new Error('mlx_whisper not available');
            }
          } catch (e2) {
            console.error('mlx_whisper fallback also failed:', e2.message);
            transcript = buildSyntheticTranscript({ durationUs, mode, language, adapter: 'sarvam:fallback' });
          }
        }
      } else if (adapter.kind === 'local' && adapter.runtime === 'faster_whisper') {
        try {
          console.error('Starting local faster-whisper transcription...');
          const raw = await transcribeWithFasterWhisper(adapter, inputPath);
          transcript = normalizeFasterWhisperTranscript(raw, durationUs);
        } catch (e) {
          console.error('faster-whisper transcription failed, falling back to synthetic:', e.message);
          transcript = buildSyntheticTranscript({
            durationUs, mode, language,
            adapter: `${adapter.kind}:${adapter.runtime}:fallback`,
          });
        }
      } else if (adapter.kind === 'local' && adapter.runtime === 'whisper_cpp') {
        try {
          console.error('Starting local Whisper.cpp transcription...');
          const raw = await transcribeWithWhisperCpp(adapter, inputPath);
          transcript = normalizeWhisperTranscript(raw, durationUs);
        } catch (e) {
          console.error('Local transcription failed, falling back to synthetic:', e);
          transcript = buildSyntheticTranscript({
            durationUs, mode, language,
            adapter: `${adapter.kind}:${adapter.runtime}:fallback`,
          });
        }
      } else {
        transcript = buildSyntheticTranscript({
          durationUs, mode, language,
          adapter: `${adapter.kind}:${adapter.runtime}`,
        });
      }

      const canonical = toCanonicalTranscript({
        projectId, inputPath, sourceRef, mode, language, durationUs, adapter, transcript,
      });
      return validateCanonicalTranscript(canonical);
    });

    removeRanges = await tracker.run('cut-planning', async () => {
      let planned;
      const isLLM = cutPlannerModel && !cutPlannerModel.startsWith('heuristic');

      if (isLLM) {
        try {
          const llmResult = await generateCutPlanWithOllama(transcriptPayload, llmConfig);
          planned = {
            removeRanges: clampRanges(llmResult.removeRanges || [], durationUs),
            analysis: {
              silenceRangeCount: 0,
              fillerWordCount: 0,
              repetitionCount: 0,
              note: "Generated by LLM"
            }
          };
        } catch (e) {
          console.error("LLM cut planning failed, falling back to heuristic:", e);
          planned = buildSyntheticCutPlan(durationUs, transcriptPayload, { silenceRanges });
        }
      } else {
        planned = buildSyntheticCutPlan(durationUs, transcriptPayload, { silenceRanges });
      }

      cutAnalysis = planned.analysis;
      return validateCutRanges(planned.removeRanges, durationUs);
    });

    cutPlanPayload = {
      planId: `cp-${Date.now()}`,
      projectId,
      createdAt: new Date().toISOString(),
      mode,
      fallbackPolicy,
      sourceRef,
      planner: {
        model: cutPlannerModel,
        strategy: 'heuristic-cut-planner-v1',
      },
      analysis: cutAnalysis,
      removeRanges,
      rationale: removeRanges.map((range) => ({
        startUs: range.startUs,
        endUs: range.endUs,
        reason: range.reason,
        confidence: range.confidence,
      })),
    };
    cutPlanPayload = validateCutPlan(cutPlanPayload, durationUs);

    await tracker.run('artifact-write', async () => {
      await writeJson(transcriptPath, transcriptPayload);
      await writeText(srtPath, buildSrt(transcriptPayload.segments));
      await writeText(vttPath, buildVtt(transcriptPayload.segments));
      await writeJson(cutPlanPath, cutPlanPayload);
    });

    const stageDurationsMs = tracker.snapshot();
    const completedAt = new Date().toISOString();
    const telemetry = await recordProjectTelemetry({
      projectDir,
      projectId,
      pipeline: 'start-editing',
      status: 'ROUGH_CUT_PLAN_READY',
      stageDurationsMs,
      meta: {
        mode,
        fallbackPolicy,
        transcriptionModel: adapter?.model || '',
        cutPlannerModel,
      },
    });

    await writeJson(jobPath, {
      projectId,
      status: 'ROUGH_CUT_PLAN_READY',
      mode,
      fallbackPolicy,
      adapter,
      planner: cutPlanPayload.planner,
      startedAt,
      completedAt,
      transcriptPath,
      cutPlanPath,
      stageDurationsMs,
      telemetryPath: telemetry.summaryPath,
      subtitles: {
        srtPath,
        vttPath,
      },
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          projectId,
          mode,
          language,
          inputPath,
          sourceRef,
          fps,
          durationUs,
          transcriptPath,
          cutPlanPath,
          subtitlePaths: {
            srt: srtPath,
            vtt: vttPath,
          },
          stageDurationsMs,
          telemetryPath: telemetry.summaryPath,
          transcription: {
            adapter: {
              kind: adapter.kind,
              runtime: adapter.runtime,
              model: adapter.model,
            },
            fallbackPolicy,
            warnings: adapter.warnings,
          },
          planning: {
            cutPlanner: cutPlanPayload.planner,
            analysis: cutAnalysis,
          },
          removeRanges,
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    const stageDurationsMs = tracker.snapshot();
    await writeJson(jobPath, {
      projectId,
      status: 'ROUGH_CUT_FAILED',
      mode,
      fallbackPolicy,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: String(error?.message ?? error),
      stageDurationsMs,
    }).catch(() => { });

    await recordProjectTelemetry({
      projectDir,
      projectId,
      pipeline: 'start-editing',
      status: 'ROUGH_CUT_FAILED',
      stageDurationsMs,
      meta: {
        mode,
        fallbackPolicy,
      },
      error: String(error?.message ?? error),
    }).catch(() => { });

    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
