#!/usr/bin/env node

/**
 * Transcript Annotation Pass — Phase 3
 *
 * Reads the frozen transcript.json and produces transcript_annotated.json
 * with per-segment quality flags:
 *   - low_confidence: segment confidence below threshold
 *   - fast_speech: words-per-second exceeds threshold
 *   - slow_speech: words-per-second below threshold
 *   - overlap: segment timestamps overlap with adjacent segment
 *   - short_segment: segment duration below minimum
 *   - long_segment: segment duration above maximum
 *   - noisy_zone: non-silent zone with low confidence (cross-ref with silence data)
 *
 * Also computes aggregate transcript reliability metrics.
 *
 * Usage:
 *   node scripts/annotate_transcript.mjs \
 *     --project-id <id> [--project-dir <dir>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// ── Configurable Thresholds ──────────────────────────────────────────────────

const THRESHOLDS = {
  lowConfidence: 0.7,
  fastSpeechWps: 4.5,     // words per second
  slowSpeechWps: 1.0,
  minSegmentDurationUs: 200_000,    // 0.2s
  maxSegmentDurationUs: 60_000_000, // 60s
  overlapToleranceUs: 50_000,       // 50ms overlap tolerance
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

// ── Annotation Logic ─────────────────────────────────────────────────────────

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function annotateSegments(segments, silenceRanges) {
  const annotated = [];
  let totalFlags = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const flags = [];
    const durationUs = (seg.endUs || 0) - (seg.startUs || 0);
    const durationSec = durationUs / 1_000_000;
    const wordCount = countWords(seg.text);
    const wps = durationSec > 0 ? wordCount / durationSec : 0;
    const confidence = seg.confidence ?? 1.0;

    // Low confidence
    if (confidence < THRESHOLDS.lowConfidence) {
      flags.push({
        type: 'low_confidence',
        severity: confidence < 0.5 ? 'high' : 'medium',
        message: `Confidence ${(confidence * 100).toFixed(0)}% below ${(THRESHOLDS.lowConfidence * 100).toFixed(0)}% threshold`,
        value: confidence,
      });
    }

    // Fast speech
    if (wps > THRESHOLDS.fastSpeechWps && wordCount > 2) {
      flags.push({
        type: 'fast_speech',
        severity: wps > 6 ? 'high' : 'medium',
        message: `${wps.toFixed(1)} words/sec exceeds ${THRESHOLDS.fastSpeechWps} threshold`,
        value: wps,
      });
    }

    // Slow speech
    if (wps < THRESHOLDS.slowSpeechWps && durationSec > 1 && wordCount > 0) {
      flags.push({
        type: 'slow_speech',
        severity: 'low',
        message: `${wps.toFixed(1)} words/sec below ${THRESHOLDS.slowSpeechWps} threshold`,
        value: wps,
      });
    }

    // Short segment
    if (durationUs < THRESHOLDS.minSegmentDurationUs && durationUs > 0) {
      flags.push({
        type: 'short_segment',
        severity: 'low',
        message: `Duration ${(durationSec * 1000).toFixed(0)}ms below ${THRESHOLDS.minSegmentDurationUs / 1000}ms minimum`,
        value: durationUs,
      });
    }

    // Long segment
    if (durationUs > THRESHOLDS.maxSegmentDurationUs) {
      flags.push({
        type: 'long_segment',
        severity: 'medium',
        message: `Duration ${durationSec.toFixed(1)}s exceeds ${THRESHOLDS.maxSegmentDurationUs / 1_000_000}s maximum`,
        value: durationUs,
      });
    }

    // Overlap with previous segment
    if (i > 0) {
      const prev = segments[i - 1];
      const overlap = (prev.endUs || 0) - (seg.startUs || 0);
      if (overlap > THRESHOLDS.overlapToleranceUs) {
        flags.push({
          type: 'overlap',
          severity: overlap > 500_000 ? 'high' : 'medium',
          message: `Overlaps with previous segment by ${(overlap / 1000).toFixed(0)}ms`,
          value: overlap,
        });
      }
    }

    // Noisy zone: non-silent area with low confidence
    if (confidence < THRESHOLDS.lowConfidence && silenceRanges.length > 0) {
      const isInSilence = silenceRanges.some(
        sr => sr.startUs <= seg.startUs && sr.endUs >= seg.endUs
      );
      if (!isInSilence) {
        flags.push({
          type: 'noisy_zone',
          severity: 'medium',
          message: `Low confidence (${(confidence * 100).toFixed(0)}%) in non-silent zone — possible background noise`,
          value: confidence,
        });
      }
    }

    totalFlags += flags.length;

    annotated.push({
      ...seg,
      annotation: {
        flags,
        flagCount: flags.length,
        wordCount,
        wordsPerSecond: Math.round(wps * 10) / 10,
        durationSec: Math.round(durationSec * 100) / 100,
        riskLevel: flags.some(f => f.severity === 'high') ? 'high'
          : flags.some(f => f.severity === 'medium') ? 'medium'
          : flags.length > 0 ? 'low'
          : 'none',
      },
    });
  }

  return { annotated, totalFlags };
}

function computeReliabilityMetrics(annotated) {
  const total = annotated.length;
  if (total === 0) return { overall: 'unknown', score: 0 };

  const flagged = annotated.filter(s => s.annotation.flagCount > 0).length;
  const highRisk = annotated.filter(s => s.annotation.riskLevel === 'high').length;
  const mediumRisk = annotated.filter(s => s.annotation.riskLevel === 'medium').length;

  const avgConfidence = annotated.reduce((sum, s) => sum + (s.confidence ?? 1.0), 0) / total;
  const avgWps = annotated.reduce((sum, s) => sum + s.annotation.wordsPerSecond, 0) / total;

  // Reliability score: 0-100
  const flagPenalty = (flagged / total) * 30;
  const highRiskPenalty = (highRisk / total) * 40;
  const confPenalty = Math.max(0, (0.9 - avgConfidence) * 50);
  const score = Math.max(0, Math.min(100, Math.round(100 - flagPenalty - highRiskPenalty - confPenalty)));

  const overall = score >= 80 ? 'good'
    : score >= 60 ? 'acceptable'
    : score >= 40 ? 'poor'
    : 'unreliable';

  return {
    overall,
    score,
    totalSegments: total,
    flaggedSegments: flagged,
    highRiskSegments: highRisk,
    mediumRiskSegments: mediumRisk,
    averageConfidence: Math.round(avgConfidence * 1000) / 1000,
    averageWordsPerSecond: Math.round(avgWps * 10) / 10,
    flagBreakdown: {
      low_confidence: annotated.filter(s => s.annotation.flags.some(f => f.type === 'low_confidence')).length,
      fast_speech: annotated.filter(s => s.annotation.flags.some(f => f.type === 'fast_speech')).length,
      slow_speech: annotated.filter(s => s.annotation.flags.some(f => f.type === 'slow_speech')).length,
      overlap: annotated.filter(s => s.annotation.flags.some(f => f.type === 'overlap')).length,
      short_segment: annotated.filter(s => s.annotation.flags.some(f => f.type === 'short_segment')).length,
      long_segment: annotated.filter(s => s.annotation.flags.some(f => f.type === 'long_segment')).length,
      noisy_zone: annotated.filter(s => s.annotation.flags.some(f => f.type === 'noisy_zone')).length,
    },
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = readArg('--project-id');
  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const cutPlanPath = path.join(projectDir, 'cut-plan.json');
  const outputPath = path.join(projectDir, 'transcript_annotated.json');

  if (!(await exists(transcriptPath))) {
    throw new Error(`Transcript not found: ${transcriptPath}`);
  }

  console.error(`[Annotate] Reading transcript: ${transcriptPath}`);
  const transcript = await readJson(transcriptPath);
  const segments = transcript.segments || [];

  // Load silence/cut data if available for noisy zone detection
  let silenceRanges = [];
  if (await exists(cutPlanPath)) {
    try {
      const cutPlan = await readJson(cutPlanPath);
      // Use silence-type ranges for noise correlation
      silenceRanges = (cutPlan.removeRanges || [])
        .filter(r => r.reason === 'silence' || r.reason === 'long_pause');
    } catch { /* cut plan not available, skip */ }
  }

  console.error(`[Annotate] Annotating ${segments.length} segments...`);
  const { annotated, totalFlags } = annotateSegments(segments, silenceRanges);
  const reliability = computeReliabilityMetrics(annotated);

  const result = {
    ok: true,
    projectId,
    annotatedAt: new Date().toISOString(),
    source: transcript.source || {},
    adapter: transcript.adapter || {},
    language: transcript.language || 'unknown',
    reliability,
    segments: annotated,
    thresholds: THRESHOLDS,
  };

  await writeJson(outputPath, result);

  console.error(`[Annotate] Done: ${reliability.overall.toUpperCase()} (score: ${reliability.score}/100)`);
  console.error(`  Flagged: ${reliability.flaggedSegments}/${reliability.totalSegments} segments (${totalFlags} total flags)`);
  if (reliability.highRiskSegments > 0) {
    console.error(`  ⚠ ${reliability.highRiskSegments} high-risk segments need attention`);
  }

  await new Promise((resolve) => process.stdout.write(JSON.stringify(result, null, 2), resolve));
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
