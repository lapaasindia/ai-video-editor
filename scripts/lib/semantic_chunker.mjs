#!/usr/bin/env node

/**
 * Semantic Chunker — Phase 6
 *
 * Replaces mechanical word-count/duration chunking with intelligent chunking:
 *   - Detects topic shift boundaries using text heuristics + optional LLM
 *   - Classifies chunk intent: explanation / story / example / data / opinion
 *   - Computes audio energy per chunk (via ffmpeg astats)
 *   - Validates chunk duration bounds (3s min, 15s max)
 *   - Auto-merges tiny chunks with neighbors
 *   - Auto-splits oversized chunks at sentence boundaries
 *   - Aligns chunk boundaries to silence gaps when available
 *
 * Reads: transcript.json (or transcript_annotated.json), cut-plan.json
 * Writes: semantic_chunks.json
 *
 * Usage:
 *   node scripts/lib/semantic_chunker.mjs \
 *     --project-id <id> [--project-dir <dir>] [--input <video>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

// ── Config ───────────────────────────────────────────────────────────────────

const CONFIG = {
  minChunkDurationUs: 3_000_000,     // 3s minimum
  maxChunkDurationUs: 15_000_000,    // 15s maximum
  targetChunkDurationUs: 7_000_000,  // ~7s ideal
  mergeThresholdUs: 2_500_000,       // Merge chunks shorter than 2.5s
  pauseGapThresholdUs: 1_500_000,    // 1.5s pause = natural boundary
  sentenceEndRe: /[.!?।]\s*$/,
  sentenceSplitRe: /(?<=[.!?।]\s)|(?<=\s{2,})/u,
};

// Intent classification keywords (heuristic — LLM upgrade path available)
const INTENT_KEYWORDS = {
  explanation: ['because', 'reason', 'means', 'basically', 'so ', 'this is', 'the way', 'how ', 'why ',
    'क्योंकि', 'मतलब', 'यानी', 'इसका कारण'],
  story: ['happened', 'then ', 'once ', 'remember', 'story', 'told me', 'when i', 'when we',
    'हुआ', 'फिर', 'एक बार', 'कहानी'],
  example: ['for example', 'for instance', 'like ', 'such as', 'consider', 'imagine', 'let\'s say',
    'जैसे', 'उदाहरण', 'मान लो'],
  data: ['percent', 'million', 'billion', 'crore', 'lakh', 'number', 'data', 'report', 'study', 'survey',
    'प्रतिशत', 'करोड़', 'लाख', 'रिपोर्ट', 'आंकड़ा'],
  opinion: ['i think', 'i believe', 'in my opinion', 'personally', 'i feel', 'should ', 'must ',
    'मेरा मानना', 'मुझे लगता', 'मेरे हिसाब'],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function run(command, args = [], timeout = 60000) {
  const { stdout, stderr } = await execFile(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    stdout: (stdout ?? '').toString().trim(),
    stderr: (stderr ?? '').toString().trim(),
  };
}

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// ── Intent Classification ────────────────────────────────────────────────────

function classifyIntent(text) {
  const lower = (text || '').toLowerCase();
  const scores = {};

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    scores[intent] = keywords.filter(kw => lower.includes(kw)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'general';
}

// ── Audio Energy Probe ───────────────────────────────────────────────────────

async function probeChunkEnergy(inputPath, startUs, endUs) {
  if (!inputPath) return null;

  const startSec = startUs / 1_000_000;
  const durationSec = (endUs - startUs) / 1_000_000;

  try {
    const { stderr } = await run('ffmpeg', [
      '-ss', String(startSec),
      '-t', String(durationSec),
      '-i', inputPath,
      '-af', 'volumedetect',
      '-f', 'null', '-',
    ], 30000);

    const meanMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
    const maxMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);

    return {
      meanDb: meanMatch ? parseFloat(meanMatch[1]) : null,
      maxDb: maxMatch ? parseFloat(maxMatch[1]) : null,
    };
  } catch {
    return null;
  }
}

// ── Step 1: Split segments into sentences ────────────────────────────────────

function segmentsToSentences(segments) {
  const sentences = [];

  for (const seg of segments) {
    const text = (seg.text || '').trim();
    if (!text) continue;

    const parts = text.split(CONFIG.sentenceSplitRe).map(p => p.trim()).filter(Boolean);

    if (parts.length <= 1) {
      sentences.push({
        text,
        startUs: seg.startUs,
        endUs: seg.endUs,
        confidence: seg.confidence ?? 1.0,
      });
      continue;
    }

    // Interpolate timestamps by character proportion
    const totalChars = text.length;
    let cursor = seg.startUs;
    for (const part of parts) {
      const fraction = part.length / totalChars;
      const durationUs = Math.round((seg.endUs - seg.startUs) * fraction);
      sentences.push({
        text: part,
        startUs: cursor,
        endUs: cursor + durationUs,
        confidence: seg.confidence ?? 1.0,
      });
      cursor += durationUs;
    }
  }

  return sentences;
}

// ── Step 2: Detect natural boundaries ────────────────────────────────────────

function detectBoundaries(sentences, silenceRanges) {
  const boundaries = new Set();

  for (let i = 1; i < sentences.length; i++) {
    const prev = sentences[i - 1];
    const curr = sentences[i];
    const gap = curr.startUs - prev.endUs;

    // Long pause = natural boundary
    if (gap >= CONFIG.pauseGapThresholdUs) {
      boundaries.add(i);
      continue;
    }

    // Sentence ends cleanly AND next starts a new thought
    if (CONFIG.sentenceEndRe.test(prev.text)) {
      // Check if this is near a silence range (natural pause)
      const nearSilence = silenceRanges.some(
        sr => Math.abs(sr.startUs - prev.endUs) < 500_000 || Math.abs(sr.endUs - curr.startUs) < 500_000
      );
      if (nearSilence) {
        boundaries.add(i);
        continue;
      }

      // Topic shift heuristic: different intent keywords
      const prevIntent = classifyIntent(prev.text);
      const currIntent = classifyIntent(curr.text);
      if (prevIntent !== 'general' && currIntent !== 'general' && prevIntent !== currIntent) {
        boundaries.add(i);
      }
    }
  }

  return boundaries;
}

// ── Step 3: Group sentences into chunks ──────────────────────────────────────

function groupIntoChunks(sentences, boundaries) {
  const chunks = [];
  let currentSentences = [];

  for (let i = 0; i < sentences.length; i++) {
    currentSentences.push(sentences[i]);

    const isLast = i === sentences.length - 1;
    const isBoundary = boundaries.has(i + 1);
    const chunkDuration = currentSentences.length > 0
      ? currentSentences[currentSentences.length - 1].endUs - currentSentences[0].startUs
      : 0;

    // Force break at boundaries or when duration exceeds target
    const shouldBreak = isLast || isBoundary || chunkDuration >= CONFIG.targetChunkDurationUs;

    if (shouldBreak && currentSentences.length > 0) {
      chunks.push({
        index: chunks.length,
        startUs: currentSentences[0].startUs,
        endUs: currentSentences[currentSentences.length - 1].endUs,
        text: currentSentences.map(s => s.text).join(' '),
        sentenceCount: currentSentences.length,
        avgConfidence: currentSentences.reduce((s, c) => s + c.confidence, 0) / currentSentences.length,
      });
      currentSentences = [];
    }
  }

  return chunks;
}

// ── Step 4: Validate and fix chunk durations ─────────────────────────────────

function validateAndFixChunks(chunks) {
  let result = [...chunks];
  const flags = [];

  // Merge tiny chunks
  let merged = true;
  while (merged) {
    merged = false;
    const next = [];
    for (let i = 0; i < result.length; i++) {
      const chunk = result[i];
      const duration = chunk.endUs - chunk.startUs;

      if (duration < CONFIG.mergeThresholdUs && next.length > 0) {
        // Merge with previous chunk
        const prev = next[next.length - 1];
        prev.endUs = chunk.endUs;
        prev.text = prev.text + ' ' + chunk.text;
        prev.sentenceCount += chunk.sentenceCount;
        prev.mergedFrom = (prev.mergedFrom || []).concat([chunk.index]);
        flags.push({ type: 'merged_tiny', chunkIndex: chunk.index, durationUs: duration });
        merged = true;
      } else if (duration < CONFIG.mergeThresholdUs && i + 1 < result.length) {
        // Merge with next chunk
        const nextChunk = result[i + 1];
        nextChunk.startUs = chunk.startUs;
        nextChunk.text = chunk.text + ' ' + nextChunk.text;
        nextChunk.sentenceCount += chunk.sentenceCount;
        nextChunk.mergedFrom = (nextChunk.mergedFrom || []).concat([chunk.index]);
        flags.push({ type: 'merged_tiny', chunkIndex: chunk.index, durationUs: duration });
        merged = true;
      } else {
        next.push(chunk);
      }
    }
    result = next;
  }

  // Split oversized chunks
  const split = [];
  for (const chunk of result) {
    const duration = chunk.endUs - chunk.startUs;

    if (duration > CONFIG.maxChunkDurationUs) {
      // Split at midpoint sentence boundary
      const words = chunk.text.split(/\s+/);
      const midWordIdx = Math.floor(words.length / 2);
      const firstHalf = words.slice(0, midWordIdx).join(' ');
      const secondHalf = words.slice(midWordIdx).join(' ');
      const midUs = chunk.startUs + Math.round(duration * (midWordIdx / words.length));

      split.push({
        ...chunk,
        endUs: midUs,
        text: firstHalf,
        sentenceCount: Math.ceil(chunk.sentenceCount / 2),
        splitFrom: chunk.index,
      });
      split.push({
        ...chunk,
        index: chunk.index + 0.5,
        startUs: midUs,
        text: secondHalf,
        sentenceCount: Math.floor(chunk.sentenceCount / 2),
        splitFrom: chunk.index,
      });
      flags.push({ type: 'split_oversized', chunkIndex: chunk.index, durationUs: duration });
    } else {
      split.push(chunk);
    }
  }

  // Re-index
  split.forEach((c, i) => { c.index = i; });

  return { chunks: split, validationFlags: flags };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = readArg('--project-id');
  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const inputPath = readArg('--input') || '';
  const annotatedPath = path.join(projectDir, 'transcript_annotated.json');
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const cutPlanPath = path.join(projectDir, 'cut-plan.json');
  const outputPath = path.join(projectDir, 'semantic_chunks.json');

  // Load transcript (prefer annotated version)
  let transcript;
  if (await exists(annotatedPath)) {
    transcript = await readJson(annotatedPath);
    console.error('[SemanticChunker] Using annotated transcript');
  } else if (await exists(transcriptPath)) {
    transcript = await readJson(transcriptPath);
    console.error('[SemanticChunker] Using raw transcript');
  } else {
    throw new Error('No transcript found');
  }

  const segments = transcript.segments || [];
  if (segments.length === 0) {
    throw new Error('Transcript has no segments');
  }

  // Load silence ranges for boundary alignment
  let silenceRanges = [];
  if (await exists(cutPlanPath)) {
    try {
      const cutPlan = await readJson(cutPlanPath);
      silenceRanges = (cutPlan.removeRanges || []).filter(r => r.reason === 'silence' || r.reason === 'long_pause');
    } catch { /* skip */ }
  }

  console.error(`[SemanticChunker] ${segments.length} segments, ${silenceRanges.length} silence ranges`);

  // Step 1: Explode into sentences
  const sentences = segmentsToSentences(segments);
  console.error(`[SemanticChunker] ${sentences.length} sentences extracted`);

  // Step 2: Detect natural boundaries
  const boundaries = detectBoundaries(sentences, silenceRanges);
  console.error(`[SemanticChunker] ${boundaries.size} natural boundaries detected`);

  // Step 3: Group into chunks
  const rawChunks = groupIntoChunks(sentences, boundaries);
  console.error(`[SemanticChunker] ${rawChunks.length} raw chunks formed`);

  // Step 4: Validate and fix
  const { chunks, validationFlags } = validateAndFixChunks(rawChunks);
  console.error(`[SemanticChunker] ${chunks.length} final chunks (${validationFlags.length} fixes applied)`);

  // Step 5: Classify intent + probe energy
  let resolvedInput = inputPath;
  if (!resolvedInput) {
    const metaPath = path.join(projectDir, 'media', 'metadata.json');
    if (await exists(metaPath)) {
      const meta = await readJson(metaPath);
      resolvedInput = meta.sourcePath || '';
    }
  }
  const hasVideo = resolvedInput && await exists(resolvedInput);

  for (const chunk of chunks) {
    chunk.intent = classifyIntent(chunk.text);
    chunk.wordCount = countWords(chunk.text);
    chunk.durationSec = Math.round((chunk.endUs - chunk.startUs) / 1000) / 1000;
    chunk.wordsPerSecond = chunk.durationSec > 0
      ? Math.round((chunk.wordCount / chunk.durationSec) * 10) / 10
      : 0;

    // Audio energy (optional — skip if no video available)
    if (hasVideo) {
      chunk.energy = await probeChunkEnergy(resolvedInput, chunk.startUs, chunk.endUs);
    } else {
      chunk.energy = null;
    }
  }

  // Summary
  const intentCounts = {};
  for (const c of chunks) {
    intentCounts[c.intent] = (intentCounts[c.intent] || 0) + 1;
  }

  const totalDurationSec = chunks.reduce((s, c) => s + c.durationSec, 0);

  const result = {
    ok: true,
    projectId,
    chunkedAt: new Date().toISOString(),
    stats: {
      totalChunks: chunks.length,
      totalDurationSec: Math.round(totalDurationSec),
      avgChunkDurationSec: Math.round((totalDurationSec / chunks.length) * 10) / 10,
      intentDistribution: intentCounts,
      validationFixes: validationFlags.length,
    },
    config: CONFIG,
    validationFlags,
    chunks,
  };

  await writeJson(outputPath, result);

  console.error(`[SemanticChunker] Done: ${chunks.length} chunks, avg ${result.stats.avgChunkDurationSec}s`);
  console.error(`  Intents: ${JSON.stringify(intentCounts)}`);

  await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
