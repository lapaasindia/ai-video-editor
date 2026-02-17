import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
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
  'full workflow runs start-editing -> edit-now -> render',
  { skip: !ffmpegAvailable, timeout: 12 * 60 * 1000 },
  async () => {
    const projectId = randomProjectId('proj-e2e');
    const samplePath = await ensureSampleVideo({
      fileName: `${projectId}.mp4`,
      durationSeconds: 6,
      width: 1280,
      height: 720,
      fps: 30,
    });

    await runNodeScript('scripts/start_editing_pipeline.mjs', [
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
    ]);

    await runNodeScript('scripts/edit_now_pipeline.mjs', [
      '--project-id',
      projectId,
      '--fps',
      '30',
      '--source-ref',
      'source-video',
      '--fetch-external',
      'false',
      '--max-retries',
      '0',
      '--retry-delay-ms',
      '200',
    ]);

    const renderOutputName = 'e2e-output.mp4';
    const render = await runNodeScript('scripts/render_pipeline.mjs', [
      '--project-id',
      projectId,
      '--output-name',
      renderOutputName,
      '--burn-subtitles',
      'false',
      '--quality',
      'draft',
      '--max-retries',
      '0',
      '--retry-delay-ms',
      '200',
    ]);
    const renderPayload = JSON.parse(render.stdout);
    assert.equal(renderPayload.ok, true);
    assert.equal(renderPayload.projectId, projectId);
    assert.equal(renderPayload.outputPath.endsWith(renderOutputName), true);

    const projectDir = path.join(ROOT_DIR, 'desktop', 'data', projectId);
    const outputPath = path.join(projectDir, 'renders', renderOutputName);
    const stat = await fs.stat(outputPath);
    assert.ok(stat.size > 0, 'Rendered MP4 should be non-empty.');

    const renderJob = await assertJsonFile(path.join(projectDir, 'render-job.json'));
    const history = await assertJsonFile(path.join(projectDir, 'renders', 'history.json'));
    assert.equal(renderJob.status, 'RENDER_DONE');
    assert.ok(Array.isArray(history));
    assert.ok(history.length >= 1);
  },
);
