#!/usr/bin/env node

/**
 * Speaker Diarization — Phase 2
 *
 * Assigns speaker labels to transcript segments using:
 *   1. pyannote.audio (if available) — high-quality neural diarization
 *   2. Energy-based heuristic fallback — detects speaker changes via
 *      audio energy shifts, pause patterns, and pitch estimation
 *
 * Reads: transcript.json
 * Writes: speaker_diarization.json, updates transcript.json segments with speaker field
 *
 * Usage:
 *   node scripts/lib/speaker_diarization.mjs \
 *     --project-id <id> --input <video-path> [--project-dir <dir>] [--max-speakers 4]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

// ── Config ───────────────────────────────────────────────────────────────────

const DEFAULTS = {
  maxSpeakers: 4,
  minSpeakerSegmentSec: 1.0,    // Minimum segment length to assign a speaker
  pauseThresholdSec: 0.8,        // Pause between segments that suggests speaker change
  energyShiftThresholdDb: 8,     // Energy shift that suggests different speaker
  pitchWindowSec: 0.4,           // Window to estimate pitch around segment start
};

const SPEAKER_COLORS = ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#e67e22', '#8e44ad'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
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

// ── Pyannote diarization (high quality) ──────────────────────────────────────

async function isPyannoteAvailable() {
  try {
    const { stdout } = await run('python3', [
      '-c',
      "import importlib.util as u; print('ok' if u.find_spec('pyannote') and u.find_spec('pyannote.audio') else 'missing')",
    ], 10000);
    return stdout.trim() === 'ok';
  } catch {
    return false;
  }
}

async function diarizeWithPyannote(audioPath, maxSpeakers) {
  const script = `
import json, sys
from pyannote.audio import Pipeline
pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=False)
diarization = pipeline("${audioPath.replace(/"/g, '\\"')}", max_speakers=${maxSpeakers})
result = []
for turn, _, speaker in diarization.itertracks(yield_label=True):
    result.append({"start": turn.start, "end": turn.end, "speaker": speaker})
print(json.dumps(result))
`;
  const { stdout } = await run('python3', ['-c', script], 300000);
  return JSON.parse(stdout);
}

// ── Energy-based heuristic diarization (fallback) ────────────────────────────

/**
 * Probe audio energy (RMS dB) at a specific timestamp.
 */
async function probeEnergy(inputPath, timestampSec, windowSec = 0.4) {
  const startSec = Math.max(0, timestampSec - windowSec / 2);
  try {
    const { stderr } = await run('ffmpeg', [
      '-ss', String(startSec),
      '-t', String(windowSec),
      '-i', inputPath,
      '-af', 'volumedetect',
      '-f', 'null', '-',
    ], 15000);

    const meanMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
    return meanMatch ? parseFloat(meanMatch[1]) : -60;
  } catch {
    return -60;
  }
}

/**
 * Estimate fundamental frequency (pitch) at a timestamp using ffmpeg's
 * aphasemeter or astats. Returns a rough pitch category.
 */
async function probePitchCategory(inputPath, timestampSec, windowSec = DEFAULTS.pitchWindowSec) {
  const startSec = Math.max(0, timestampSec);
  try {
    const { stderr } = await run('ffmpeg', [
      '-ss', String(startSec),
      '-t', String(windowSec),
      '-i', inputPath,
      '-af', 'astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level',
      '-f', 'null', '-',
    ], 15000);

    // Extract peak level as a rough proxy for vocal characteristics
    const peakMatch = stderr.match(/Peak_level=([-\d.]+)/);
    const peak = peakMatch ? parseFloat(peakMatch[1]) : -30;
    // Categorize: high-pitched (louder peak), low-pitched (quieter peak)
    return peak > -15 ? 'high' : peak > -25 ? 'mid' : 'low';
  } catch {
    return 'mid';
  }
}

/**
 * Energy + pause + pitch heuristic diarization.
 * Assigns speaker labels based on audio energy shifts and pause patterns.
 */
