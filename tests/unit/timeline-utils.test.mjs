import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const timelineUtils = await import(path.join(rootDir, 'desktop', 'app', 'lib', 'timeline_utils.mjs'));

test('microsecondsToTimecode formats with 6-digit precision', () => {
  assert.equal(timelineUtils.microsecondsToTimecode(3_661_123_456), '01:01:01.123456');
  assert.equal(timelineUtils.microsecondsToTimecode(0), '00:00:00.000000');
});

test('timecodeToMicroseconds parses and round-trips', () => {
  const us = timelineUtils.timecodeToMicroseconds('00:02:03.456789');
  assert.equal(us, 123_456_789);
  assert.equal(timelineUtils.microsecondsToTimecode(us), '00:02:03.456789');
});

test('frame conversion keeps expected boundaries at 30 fps', () => {
  assert.equal(timelineUtils.microsecondsToFrameIndex(0, 30), 0);
  assert.equal(timelineUtils.microsecondsToFrameIndex(1_000_000, 30), 30);
  assert.equal(timelineUtils.frameIndexToMicroseconds(45, 30), 1_500_000);
});

test('validateClipTiming accepts valid clip and rejects invalid ranges', () => {
  const valid = timelineUtils.validateClipTiming({
    startUs: 1000,
    endUs: 5000,
    sourceStartUs: 2000,
    sourceEndUs: 7000,
  });
  assert.equal(valid.ok, true);

  const invalid = timelineUtils.validateClipTiming({
    startUs: 1000,
    endUs: 1000,
    sourceStartUs: 4000,
    sourceEndUs: 3000,
  });
  assert.equal(invalid.ok, false);
  assert.ok(
    invalid.errors.some((error) => error.includes('Timeline range invalid')),
    'Expected timeline validation error.',
  );
  assert.ok(
    invalid.errors.some((error) => error.includes('Source range invalid')),
    'Expected source validation error.',
  );
});

test('validateTemplatePlacementBounds catches overlap and out-of-bounds', () => {
  const good = timelineUtils.validateTemplatePlacementBounds(
    [
      { id: 'tpl-1', startUs: 0, endUs: 1_000_000 },
      { id: 'tpl-2', startUs: 1_200_000, endUs: 2_000_000 },
    ],
    3_000_000,
    100_000,
  );
  assert.equal(good.ok, true);

  const bad = timelineUtils.validateTemplatePlacementBounds(
    [
      { id: 'tpl-1', startUs: 0, endUs: 1_000_000 },
      { id: 'tpl-2', startUs: 900_000, endUs: 3_500_000 },
    ],
    3_000_000,
    100_000,
  );
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 2);
});
