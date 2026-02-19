#!/usr/bin/env node

import http from 'node:http';
import { execFile as execFileCb } from 'node:child_process';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execFile = promisify(execFileCb);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const discoveryScript = path.join(rootDir, 'scripts', 'model_runtime_discovery.mjs');
const modelHealthScript = path.join(rootDir, 'scripts', 'model_runtime_health.mjs');
const installScript = path.join(rootDir, 'scripts', 'model_runtime_install.mjs');
const hardwareDiagnosticsScript = path.join(rootDir, 'scripts', 'hardware_diagnostics.mjs');
const firstRunChecksScript = path.join(rootDir, 'scripts', 'first_run_checks.mjs');
const mediaIngestScript = path.join(rootDir, 'scripts', 'media_ingest.mjs');
const startEditingScript = path.join(rootDir, 'scripts', 'start_editing_pipeline.mjs');
const editNowScript = path.join(rootDir, 'scripts', 'edit_now_pipeline.mjs');
const renderScript = path.join(rootDir, 'scripts', 'render_pipeline.mjs');
const projectsFile = path.join(rootDir, 'desktop', 'data', 'projects.json');

const HOST = '127.0.0.1';
const PORT = Number(process.env.LAPAAS_DESKTOP_PORT ?? '43123');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-filename',
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

async function ensureProjectsStore() {
  const dataDir = path.dirname(projectsFile);
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(projectsFile);
  } catch {
    await fs.writeFile(projectsFile, '[]\n', 'utf8');
  }
}

async function readProjects() {
  await ensureProjectsStore();
  const raw = await fs.readFile(projectsFile, 'utf8');
  return JSON.parse(raw);
}