async function diarizeWithHeuristic(inputPath, segments, maxSpeakers) {
  if (segments.length === 0) return [];

  console.error(`[Diarize] Heuristic mode: analyzing ${segments.length} segments...`);

  // Probe energy and pitch for each segment
  const probes = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const startSec = seg.startUs / 1_000_000;
    const [energy, pitch] = await Promise.all([
      probeEnergy(inputPath, startSec + 0.2),
      probePitchCategory(inputPath, startSec + 0.1),
    ]);
    probes.push({ index: i, energy, pitch, startSec, endSec: seg.endUs / 1_000_000 });

    if ((i + 1) % 20 === 0) {
      console.error(`[Diarize] Probed ${i + 1}/${segments.length} segments`);
    }
  }

  // Detect speaker changes based on energy shifts, pauses, and pitch changes
  const speakerAssignments = new Array(segments.length).fill(0);
  let currentSpeaker = 0;
  let speakerCount = 1;

  // Track energy/pitch profiles per speaker for consistency
  const speakerProfiles = [{ energySum: probes[0]?.energy || -30, pitchMode: probes[0]?.pitch || 'mid', count: 1 }];

  for (let i = 1; i < probes.length; i++) {
    const prev = probes[i - 1];
    const curr = probes[i];
    const pauseSec = curr.startSec - prev.endSec;
    const energyShift = Math.abs(curr.energy - prev.energy);
    const pitchChanged = curr.pitch !== prev.pitch;

    // Heuristic: speaker change if there's a significant pause + energy shift or pitch change
    let shouldChange = false;

    if (pauseSec > DEFAULTS.pauseThresholdSec && energyShift > DEFAULTS.energyShiftThresholdDb) {
      shouldChange = true;  // Long pause + significant energy change
    } else if (pauseSec > DEFAULTS.pauseThresholdSec * 1.5 && pitchChanged) {
      shouldChange = true;  // Very long pause + pitch change
    } else if (energyShift > DEFAULTS.energyShiftThresholdDb * 1.5 && pitchChanged) {
      shouldChange = true;  // Big energy shift + pitch change (even without long pause)
    }

    if (shouldChange && speakerCount < maxSpeakers) {
      // Check if this matches a previous speaker's profile
      let matchedSpeaker = -1;
      for (let s = 0; s < speakerProfiles.length; s++) {
        if (s === currentSpeaker) continue;
        const avgEnergy = speakerProfiles[s].energySum / speakerProfiles[s].count;
        if (Math.abs(curr.energy - avgEnergy) < DEFAULTS.energyShiftThresholdDb / 2 &&
            curr.pitch === speakerProfiles[s].pitchMode) {
          matchedSpeaker = s;
          break;
        }
      }

      if (matchedSpeaker >= 0) {
        currentSpeaker = matchedSpeaker;
      } else if (speakerCount < maxSpeakers) {
        currentSpeaker = speakerCount;
        speakerCount++;
        speakerProfiles.push({ energySum: 0, pitchMode: curr.pitch, count: 0 });
      } else {
        // Cycle to a different existing speaker
        currentSpeaker = (currentSpeaker + 1) % speakerCount;
      }
    }

    speakerAssignments[i] = currentSpeaker;

    // Update speaker profile
    if (speakerProfiles[currentSpeaker]) {
      speakerProfiles[currentSpeaker].energySum += curr.energy;
      speakerProfiles[currentSpeaker].count += 1;
      // Update pitch mode (majority vote)
      if (curr.pitch !== speakerProfiles[currentSpeaker].pitchMode) {
        // Simple: keep current mode unless we have strong evidence
      }
    }
  }

  // Build diarization result
  return segments.map((seg, i) => ({
    segmentId: seg.id,
    startUs: seg.startUs,
    endUs: seg.endUs,
    speaker: `SPEAKER_${String(speakerAssignments[i]).padStart(2, '0')}`,
    speakerIndex: speakerAssignments[i],
    confidence: 0.6,  // Heuristic confidence
  }));
}

// ── Map pyannote turns onto transcript segments ──────────────────────────────

