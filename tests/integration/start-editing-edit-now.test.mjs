import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  ROOT_DIR,
  assertJsonFile,
  commandExists,
  ensureSampleVideo,
  randomProjectId,
  runNodeScript,
} from '../helpers/pipeline_test_utils.mjs';

const ffmpegAvailable = await commandExists('ffmpeg');

test(
  'start-editing + edit-now generate validated artifacts',
  { skip: !ffmpegAvailable, timeout: 8 * 60 * 1000 },
  async () => {
    const projectId = randomProjectId('proj-integration');
    const samplePath = await ensureSampleVideo({
      fileName: `${projectId}.mp4`,
      durationSeconds: 7,
      width: 960,
      height: 540,
      fps: 30,
    });

    const start = await runNodeScript('scripts/start_editing_pipeline.mjs', [
      '--project-id',
      projectId,
      '--input',
      samplePath,
      '--mode',
      'hybrid',
      '--language',
      'en',
      '--fps',
      '30',
      '--source-ref',
      'source-video',
      '--fallback-policy',
      'local-first',
      '--transcription-model',
      'auto',
      '--cut-planner-model',
      'planner-test-v1',
    ]);
    const startPayload = JSON.parse(start.stdout);
    assert.equal(startPayload.ok, true);
    assert.equal(startPayload.projectId, projectId);
    assert.ok(Array.isArray(startPayload.removeRanges));

    const projectDir = path.join(ROOT_DIR, 'desktop', 'data', projectId);
    await assertJsonFile(path.join(projectDir, 'transcript.json'));
    await assertJsonFile(path.join(projectDir, 'cut-plan.json'));
    await assertJsonFile(path.join(projectDir, 'start-editing-job.json'));

    const edit = await runNodeScript('scripts/edit_now_pipeline.mjs', [
      '--project-id',
      projectId,
      '--fps',
      '30',
      '--source-ref',
      'source-video',
      '--fetch-external',
      'false',
      '--fallback-policy',
      'local-first',
      '--template-planner-model',
      'template-test-v1',
      '--max-retries',
      '0',
      '--retry-delay-ms',
      '200',
    ]);
    const editPayload = JSON.parse(edit.stdout);
    assert.equal(editPayload.ok, true);
    assert.equal(editPayload.projectId, projectId);
    assert.ok(Array.isArray(editPayload.templatePlacements));
    assert.ok(Array.isArray(editPayload.assetSuggestions));
    assert.ok(editPayload.templatePlacements.length > 0, 'Expected at least one template placement.');

    const timeline = await assertJsonFile(path.join(projectDir, 'timeline.json'));
    const templatePlan = await assertJsonFile(path.join(projectDir, 'template-plan.json'));
    await assertJsonFile(path.join(projectDir, 'edit-now-job.json'));

    assert.equal(timeline.projectId, projectId);
    assert.equal(templatePlan.projectId, projectId);
    assert.equal(templatePlan.templateCount, templatePlan.templatePlacements.length);
  },
);
