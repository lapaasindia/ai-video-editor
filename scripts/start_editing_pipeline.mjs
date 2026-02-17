#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { createStageTracker, recordProjectTelemetry } from './lib/pipeline_telemetry.mjs';
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

async function detectLocalTranscriptionRuntime() {
  const whisperCli = await commandExists('whisper-cli');
  if (whisperCli) {
    return { available: true, runtime: 'whisper_cpp', binary: whisperCli };
  }

  const whisperCpp = await commandExists('whisper-cpp');
  if (whisperCpp) {
    return { available: true, runtime: 'whisper_cpp', binary: whisperCpp };
  }

  // Check generic 'main' if it looks like whisper? Too risky to match any 'main'.

  const python3 = await commandExists('python3');
  if (python3 && (await pythonPackageExists('faster_whisper'))) {
    return { available: true, runtime: 'faster_whisper', binary: python3 };
  }

  const mlxWhisper = await commandExists('mlx_whisper');
  if (mlxWhisper) {
    return { available: true, runtime: 'mlx_whisper', binary: mlxWhisper };
  }

  return { available: false, runtime: '', binary: '' };
}

async function selectTranscriptionAdapter({ mode, fallbackPolicy, transcriptionModel }) {
  const local = await detectLocalTranscriptionRuntime();
  const apiProvider = process.env.LAPAAS_TRANSCRIPTION_API_PROVIDER || 'openai';
  const defaultApiModel = process.env.LAPAAS_API_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
  const defaultLocalModel = process.env.LAPAAS_LOCAL_TRANSCRIBE_MODEL || 'auto';
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY || process.env.LAPAAS_API_KEY);
  const warnings = [];
  const effectiveFallbackPolicy = safeFallbackPolicy(fallbackPolicy);
  const localModel = transcriptionModel || defaultLocalModel;
  const apiModel = transcriptionModel || defaultApiModel;

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

  if (mode === 'local') {
    if (!local.available) {
      throw new Error(
        'Local mode requested but no local transcription runtime detected. Install whisper.cpp, faster-whisper, or mlx_whisper.',
      );
    }
    return buildLocalAdapter();
  }

  if (mode === 'api') {
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
    if (!hasApiKey) {
      warnings.push(
        'API-only fallback policy selected but OPENAI_API_KEY/LAPAAS_API_KEY is missing. Stub transcription output was generated.',
      );
    }
    return buildApiAdapter();
  }

  if (effectiveFallbackPolicy === 'api-first') {
    if (hasApiKey) {
      return buildApiAdapter();
    }
    warnings.push('api-first fallback: API key missing, trying local runtime.');
    if (local.available) {
      return buildLocalAdapter();
    }
    warnings.push(
      'OPENAI_API_KEY/LAPAAS_API_KEY is missing and no local runtime detected. Stub transcription output was generated.',
    );
    return buildApiAdapter();
  }

  if (local.available) {
    return buildLocalAdapter();
  }

  warnings.push('Hybrid mode fallback: no local runtime detected, using API adapter path.');
  if (!hasApiKey) {
    warnings.push(
      'OPENAI_API_KEY/LAPAAS_API_KEY is missing. Stub transcription output was generated.',
    );
  }
  return buildApiAdapter();
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
    const result = await runWithOutput(
      'ffmpeg',
      [
        '-hide_banner',
        '-i',
        inputPath,
        '-af',
        'silencedetect=noise=-35dB:d=0.35',
        '-f',
        'null',
        '-',
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
  // Assume model is a path or we need to find it. 
  // For now, if 'model' is just a name like 'base.en', we assume it's in specific dir or user provided full path.
  // We will assume 'model' arg passed to script is the full path or relative path to .bin file.

  // Create temp wav
  const tempWav = `${inputPath}.16k.wav`;
  try {
    await extractAudioForWhisper(inputPath, tempWav);

    // Output file base (whisper-cli adds .json)
    // We use inputPath dirname + filename w/o extension
    const outputBase = tempWav.replace(/\.wav$/, '');

    // whisper-cli args: -m <model> -f <wav> --output-json
    // Note: arguments depend on specific whisper.cpp version/build. 
    // Standard main example: ./main -m models/ggml-base.en.bin -f samples/jfk.wav -oj

    const args = [
      '-m', model,
      '-f', tempWav,
      '--output-json', // -oj
      '--output-file', outputBase // implicit in some versions, explicit in others. 
      // -of specifies output filename WITHOUT extension.
    ];

    console.log(`[WhisperCpp] Running: ${binary} ${args.join(' ')}`);
    await runWithOutput(binary, args, 10 * 60 * 1000); // 10 min timeout

    const jsonPath = `${outputBase}.json`;
    try {
      const raw = await fs.readFile(jsonPath, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`Failed to read whisper output: ${e.message}`);
    }

  } finally {
    // Cleanup temp wav
    try { await fs.unlink(tempWav); } catch { }
    // Cleanup json? Maybe keep for debug? We'll leave it or delete it.
    // try { await fs.unlink(`${tempWav.replace(/\.wav$/, '')}.json`); } catch {}
  }
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

async function generateCutPlanWithOllama(transcriptPayload, model) {
  const systemPrompt = `You are an expert video editor. Your task is to analyze the provided transcript and identify sections to REMOVE (cut out) to make the video concise, engaging, and professional.
  
  Focus on removing:
  1. Filler words (um, uh, like) if they disrupt flow.
  2. Long silences or pauses (implied by gaps in timestamps).
  3. Repetitive redundancy.
  4. Off-topic tangents.
  
  Output MUST be valid JSON with this structure:
  {
    "removeRanges": [
      { "startUs": 1000000, "endUs": 2500000, "reason": "filler-word", "confidence": 0.9 },
      ...
    ]
  }
  
  Use 'startUs' and 'endUs' in microseconds (integers).
  Do NOT output markdown. Output ONLY the JSON object.`;

  // Simplify transcript for prompt to save context tokens
  const simplifiedTranscript = transcriptPayload.segments.map(s => ({
    startUs: s.startUs,
    endUs: s.endUs,
    text: s.text
  }));

  const userPrompt = `Transcript:\n${JSON.stringify(simplifiedTranscript, null, 2)}\n\nGenerate the cut plan JSON.`;

  try {
    console.log(`[Ollama] Generating cut plan with ${model}...`);

    // Write prompt to temp file to avoid shell escaping issues and stdin weirdness
    const promptPath = path.join(os.tmpdir(), `ollama_prompt_${Date.now()}.txt`);
    await fs.writeFile(promptPath, systemPrompt + "\n\n" + userPrompt);

    try {
      // Use shell redirection: ollama run model < promptPath
      // exec requires shell: true (default)
      // We need 'child_process' exec, not execFile
      const { exec } = await import('node:child_process');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(`ollama run ${model} < "${promptPath}"`, { timeout: 120000 });

      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in LLM output");
      }
    } finally {
      await fs.unlink(promptPath).catch(() => { });
    }
  } catch (e) {
    console.error("Ollama planning failed:", e);
    throw e;
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
    if (gap < 450_000) {
      continue;
    }
    const midpoint = current.endUs + Math.floor(gap / 2);
    candidates.push({
      startUs: Math.max(0, midpoint - 140_000),
      endUs: Math.min(durationUs, midpoint + 140_000),
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
  const cutPlannerModel =
    readArg('--cut-planner-model', '').trim() ||
    process.env.LAPAAS_CUT_PLANNER_MODEL ||
    'heuristic-cut-planner-v1';

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

  const projectDir = path.resolve('desktop', 'data', projectId);
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

    durationUs = await tracker.run('duration-probe', () => getDurationUs(inputPath));
    silenceRanges = await tracker.run('silence-analysis', () => detectSilenceRanges(inputPath, durationUs));

    transcriptPayload = await tracker.run('transcription-synthesis', async () => {
      let transcript;

      if (adapter.kind === 'local' && adapter.runtime === 'whisper_cpp') {
        try {
          console.log('Starting local Whisper transcription...');
          const raw = await transcribeWithWhisperCpp(adapter, inputPath);
          transcript = normalizeWhisperTranscript(raw, durationUs);
        } catch (e) {
          console.error('Local transcription failed, falling back to synthetic:', e);
          transcript = buildSyntheticTranscript({
            durationUs,
            mode,
            language,
            adapter: `${adapter.kind}:${adapter.runtime}:fallback`,
          });
        }
      } else {
        transcript = buildSyntheticTranscript({
          durationUs,
          mode,
          language,
          adapter: `${adapter.kind}:${adapter.runtime}`,
        });
      }

      const canonical = toCanonicalTranscript({
        projectId,
        inputPath,
        sourceRef,
        mode,
        language,
        durationUs,
        adapter,
        transcript,
      });
      return validateCanonicalTranscript(canonical);
    });

    removeRanges = await tracker.run('cut-planning', async () => {
      let planned;
      const isLLM = cutPlannerModel && !cutPlannerModel.startsWith('heuristic');

      if (isLLM) {
        try {
          const llmResult = await generateCutPlanWithOllama(transcriptPayload, cutPlannerModel);
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