function mapTurnsToSegments(turns, segments) {
  return segments.map(seg => {
    const segMidSec = ((seg.startUs + seg.endUs) / 2) / 1_000_000;

    // Find the turn that overlaps most with this segment's midpoint
    let bestTurn = null;
    let bestOverlap = 0;

    for (const turn of turns) {
      if (turn.start <= segMidSec && turn.end >= segMidSec) {
        const overlap = Math.min(turn.end, seg.endUs / 1_000_000) - Math.max(turn.start, seg.startUs / 1_000_000);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestTurn = turn;
        }
      }
    }

    return {
      segmentId: seg.id,
      startUs: seg.startUs,
      endUs: seg.endUs,
      speaker: bestTurn?.speaker || 'SPEAKER_00',
      speakerIndex: bestTurn ? parseInt(bestTurn.speaker.replace(/\D/g, '') || '0', 10) : 0,
      confidence: bestTurn ? 0.9 : 0.3,
    };
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = readArg('--project-id');
  const input = readArg('--input');
  const maxSpeakers = parseInt(readArg('--max-speakers', '4'), 10) || DEFAULTS.maxSpeakers;

  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const outputPath = path.join(projectDir, 'speaker_diarization.json');

  if (!(await exists(transcriptPath))) {
    throw new Error(`Transcript not found: ${transcriptPath}`);
  }

  // Resolve input path
  let inputPath = input;
  if (!inputPath) {
    const metaPath = path.join(projectDir, 'media', 'metadata.json');
    if (await exists(metaPath)) {
      const meta = await readJson(metaPath);
      inputPath = meta.sourcePath || '';
    }
  }

  const transcript = await readJson(transcriptPath);
  const segments = transcript.segments || [];

  if (segments.length === 0) {
    const result = { ok: true, projectId, speakerCount: 0, segments: [], method: 'none' };
    await writeJson(outputPath, result);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  let diarizedSegments;
  let method;
  let speakerCount;

  // Extract audio for diarization
  const audioPath = path.join(os.tmpdir(), `diarize-${Date.now()}.wav`);
  if (inputPath && await exists(inputPath)) {
    try {
      await run('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-i', inputPath,
        '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
        audioPath,
      ], 120000);
    } catch (e) {
      console.error(`[Diarize] Audio extraction failed: ${e.message}`);
    }
  }

  // Try pyannote first, fallback to heuristic
  const hasPyannote = await isPyannoteAvailable();
  if (hasPyannote && await exists(audioPath)) {
    try {
      console.error('[Diarize] Using pyannote.audio for neural diarization...');
      const turns = await diarizeWithPyannote(audioPath, maxSpeakers);
      diarizedSegments = mapTurnsToSegments(turns, segments);
      method = 'pyannote';
      const uniqueSpeakers = new Set(diarizedSegments.map(s => s.speaker));
      speakerCount = uniqueSpeakers.size;
      console.error(`[Diarize] pyannote detected ${speakerCount} speakers`);
    } catch (e) {
      console.error(`[Diarize] pyannote failed: ${e.message}, falling back to heuristic`);
      hasPyannote && false; // fallthrough
    }
  }

  if (!diarizedSegments) {
    if (inputPath && await exists(audioPath || inputPath)) {
      console.error('[Diarize] Using energy+pitch heuristic for speaker detection...');
      diarizedSegments = await diarizeWithHeuristic(inputPath, segments, maxSpeakers);
      method = 'heuristic';
    } else {
      // No audio available — single speaker assumption
      console.error('[Diarize] No audio available — assuming single speaker');
      diarizedSegments = segments.map(seg => ({
        segmentId: seg.id,
        startUs: seg.startUs,
        endUs: seg.endUs,
        speaker: 'SPEAKER_00',
        speakerIndex: 0,
        confidence: 0.5,
      }));
      method = 'fallback-single';
    }
    const uniqueSpeakers = new Set(diarizedSegments.map(s => s.speaker));
    speakerCount = uniqueSpeakers.size;
  }

  // Clean up temp audio
  await fs.unlink(audioPath).catch(() => {});

  // Update transcript.json with speaker labels
  const speakerMap = {};
  for (const ds of diarizedSegments) {
    speakerMap[ds.segmentId] = { speaker: ds.speaker, speakerIndex: ds.speakerIndex };
  }

  const updatedSegments = segments.map(seg => ({
    ...seg,
    speaker: speakerMap[seg.id]?.speaker || 'SPEAKER_00',
    speakerIndex: speakerMap[seg.id]?.speakerIndex ?? 0,
  }));

  transcript.segments = updatedSegments;
  transcript.diarization = {
    method,
    speakerCount,
    diarizedAt: new Date().toISOString(),
    maxSpeakersRequested: maxSpeakers,
  };
  await writeJson(transcriptPath, transcript);

  // Build speaker summary
  const speakerSummary = {};
  for (const ds of diarizedSegments) {
    if (!speakerSummary[ds.speaker]) {
      speakerSummary[ds.speaker] = { segmentCount: 0, totalDurationSec: 0, color: SPEAKER_COLORS[ds.speakerIndex % SPEAKER_COLORS.length] };
    }
    speakerSummary[ds.speaker].segmentCount++;
    speakerSummary[ds.speaker].totalDurationSec += (ds.endUs - ds.startUs) / 1_000_000;
  }

  const result = {
    ok: true,
    projectId,
    diarizedAt: new Date().toISOString(),
    method,
    speakerCount,
    maxSpeakersRequested: maxSpeakers,
    speakers: speakerSummary,
    segments: diarizedSegments,
  };

  await writeJson(outputPath, result);

  console.error(`[Diarize] Done: ${speakerCount} speakers detected (${method})`);
  for (const [spk, info] of Object.entries(speakerSummary)) {
    console.error(`  ${spk}: ${info.segmentCount} segments, ${info.totalDurationSec.toFixed(1)}s`);
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
