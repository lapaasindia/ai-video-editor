import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateAssetSuggestions,
  validateCanonicalTranscript,
  validateCutPlan,
  validateTemplatePlacements,
} from '../../scripts/lib/pipeline_schema.mjs';

test('validateCanonicalTranscript accepts canonical payload', () => {
  const payload = {
    transcriptId: 'tx-1',
    projectId: 'proj-1',
    createdAt: new Date().toISOString(),
    mode: 'hybrid',
    language: 'en',
    source: {
      path: '/tmp/input.mp4',
      ref: 'source-video',
      durationUs: 2_000_000,
    },
    adapter: {
      kind: 'local',
      runtime: 'whisper_cpp',
      binary: 'whisper-cli',
      model: 'auto',
      engine: 'local:whisper_cpp:stub',
    },
    words: [
      { id: 'w1', text: 'hello', normalized: 'hello', startUs: 0, endUs: 500_000, confidence: 0.9 },
      { id: 'w2', text: 'world', normalized: 'world', startUs: 500_000, endUs: 1_000_000, confidence: 0.9 },
    ],
    segments: [
      {
        id: 's1',
        startUs: 0,
        endUs: 1_000_000,
        text: 'hello world',
        wordIds: ['w1', 'w2'],
        confidence: 0.9,
      },
    ],
    wordCount: 2,
  };

  const parsed = validateCanonicalTranscript(payload);
  assert.equal(parsed.wordCount, 2);
});

test('validateCutPlan rejects out-of-range cuts', () => {
  const cutPlan = {
    planId: 'cp-1',
    projectId: 'proj-1',
    createdAt: new Date().toISOString(),
    mode: 'hybrid',
    fallbackPolicy: 'local-first',
    sourceRef: 'source-video',
    planner: { model: 'planner-v1', strategy: 'heuristic' },
    removeRanges: [{ startUs: 1000, endUs: 2_000_001, reason: 'pause', confidence: 0.8 }],
    rationale: [{ startUs: 1000, endUs: 2_000_001, reason: 'pause', confidence: 0.8 }],
  };

  assert.throws(() => validateCutPlan(cutPlan, 2_000_000), /exceeds duration/);
});

test('template and asset schemas enforce positive intervals', () => {
  const placements = validateTemplatePlacements([
    {
      id: 'tpl-1',
      templateId: 'headline-card',
      category: 'social-hooks',
      startUs: 0,
      endUs: 500_000,
      confidence: 0.71,
      content: {
        headline: 'Hook line',
        subline: 'Subline',
      },
    },
  ], 1_000_000);
  assert.equal(placements.length, 1);

  assert.throws(
    () =>
      validateAssetSuggestions(
        [
          {
            id: 'asset-1',
            provider: 'pexels',
            kind: 'image',
            query: 'office team',
            startUs: 1000,
            endUs: 1000,
          },
        ],
        1_000_000,
      ),
    /asset\.endUs must be greater/,
  );
});