async function writeProjects(projects) {
  await ensureProjectsStore();
  await fs.writeFile(projectsFile, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
}

function timelineFile(projectId) {
  return path.join(rootDir, 'desktop', 'data', projectId, 'timeline.json');
}

function renderHistoryFile(projectId) {
  return path.join(rootDir, 'desktop', 'data', projectId, 'renders', 'history.json');
}

function telemetrySummaryFile(projectId) {
  return path.join(rootDir, 'desktop', 'data', projectId, 'telemetry', 'summary.json');
}

function telemetryEventsFile(projectId) {
  return path.join(rootDir, 'desktop', 'data', projectId, 'telemetry', 'events.jsonl');
}

async function ensureTimelineStore(projectId) {
  const file = timelineFile(projectId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  return file;
}

async function readTimeline(projectId) {
  const file = timelineFile(projectId);
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function readRenderHistory(projectId) {
  const file = renderHistoryFile(projectId);
  const raw = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function readProjectTelemetry(projectId, limit = 60) {
  const summaryPath = telemetrySummaryFile(projectId);
  const eventsPath = telemetryEventsFile(projectId);
  const summaryRaw = await fs.readFile(summaryPath, 'utf8').catch(() => '');
  const summary = summaryRaw ? JSON.parse(summaryRaw) : null;
  const eventsRaw = await fs.readFile(eventsPath, 'utf8').catch(() => '');
  const rows = eventsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = [];
  for (let index = rows.length - 1; index >= 0 && parsed.length < limit; index -= 1) {
    try {
      parsed.push(JSON.parse(rows[index]));
    } catch {
      // Skip malformed telemetry rows.
    }
  }
  return {
    projectId,
    summary,
    recentEvents: parsed,
  };
}

function stateFile(projectId) {
  return path.join(rootDir, 'desktop', 'data', projectId, 'state.json');
}

async function ensureStateStore(projectId) {
  const file = stateFile(projectId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  return file;
}

async function writeState(projectId, state) {
  const file = await ensureStateStore(projectId);
  await fs.writeFile(file, JSON.stringify(state, null, 2), 'utf8');
}

async function readState(projectId) {
  const file = stateFile(projectId);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeTimeline(timeline) {
  if (!timeline.projectId) return;
  const file = await ensureTimelineStore(timeline.projectId);
  await fs.writeFile(file, JSON.stringify(timeline, null, 2), 'utf8');
}

function normalizeRanges(ranges, durationUs) {
  const sorted = (ranges || [])
    .map((range) => ({
      startUs: Math.min(Number(range.startUs || 0), durationUs),
      endUs: Math.min(Number(range.endUs || 0), durationUs),
    }))
    .filter((range) => range.endUs > range.startUs)
    .sort((a, b) => a.startUs - b.startUs);

  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(range);
      continue;
    }
    if (range.startUs <= last.endUs) {
      if (range.endUs > last.endUs) {
        last.endUs = range.endUs;
      }
      continue;
    }
    merged.push(range);
  }

  return merged;
}

function invertRanges(removeRanges, durationUs) {
  let cursor = 0;
  const keepRanges = [];
  for (const range of removeRanges) {
    if (range.startUs > cursor) {
      keepRanges.push({ startUs: cursor, endUs: range.startUs });
    }
    cursor = Math.max(cursor, range.endUs);
  }
  if (cursor < durationUs) {
    keepRanges.push({ startUs: cursor, endUs: durationUs });
  }
  return keepRanges;
}

async function updateProjectStatus(projectId, status) {
  const projects = await readProjects();
  const idx = projects.findIndex((project) => project.id === projectId);
  if (idx === -1) {
    return false;
  }
  projects[idx] = {
    ...projects[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  await writeProjects(projects);
  return true;
}

function buildRoughCutTimeline({
  projectId,
  durationUs,
  fps,
  sourceRef,
  removeRanges,
}) {
  const normalized = normalizeRanges(removeRanges || [], durationUs);
  const keepRanges = invertRanges(normalized, durationUs);
  let cursor = 0;

  const clips = keepRanges.map((range, idx) => {
    const clipDuration = range.endUs - range.startUs;
    const clip = {
      clipId: `clip-${idx + 1}`,
      trackId: 'track-video-main',
      clipType: 'source_clip',
      startUs: cursor,
      endUs: cursor + clipDuration,
      sourceStartUs: range.startUs,
      sourceEndUs: range.endUs,
      sourceRef: sourceRef || 'source-video',
      effects: {},
      transform: {},
      meta: {
        generatedBy: 'ai-rough-cut',
        removeRangesApplied: normalized,
      },
    };
    cursor += clipDuration;
    return clip;
  });

  const now = new Date().toISOString();
  return {
    id: `timeline-${randomUUID()}`,
    projectId,
    version: 1,
    status: 'ROUGH_CUT_READY',
    fps,
    durationUs: cursor,
    createdAt: now,
    updatedAt: now,
    tracks: [
      { id: 'track-video-main', name: 'Main Video', kind: 'video', order: 0, locked: false },
      { id: 'track-captions', name: 'Captions', kind: 'caption', order: 1, locked: false },
    ],
    clips,
  };
}

async function runNodeScript(scriptPath, args = [], timeoutMs = 120000) {
  const { stdout } = await execFile('node', [scriptPath, ...args], {
    cwd: rootDir,
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 8,
  });
  return (stdout ?? '').toString().trim();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8').trim();
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      sendJson(res, 400, { error: 'Invalid request.' });
      return;
    }

    const method = req.method.toUpperCase();
    const route = req.url.split('?')[0];

    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, x-filename',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    if (method === 'GET' && route === '/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'lapaas-desktop-backend',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (method === 'GET' && route === '/models/discover') {
      const output = await runNodeScript(discoveryScript);
      sendJson(res, 200, JSON.parse(output));
      return;
    }

    if (method === 'GET' && route === '/models/health') {
      const output = await runNodeScript(modelHealthScript);
      sendJson(res, 200, JSON.parse(output));
      return;
    }

    if (method === 'POST' && route === '/models/install') {
      const body = await readBody(req);
      const { runtime, model } = body;
      if (!runtime || !model) {
        sendJson(res, 400, { error: 'runtime and model are required' });
        return;
      }
      try {
        const output = await runNodeScript(installScript, [runtime, model], 600000);
        sendJson(res, 200, { ok: true, output });
      } catch (e) {
        sendJson(res, 500, { error: `Install failed: ${e.message || e}` });
      }
      return;
    }

    if (method === 'GET' && route === '/render/progress') {
      const qs = req.url.split('?')[1] || '';
      const params = new URLSearchParams(qs);
      const projectId = params.get('projectId');
      if (!projectId) {
        sendJson(res, 400, { error: 'projectId is required' });
        return;
      }
      const progressFile = path.join(rootDir, 'desktop', 'data', projectId, 'render_progress.json');
      try {
        const raw = await fs.readFile(progressFile, 'utf8');
        sendJson(res, 200, JSON.parse(raw));
      } catch {
        sendJson(res, 200, { percent: 0, stage: 'queued' });
      }
      return;
    }

    if (method === 'GET' && route === '/diagnostics/hardware') {
      const output = await runNodeScript(hardwareDiagnosticsScript);
      sendJson(res, 200, JSON.parse(output));
      return;
    }

    if (method === 'GET' && route === '/checks/first-run') {
      const output = await runNodeScript(firstRunChecksScript);
      sendJson(res, 200, JSON.parse(output));
      return;
    }

    if (method === 'GET' && route === '/projects') {
      const projects = await readProjects();
      sendJson(res, 200, { projects });
      return;
    }

    if (method === 'POST' && route === '/projects/create') {
      const body = await readBody(req);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const settings = typeof body.settings === 'object' && body.settings ? body.settings : null;

      if (!name || !settings) {
        sendJson(res, 400, { error: 'Missing required fields: name, settings.' });
        return;
      }

      const projects = await readProjects();
      const now = new Date().toISOString();
      const project = {
        id: randomUUID(),
        name,
        settings,
        status: 'PROJECT_CREATED',
        createdAt: now,
        updatedAt: now,
      };
      projects.push(project);
      await writeProjects(projects);
      sendJson(res, 201, project);
      return;
    }

    const settingsMatch = route.match(/^\/projects\/([^/]+)\/settings$/);
    if (method === 'PATCH' && settingsMatch) {
      const projectId = settingsMatch[1];
      const body = await readBody(req);
      const settings = typeof body.settings === 'object' && body.settings ? body.settings : null;

      if (!settings) {
        sendJson(res, 400, { error: 'Missing required field: settings.' });
        return;
      }

      const projects = await readProjects();
      const idx = projects.findIndex((project) => project.id === projectId);
      if (idx === -1) {
        sendJson(res, 404, { error: 'Project not found.' });
        return;
      }

      projects[idx] = {
        ...projects[idx],
        settings,
        status: 'SETTINGS_SAVED',
        updatedAt: new Date().toISOString(),
      };
      await writeProjects(projects);
      sendJson(res, 200, projects[idx]);
      return;
    }

    if (method === 'POST' && route === '/models/install') {
      const body = await readBody(req);
      const runtime = typeof body.runtime === 'string' ? body.runtime : '';
      const model = typeof body.model === 'string' ? body.model : '';

      if (!runtime) {
        sendJson(res, 400, { error: 'Missing `runtime`.' });
        return;
      }

      const args = ['--runtime', runtime];
      if (model) {
        args.push('--model', model);
      }

      const output = await runNodeScript(installScript, args);
      try {
        sendJson(res, 200, JSON.parse(output));
      } catch {
        sendJson(res, 200, {
          ok: true,
          runtime,
          model,
          status: 'installed',
          output,
        });
      }
      return;
    }

    if (method === 'POST' && route === '/start-editing') {
      const body = await readBody(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const input = typeof body.input === 'string' ? body.input : '';
      const mode = typeof body.mode === 'string' ? body.mode : 'hybrid';
      const language = typeof body.language === 'string' ? body.language : 'en';
      const fps = Number(body.fps || 30);
      const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef : 'source-video';
      const fallbackPolicy = typeof body.fallbackPolicy === 'string' ? body.fallbackPolicy.trim() : '';
      const transcriptionModel =
        typeof body.transcriptionModel === 'string' ? body.transcriptionModel.trim() : '';
      const cutPlannerModel = typeof body.cutPlannerModel === 'string' ? body.cutPlannerModel.trim() : '';

      if (!projectId || !input) {
        sendJson(res, 400, {
          error: 'Missing required fields: projectId, input.',
        });
        return;
      }

      const args = [
        '--project-id',
        projectId,
        '--input',
        input,
        '--mode',
        mode,
        '--language',
        language,
        '--fps',
        String(fps),
        '--source-ref',
        sourceRef,
      ];
      if (fallbackPolicy) {
        args.push('--fallback-policy', fallbackPolicy);
      }
      if (transcriptionModel) {
        args.push('--transcription-model', transcriptionModel);
      }
      if (cutPlannerModel) {
        args.push('--cut-planner-model', cutPlannerModel);
      }

      try {
        const raw = await runNodeScript(startEditingScript, args);
        const pipeline = JSON.parse(raw);
        const timeline = buildRoughCutTimeline({
          projectId,
          durationUs: Number(pipeline.durationUs || 0),
          fps,
          sourceRef,
          removeRanges: Array.isArray(pipeline.removeRanges) ? pipeline.removeRanges : [],
        });
        await writeTimeline(timeline);
        await updateProjectStatus(projectId, 'ROUGH_CUT_READY');

        sendJson(res, 200, {
          ok: true,
          pipeline,
          timeline,
        });
      } catch (error) {
        await updateProjectStatus(projectId, 'ROUGH_CUT_FAILED').catch(() => { });
        throw error;
      }
      return;
    }

    if (method === 'POST' && route === '/edit-now') {
      const body = await readBody(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const fps = Number(body.fps || 30);
      const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef : 'source-video';
      const fetchExternal = body.fetchExternal === false ? 'false' : 'true';
      const fallbackPolicy = typeof body.fallbackPolicy === 'string' ? body.fallbackPolicy.trim() : '';
      const templatePlannerModel =
        typeof body.templatePlannerModel === 'string' ? body.templatePlannerModel.trim() : '';

      if (!projectId) {
        sendJson(res, 400, {
          error: 'Missing required field: projectId.',
        });
        return;
      }

      const args = [
        '--project-id',
        projectId,
        '--fps',
        String(fps),
        '--source-ref',
        sourceRef,
        '--fetch-external',
        fetchExternal,
      ];
      if (fallbackPolicy) {
        args.push('--fallback-policy', fallbackPolicy);
      }
      if (templatePlannerModel) {
        args.push('--template-planner-model', templatePlannerModel);
      }

      try {
        const raw = await runNodeScript(editNowScript, args, 10 * 60 * 1000);
        const result = JSON.parse(raw);
        await updateProjectStatus(projectId, 'ENRICHED_TIMELINE_READY');
        sendJson(res, 200, result);
      } catch (error) {
        await updateProjectStatus(projectId, 'ENRICHMENT_FAILED').catch(() => { });
        throw error;
      }
      return;
    }

    if (method === 'POST' && route === '/render') {
      const body = await readBody(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const outputName = typeof body.outputName === 'string' ? body.outputName : '';
      const burnSubtitles = body.burnSubtitles === true ? 'true' : 'false';
      const quality = typeof body.quality === 'string' ? body.quality : 'balanced';

      if (!projectId) {
        sendJson(res, 400, {
          error: 'Missing required field: projectId.',
        });
        return;
      }

      await updateProjectStatus(projectId, 'RENDER_IN_PROGRESS');
      try {
        const raw = await runNodeScript(
          renderScript,
          [
            '--project-id',
            projectId,
            '--output-name',
            outputName,
            '--burn-subtitles',
            burnSubtitles,
            '--quality',
            quality,
          ],
          60 * 60 * 1000,
        );
        const result = JSON.parse(raw);
        await updateProjectStatus(projectId, 'RENDER_DONE');
        sendJson(res, 200, result);
      } catch (error) {
        await updateProjectStatus(projectId, 'RENDER_FAILED').catch(() => { });
        throw error;
      }
      return;
    }

    if (method === 'POST' && route === '/open-path') {
      const body = await readBody(req);
      const targetPath = typeof body.path === 'string' ? body.path.trim() : '';
      const reveal = body.reveal === false ? false : true;

      if (!targetPath) {
        sendJson(res, 400, {
          error: 'Missing required field: path.',
        });
        return;
      }

      const args = reveal ? ['-R', targetPath] : [targetPath];
      await execFile('open', args, { timeout: 15000 });
      sendJson(res, 200, {
        ok: true,
        path: targetPath,
        reveal,
      });
      return;
    }

    const renderHistoryMatch = route.match(/^\/render\/([^/]+)\/history$/);
    if (method === 'GET' && renderHistoryMatch) {
      const projectId = renderHistoryMatch[1];
      try {
        const history = await readRenderHistory(projectId);
        sendJson(res, 200, { projectId, history });
      } catch {
        sendJson(res, 200, { projectId, history: [] });
      }
      return;
    }

    const telemetryMatch = route.match(/^\/telemetry\/([^/]+)$/);
    if (method === 'GET' && telemetryMatch) {
      const projectId = telemetryMatch[1];
      const telemetry = await readProjectTelemetry(projectId, 80);
      sendJson(res, 200, telemetry);
      return;
    }

    const saveMatch = route.match(/^\/projects\/([^/]+)\/save$/);
    if (method === 'POST' && saveMatch) {
      const projectId = saveMatch[1];
      const body = await readBody(req);

      try {
        if (body.state) {
          await writeState(projectId, body.state);
        }
        if (body.timeline) {
          await writeTimeline({ ...body.timeline, projectId });
        }

        // Update updated_at in projects.json
        const projects = await readProjects();
        const idx = projects.findIndex(p => p.id === projectId);
        if (idx !== -1) {
          projects[idx].updatedAt = new Date().toISOString();
          await writeProjects(projects);
        }

        sendJson(res, 200, { ok: true });
      } catch (error) {
        console.error('Save failed', error);
        sendJson(res, 500, { error: String(error) });
      }
      return;
    }

    const loadMatch = route.match(/^\/projects\/([^/]+)\/load$/);
    if (method === 'GET' && loadMatch) {
      const projectId = loadMatch[1];
      try {
        const state = await readState(projectId);
        const timeline = await readTimeline(projectId).catch(() => null);

        // Ensure we load project metadata
        const projects = await readProjects();
        const project = projects.find(p => p.id === projectId);

        sendJson(res, 200, { ok: true, state, timeline, project });
      } catch (error) {
        console.error('Load failed', error);
        sendJson(res, 500, { error: String(error) });
      }
      return;
    }



    // ── Serve media files via HTTP (for browser preview) ────────────────────
    if (method === 'GET' && route === '/media/file') {
      const qs = req.url.split('?')[1] || '';
      const params = new URLSearchParams(qs);
      const filePath = params.get('path');
      if (!filePath) {
        sendJson(res, 400, { error: 'Missing "path" query parameter.' });
        return;
      }

      // Security: only serve files under the project data/uploads directory
      const resolved = path.resolve(filePath);
      const allowedDirs = [
        path.resolve(rootDir, 'desktop', 'data'),
      ];
      const isAllowed = allowedDirs.some(dir => resolved.startsWith(dir));
      if (!isAllowed) {
        sendJson(res, 403, { error: 'Access denied.' });
        return;
      }

      try {
        const stat = await fs.stat(resolved);
        const ext = path.extname(resolved).toLowerCase();
        const mimeTypes = {
          '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
          '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
          '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.aac': 'audio/aac',
          '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
          '.gif': 'image/gif', '.webp': 'image/webp',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        // Support Range requests (needed for video seeking)
        const rangeHeader = req.headers.range;
        if (rangeHeader) {
          const parts = rangeHeader.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
          const chunkSize = end - start + 1;

          const { createReadStream } = await import('node:fs');
          const stream = createReadStream(resolved, { start, end });
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
          });
          stream.pipe(res);
        } else {
          const { createReadStream } = await import('node:fs');
          const stream = createReadStream(resolved);
          res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
          });
          stream.pipe(res);
        }
      } catch (err) {
        sendJson(res, 404, { error: `File not found: ${err.message}` });
      }
      return;
    }

    if (method === 'POST' && route === '/media/upload') {
      const rawFilename = req.headers['x-filename'] || `upload-${Date.now()}.bin`;
      const filename = decodeURIComponent(rawFilename);
      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uploadDir = path.join(rootDir, 'desktop', 'data', 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, safeName);

      const writeStream = createWriteStream(filePath);

      req.pipe(writeStream);

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        req.on('error', reject);
      });

      sendJson(res, 200, {
        ok: true,
        path: filePath,
        filename: safeName
      });
      return;
    }

    if (method === 'POST' && route === '/media/ingest') {
      const body = await readBody(req);
      const input = typeof body.input === 'string' ? body.input : '';
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const generateProxy = body.generateProxy === false ? 'false' : 'true';
      const generateWaveform = body.generateWaveform === false ? 'false' : 'true';

      if (!input || !projectId) {
        sendJson(res, 400, {
          error: 'Missing required fields: input, projectId.',
        });
        return;
      }

      try {
        console.log('[Media Ingest] Processing:', input);
        console.log('[Media Ingest] Project ID:', projectId);

        const output = await runNodeScript(mediaIngestScript, [
          '--input',
          input,
          '--project-id',
          projectId,
          '--generate-proxy',
          generateProxy,
          '--generate-waveform',
          generateWaveform,
        ]);

        sendJson(res, 200, JSON.parse(output));
      } catch (error) {
        console.error('[Media Ingest] Error:', error.message);
        console.error('[Media Ingest] Input path:', input);
        sendJson(res, 500, {
          error: 'Media ingest failed',
          details: error.message,
          path: input
        });
      }
      return;
    }

    if (method === 'POST' && route === '/timeline/rough-cut') {
      const body = await readBody(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const durationUs = Number(body.durationUs || 0);
      const fps = Number(body.fps || 30);
      const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef : 'source-video';
      const removeRanges = Array.isArray(body.removeRanges) ? body.removeRanges : [];

      if (!projectId || durationUs <= 0) {
        sendJson(res, 400, {
          error: 'Missing/invalid required fields: projectId, durationUs.',
        });
        return;
      }

      const timeline = buildRoughCutTimeline({
        projectId,
        durationUs,
        fps,
        sourceRef,
        removeRanges,
      });

      await writeTimeline(timeline);
      sendJson(res, 200, timeline);
      return;
    }

    const timelineMatch = route.match(/^\/timeline\/([^/]+)$/);
    if (method === 'GET' && timelineMatch) {
      const projectId = timelineMatch[1];
      try {
        const timeline = await readTimeline(projectId);
        sendJson(res, 200, timeline);
      } catch {
        sendJson(res, 404, { error: 'Timeline not found.' });
      }
      return;
    }

    if (method === 'PATCH' && route === '/timeline/save') {
      const body = await readBody(req);
      const timeline = typeof body.timeline === 'object' && body.timeline ? body.timeline : null;
      if (!timeline || typeof timeline.projectId !== 'string') {
        sendJson(res, 400, { error: 'Missing required field: timeline.' });
        return;
      }

      timeline.version = Number(timeline.version || 1) + 1;
      timeline.updatedAt = new Date().toISOString();
      await writeTimeline(timeline);
      sendJson(res, 200, timeline);
      return;
    }

    sendJson(res, 404, { error: `Route not found: ${method} ${route}` });
  } catch (error) {
    sendJson(res, 500, {
      error: 'Internal server error',
      message: String(error?.message ?? error),
    });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Lapaas desktop backend listening on http://${HOST}:${PORT}\n`);
});

server.on('error', (error) => {
  process.stderr.write(`desktop backend failed: ${String(error?.message ?? error)}\n`);
  process.exit(1);
});
