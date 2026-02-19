#!/usr/bin/env node

import http from 'node:http';
import { execFile as execFileCb } from 'node:child_process';
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Load .env from project root so API keys reach all child processes
{
    const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');
    if (existsSync(envPath)) {
        const lines = (await fs.readFile(envPath, 'utf8')).split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq === -1) continue;
            const key = trimmed.slice(0, eq).trim();
            const val = trimmed.slice(eq + 1).trim();
            if (key && val && !process.env[key]) process.env[key] = val;
        }
        console.log('[Server] Loaded .env');
    }
}

const execFile = promisify(execFileCb);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

// Track background jobs for HF downloads
const hfJobs = new Map();

const discoveryScript = path.join(rootDir, 'scripts', 'model_runtime_discovery.mjs');
const modelHealthScript = path.join(rootDir, 'scripts', 'model_runtime_health.mjs');
const installScript = path.join(rootDir, 'scripts', 'model_runtime_install.mjs');
const hardwareDiagnosticsScript = path.join(rootDir, 'scripts', 'hardware_diagnostics.mjs');
const firstRunChecksScript = path.join(rootDir, 'scripts', 'first_run_checks.mjs');
const mediaIngestScript = path.join(rootDir, 'scripts', 'media_ingest.mjs');
const startEditingScript = path.join(rootDir, 'scripts', 'start_editing_pipeline.mjs');
const editNowScript = path.join(rootDir, 'scripts', 'edit_now_pipeline.mjs');
const renderScript = path.join(rootDir, 'scripts', 'render_pipeline.mjs');
const agenticEditScript = path.join(rootDir, 'scripts', 'agentic_editing_pipeline.mjs');
const transcribeOnlyScript = path.join(rootDir, 'scripts', 'transcribe_only.mjs');
const cutPlanOnlyScript = path.join(rootDir, 'scripts', 'cut_plan_only.mjs');
const overlayPlanChunkScript = path.join(rootDir, 'scripts', 'overlay_plan_chunk.mjs');
const fetchFreeAssetsScript = path.join(rootDir, 'scripts', 'fetch_free_assets.mjs');
const exportFcpxmlScript = path.join(rootDir, 'scripts', 'export_fcpxml.mjs');
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

// ── Project Directory Resolver ──────────────────────────────────────────────
// Resolves the on-disk directory for a project. Supports custom paths stored
// in projects.json (field: projectDir). Falls back to desktop/data/{id}.
let _projectDirCache = null;
async function projectDir(projectId) {
  if (!_projectDirCache) {
    try {
      const projects = await readProjects();
      _projectDirCache = new Map(projects.map(p => [p.id, p.projectDir || null]));
    } catch {
      _projectDirCache = new Map();
    }
  }
  const custom = _projectDirCache.get(projectId);
  if (custom) return custom;
  return path.join(rootDir, 'desktop', 'data', projectId);
}

function invalidateProjectDirCache() {
  _projectDirCache = null;
}

async function timelineFile(projectId) {
  return path.join(await projectDir(projectId), 'timeline.json');
}

async function renderHistoryFile(projectId) {
  return path.join(await projectDir(projectId), 'renders', 'history.json');
}

async function telemetrySummaryFile(projectId) {
  return path.join(await projectDir(projectId), 'telemetry', 'summary.json');
}

async function telemetryEventsFile(projectId) {
  return path.join(await projectDir(projectId), 'telemetry', 'events.jsonl');
}

async function ensureTimelineStore(projectId) {
  const file = await timelineFile(projectId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  return file;
}

async function readTimeline(projectId) {
  const file = await timelineFile(projectId);
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function readRenderHistory(projectId) {
  const file = await renderHistoryFile(projectId);
  const raw = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function readProjectTelemetry(projectId, limit = 60) {
  const summaryPath = await telemetrySummaryFile(projectId);
  const eventsPath = await telemetryEventsFile(projectId);
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

async function stateFile(projectId) {
  return path.join(await projectDir(projectId), 'state.json');
}

async function ensureStateStore(projectId) {
  const file = await stateFile(projectId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  return file;
}

async function writeState(projectId, state) {
  const file = await ensureStateStore(projectId);
  await fs.writeFile(file, JSON.stringify(state, null, 2), 'utf8');
}

async function readState(projectId) {
  const file = await stateFile(projectId);
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
    env: { ...process.env }, // Explicitly pass env so API keys set at runtime propagate
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
      const id = randomUUID();
      // Support custom project folder — default to desktop/data/{id}
      let customDir = typeof body.projectDir === 'string' ? body.projectDir.trim() : '';
      if (!customDir) {
        customDir = path.join(rootDir, 'desktop', 'data', id);
      }
      await fs.mkdir(customDir, { recursive: true });

      const project = {
        id,
        name,
        settings,
        projectDir: customDir,
        status: 'PROJECT_CREATED',
        createdAt: now,
        updatedAt: now,
      };
      projects.push(project);
      await writeProjects(projects);
      invalidateProjectDirCache();
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

    // ── Pipeline: Standalone Transcription ─────────────────────────────────
    if (method === 'POST' && route === '/pipeline/transcribe') {
      const body = await readBody(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const input = typeof body.input === 'string' ? body.input : '';
      const mode = typeof body.mode === 'string' ? body.mode : 'hybrid';
      const language = typeof body.language === 'string' ? body.language : 'en';
      const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef : 'source-video';
      const fallbackPolicy = typeof body.fallbackPolicy === 'string' ? body.fallbackPolicy.trim() : '';
      const transcriptionModel = typeof body.transcriptionModel === 'string' ? body.transcriptionModel.trim() : '';

      if (!projectId || !input) {
        sendJson(res, 400, { error: 'Missing required fields: projectId, input.' });
        return;
      }

      const pDir = await projectDir(projectId);
      const args = ['--project-id', projectId, '--project-dir', pDir, '--input', input, '--mode', mode, '--language', language, '--source-ref', sourceRef];
      if (fallbackPolicy) args.push('--fallback-policy', fallbackPolicy);
      if (transcriptionModel) args.push('--transcription-model', transcriptionModel);

      try {
        await updateProjectStatus(projectId, 'TRANSCRIBING');
        const raw = await runNodeScript(transcribeOnlyScript, args, 10 * 60 * 1000);
        const result = JSON.parse(raw);
        await updateProjectStatus(projectId, 'TRANSCRIPT_READY');
        sendJson(res, 200, result);
      } catch (error) {
        await updateProjectStatus(projectId, 'TRANSCRIPTION_FAILED').catch(() => { });
        throw error;
      }
      return;
    }

    // ── Pipeline: Standalone Cut Planning ──────────────────────────────────
    if (method === 'POST' && route === '/pipeline/cut-plan') {
      const body = await readBody(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const input = typeof body.input === 'string' ? body.input : '';
      const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef : 'source-video';
      const mode = typeof body.mode === 'string' ? body.mode : 'heuristic';
      const llmProvider = typeof body.llmProvider === 'string' ? body.llmProvider.trim() : '';
      const llmModel = typeof body.llmModel === 'string' ? body.llmModel.trim() : '';

      if (!projectId || !input) {
        sendJson(res, 400, { error: 'Missing required fields: projectId, input.' });
        return;
      }

      const pDir = await projectDir(projectId);
      const args = ['--project-id', projectId, '--project-dir', pDir, '--input', input, '--source-ref', sourceRef, '--mode', mode];
      if (llmProvider) args.push('--llm-provider', llmProvider);
      if (llmModel) args.push('--llm-model', llmModel);

      try {
        await updateProjectStatus(projectId, 'PLANNING_CUTS');
        const raw = await runNodeScript(cutPlanOnlyScript, args, 5 * 60 * 1000);
        const result = JSON.parse(raw);

        // Also build the rough-cut timeline
        const fps = Number(body.fps || 30);
        const timeline = buildRoughCutTimeline({
          projectId,
          durationUs: Number(result.durationUs || 0),
          fps,
          sourceRef,
          removeRanges: Array.isArray(result.removeRanges) ? result.removeRanges : [],
        });
        await writeTimeline(timeline);
        await updateProjectStatus(projectId, 'CUTS_READY');
        sendJson(res, 200, { ...result, timeline });
      } catch (error) {
        await updateProjectStatus(projectId, 'CUT_PLAN_FAILED').catch(() => { });
        throw error;
      }
      return;
    }

    // ── Pipeline: Chunk Overlay Planning ─────────────────────────────────
    if (method === 'POST' && route === '/pipeline/overlay-plan-chunk') {
      const body = await readBody(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const chunkIndex = Number(body.chunkIndex ?? 0);
      const chunkStartUs = Number(body.chunkStartUs ?? 0);
      const chunkEndUs = Number(body.chunkEndUs ?? 60_000_000);
      const mode = typeof body.mode === 'string' ? body.mode : 'auto';
      const llmProvider = typeof body.llmProvider === 'string' ? body.llmProvider.trim() : '';
      const llmModel = typeof body.llmModel === 'string' ? body.llmModel.trim() : '';

      if (!projectId) {
        sendJson(res, 400, { error: 'Missing required field: projectId.' });
        return;
      }

      const pDir = await projectDir(projectId);
      const args = [
        '--project-id', projectId,
        '--project-dir', pDir,
        '--chunk-index', String(chunkIndex),
        '--chunk-start-us', String(chunkStartUs),
        '--chunk-end-us', String(chunkEndUs),
        '--mode', mode,
      ];
      if (llmProvider) args.push('--llm-provider', llmProvider);
      if (llmModel) args.push('--llm-model', llmModel);

      try {
        const raw = await runNodeScript(overlayPlanChunkScript, args, 3 * 60 * 1000);
        const result = JSON.parse(raw);
        sendJson(res, 200, result);
      } catch (error) {
        throw error;
      }
      return;
    }

    // ── Pipeline: Fetch Free Asset ──────────────────────────────────────
    if (method === 'POST' && route === '/pipeline/fetch-asset') {
      const body = await readBody(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const query = typeof body.query === 'string' ? body.query : '';
      const kind = typeof body.kind === 'string' ? body.kind : 'image';
      const provider = typeof body.provider === 'string' ? body.provider : 'pexels';

      if (!projectId || !query) {
        sendJson(res, 400, { error: 'Missing required fields: projectId, query.' });
        return;
      }

      const pDir = await projectDir(projectId);
      const args = [
        '--project-id', projectId,
        '--project-dir', pDir,
        '--query', query,
        '--kind', kind,
        '--provider', provider,
      ];

      try {
        const raw = await runNodeScript(fetchFreeAssetsScript, args, 60 * 1000);
        const result = JSON.parse(raw);
        sendJson(res, 200, result);
      } catch (error) {
        throw error;
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
      const llmProvider = typeof body.llmProvider === 'string' ? body.llmProvider.trim() : '';
      const llmModel = typeof body.llmModel === 'string' ? body.llmModel.trim() : '';

      if (!projectId || !input) {
        sendJson(res, 400, {
          error: 'Missing required fields: projectId, input.',
        });
        return;
      }

      const pDir = await projectDir(projectId);
      const args = [
        '--project-id',
        projectId,
        '--project-dir',
        pDir,
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
      if (llmProvider) {
        args.push('--llm-provider', llmProvider);
      }
      if (llmModel) {
        args.push('--llm-model', llmModel);
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

      const pDir = await projectDir(projectId);
      const args = [
        '--project-id',
        projectId,
        '--project-dir',
        pDir,
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

    // ── Agentic Edit: full AI-driven pipeline ──────────────────────────────
    if (method === 'POST' && route === '/agentic-edit') {
      const body = await readBody(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      const input = typeof body.input === 'string' ? body.input : '';
      const language = typeof body.language === 'string' ? body.language : 'hi';
      const fps = Number(body.fps || 30);
      const mode = typeof body.mode === 'string' ? body.mode : 'hybrid';
      const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef : 'source-video';
      const fetchExternal = body.fetchExternal === false ? 'false' : 'true';
      const llmProvider = typeof body.llmProvider === 'string' ? body.llmProvider.trim() : '';
      const llmModel = typeof body.llmModel === 'string' ? body.llmModel.trim() : '';

      if (!projectId || !input) {
        sendJson(res, 400, { error: 'Missing required fields: projectId, input.' });
        return;
      }

      await updateProjectStatus(projectId, 'AGENTIC_EDIT_IN_PROGRESS');
      try {
        const pDir = await projectDir(projectId);
        const raw = await runNodeScript(agenticEditScript, [
          '--project-id', projectId,
          '--project-dir', pDir,
          '--input', input,
          '--language', language,
          '--fps', String(fps),
          '--mode', mode,
          '--source-ref', sourceRef,
          '--fetch-external', fetchExternal,
          ...(llmProvider ? ['--llm-provider', llmProvider] : []),
          ...(llmModel ? ['--llm-model', llmModel] : []),
        ], 20 * 60 * 1000);
        const result = JSON.parse(raw);
        await updateProjectStatus(projectId, 'AGENTIC_EDIT_DONE');
        sendJson(res, 200, result);
      } catch (error) {
        await updateProjectStatus(projectId, 'AGENTIC_EDIT_FAILED').catch(() => { });
        throw error;
      }
      return;
    }

    // ── Agentic Edit Progress ──────────────────────────────────────────────
    const agenticProgressMatch = route.match(/^\/agentic-edit\/progress\/([^/]+)$/);
    if (method === 'GET' && agenticProgressMatch) {
      const projectId = agenticProgressMatch[1];
      const progressFile = path.join(rootDir, 'desktop', 'data', projectId, 'agent_state.json');
      try {
        const raw = await fs.readFile(progressFile, 'utf8');
        sendJson(res, 200, JSON.parse(raw));
      } catch {
        sendJson(res, 200, { status: 'idle', percent: 0 });
      }
      return;
    }

    // ── AI Provider Catalog ───────────────────────────────────────────────
    if (method === 'GET' && route === '/ai/providers') {
      try {
        const { getProviderCatalog } = await import(path.join(rootDir, 'scripts', 'lib', 'llm_provider.mjs'));
        // Merge availability from saved config
        const configPath = path.join(rootDir, 'desktop', 'data', 'ai_config.json');
        let savedKeys = {};
        try { savedKeys = JSON.parse(await fs.readFile(configPath, 'utf8')); } catch { }
        const providers = getProviderCatalog();
        // Mark cloud providers as available if their API key is set
        for (const p of providers) {
          if (p.type === 'cloud') {
            const envKeyMap = { openai: 'OPENAI_API_KEY', google: 'GOOGLE_API_KEY', anthropic: 'ANTHROPIC_API_KEY', sarvam: 'SARVAM_API_KEY' };
            const envKey = envKeyMap[p.id];
            p.available = !!(savedKeys[envKey] || process.env[envKey]);
          }
        }
        sendJson(res, 200, { providers });
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to load provider catalog: ' + e.message });
      }
      return;
    }

    // ── AI Config: Save/Load API Keys ────────────────────────────────────
    const aiConfigPath = path.join(rootDir, 'desktop', 'data', 'ai_config.json');

    if (method === 'GET' && route === '/ai/config') {
      try {
        const raw = await fs.readFile(aiConfigPath, 'utf8');
        const config = JSON.parse(raw);
        // Mask API keys for security (only show last 4 chars)
        const masked = {};
        for (const [key, val] of Object.entries(config)) {
          if (typeof val === 'string' && val.length > 4) {
            masked[key] = '•'.repeat(val.length - 4) + val.slice(-4);
          } else {
            masked[key] = val;
          }
        }
        sendJson(res, 200, { config: masked, hasKeys: Object.keys(config).length > 0 });
      } catch {
        sendJson(res, 200, { config: {}, hasKeys: false });
      }
      return;
    }

    if (method === 'POST' && route === '/ai/config') {
      const body = await readBody(req);
      // body should be { key: 'SARVAM_API_KEY', value: 'sk_...' } or { keys: { SARVAM_API_KEY: '...', ... } }
      try {
        let existing = {};
        try { existing = JSON.parse(await fs.readFile(aiConfigPath, 'utf8')); } catch { }

        if (body.keys && typeof body.keys === 'object') {
          // Bulk update
          for (const [k, v] of Object.entries(body.keys)) {
            if (typeof v === 'string' && v.trim()) {
              existing[k] = v.trim();
              process.env[k] = v.trim(); // Set immediately for current session
            }
          }
        } else if (body.key && body.value) {
          existing[body.key] = body.value.trim();
          process.env[body.key] = body.value.trim();
        }

        await fs.mkdir(path.dirname(aiConfigPath), { recursive: true });
        await fs.writeFile(aiConfigPath, JSON.stringify(existing, null, 2), 'utf8');
        sendJson(res, 200, { ok: true, message: 'API keys saved' });
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to save config: ' + e.message });
      }
      return;
    }

    // ── Load saved API keys into process.env on startup ──────────────────
    // (This is a lazy-load pattern; keys are set when /ai/config POST or GET is first called)

    // ── Ollama: List installed models ────────────────────────────────────
    if (method === 'GET' && route === '/ai/ollama/models') {
      try {
        const { stdout } = await execFile('ollama', ['list'], { timeout: 10000 });
        const lines = stdout.trim().split('\n').slice(1); // Skip header
        const models = lines.map(line => {
          const parts = line.split(/\s+/);
          return { name: parts[0], size: parts[2] ? parts[1] + ' ' + parts[2] : parts[1] };
        }).filter(m => m.name);
        sendJson(res, 200, { models });
      } catch (e) {
        sendJson(res, 200, { models: [], error: 'Ollama not running: ' + e.message });
      }
      return;
    }

    // ── Ollama: Pull / Install model ─────────────────────────────────────
    if (method === 'POST' && route === '/ai/ollama/pull') {
      const body = await readBody(req);
      const model = typeof body.model === 'string' ? body.model.trim() : '';
      if (!model) {
        sendJson(res, 400, { error: 'Missing model name' });
        return;
      }
      try {
        const { stdout, stderr } = await execFile('ollama', ['pull', model], {
          timeout: 10 * 60 * 1000, // 10 min timeout for large models
          maxBuffer: 1024 * 1024 * 4,
        });
        sendJson(res, 200, { ok: true, model, output: (stdout || stderr || '').slice(0, 500) });
      } catch (e) {
        sendJson(res, 500, { error: `Failed to pull ${model}: ${e.message}` });
      }
      return;
    }

    // ── Hugging Face: Search GGUF files ──────────────────────────────────
    if (method === 'POST' && route === '/ai/huggingface/search') {
      const body = await readBody(req);
      const repo = body?.repo;

      if (!repo) {
        sendJson(res, 400, { error: 'Missing repo' });
        return;
      }

      try {
        const hfRes = await fetch(`https://huggingface.co/api/models/${repo}/tree/main`);
        if (!hfRes.ok) throw new Error(`HF API error: ${hfRes.statusText}`);

        const files = await hfRes.json();
        // Handle if repo has subdirectories - recursive omitted for simplicity, most are flat or main
        const ggufs = Array.isArray(files) ? files
          .filter(f => f.path.endsWith('.gguf'))
          .map(f => ({
            path: f.path,
            size: f.size,
            oid: f.oid
          })) : [];

        sendJson(res, 200, { files: ggufs });
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to search HF: ' + e.message });
      }
      return;
    }

    // ── Hugging Face: Pull & Install ─────────────────────────────────────
    if (method === 'POST' && route === '/ai/huggingface/pull') {
      const body = await readBody(req);
      const { repo, filename, modelName } = body;

      if (!repo || !filename || !modelName) {
        sendJson(res, 400, { error: 'Missing repo, filename, or modelName' });
        return;
      }

      const jobId = randomUUID();
      hfJobs.set(jobId, { status: 'pending', percent: 0, message: 'Starting...' });

      // Background job
      (async () => {
        try {
          const modelsDir = path.join(os.homedir(), '.lapaas', 'models', 'gguf');
          await fs.mkdir(modelsDir, { recursive: true });
          const destPath = path.join(modelsDir, filename);

          // 1. Download
          hfJobs.set(jobId, { status: 'downloading', percent: 0, message: 'Downloading GGUF...' });

          const downloadUrl = `https://huggingface.co/${repo}/resolve/main/${filename}`;
          const response = await fetch(downloadUrl);
          if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

          const totalSize = Number(response.headers.get('content-length') || 0);
          let downloaded = 0;

          const fileStream = createWriteStream(destPath);
          const bodyStream = Readable.fromWeb(response.body);

          for await (const chunk of bodyStream) {
            fileStream.write(chunk);
            downloaded += chunk.length;
            if (totalSize) {
              const percent = Math.round((downloaded / totalSize) * 100);
              // Update every 1% or so to avoid spamming map updates? Map is fast.
              hfJobs.set(jobId, { status: 'downloading', percent, message: `Downloading ${percent}%` });
            }
          }
          fileStream.end();

          // 2. Create Modelfile
          hfJobs.set(jobId, { status: 'importing', percent: 100, message: 'Creating Modelfile...' });
          const modelfileContent = `FROM ${destPath}\n`;
          const modelfilePath = path.join(modelsDir, `${filename}.Modelfile`);
          await fs.writeFile(modelfilePath, modelfileContent);

          // 3. Ollama Create
          hfJobs.set(jobId, { status: 'importing', percent: 100, message: 'Importing into Ollama...' });
          await execFile('ollama', ['create', modelName, '-f', modelfilePath]);

          // 4. Cleanup
          await fs.unlink(modelfilePath);
          await fs.unlink(destPath);

          hfJobs.set(jobId, { status: 'completed', percent: 100, message: 'Done!' });
        } catch (e) {
          console.error('HF Pull Job Failed:', e);
          hfJobs.set(jobId, { status: 'failed', percent: 0, message: e.message });
        }
      })();

      sendJson(res, 200, { jobId });
      return;
    }

    // ── Hugging Face: Job Progress ───────────────────────────────────────
    if (method === 'GET' && route.startsWith('/ai/huggingface/progress/')) {
      const jobId = route.split('/').pop();
      const job = hfJobs.get(jobId);

      if (!job) {
        sendJson(res, 404, { error: 'Job not found' });
        return;
      }
      sendJson(res, 200, job);
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
        const pDir = await projectDir(projectId);
        const raw = await runNodeScript(
          renderScript,
          [
            '--project-id',
            projectId,
            '--project-dir',
            pDir,
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



    const timelineMatchFCP = route.match(/^\/projects\/([^/]+)\/export-fcpxml$/);
    if (method === 'POST' && timelineMatchFCP) {
      const projectId = timelineMatchFCP[1];
      const pDir = await projectDir(projectId);
      const output = path.join(pDir, 'project.fcpxml');

      try {
        await runNodeScript(exportFcpxmlScript, ['--project-id', projectId, '--project-dir', pDir, '--output', output]);
        // Also open the folder
        // await execFile('open', ['-R', output]); // Frontend can do this via /open-path if desired
        sendJson(res, 200, { ok: true, path: output });
      } catch (e) {
        sendJson(res, 500, { error: 'FCPXML Export failed: ' + e.message });
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
            'Cache-Control': 'no-cache, no-store, must-revalidate',
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
            'Cache-Control': 'no-cache, no-store, must-revalidate',
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
      const uploadProjectId = req.headers['x-project-id'] || '';
      const filename = decodeURIComponent(rawFilename);
      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9.\-_]/g, '_');
      // Store inside the project folder if project ID is provided
      let uploadDir;
      if (uploadProjectId) {
        const pDir = await projectDir(uploadProjectId);
        uploadDir = path.join(pDir, 'uploads');
      } else {
        uploadDir = path.join(rootDir, 'desktop', 'data', 'uploads');
      }
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

        const pDir = await projectDir(projectId);
        const output = await runNodeScript(mediaIngestScript, [
          '--input',
          input,
          '--project-id',
          projectId,
          '--project-dir',
          pDir,
          '--generate-proxy',
          generateProxy,
          '--generate-waveform',
          generateWaveform,
        ], 300000);

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

// Load saved AI API keys into process.env at startup
try {
  const cfgRaw = await fs.readFile(path.join(rootDir, 'desktop', 'data', 'ai_config.json'), 'utf8');
  const cfg = JSON.parse(cfgRaw);
  for (const [k, v] of Object.entries(cfg)) {
    if (typeof v === 'string' && v.trim() && !process.env[k]) {
      process.env[k] = v.trim();
    }
  }
  process.stderr.write(`[startup] Loaded ${Object.keys(cfg).length} saved API key(s)\n`);
} catch { /* no saved config yet */ }

server.listen(PORT, HOST, () => {
  process.stdout.write(`Lapaas desktop backend listening on http://${HOST}:${PORT}\n`);
});

server.on('error', (error) => {
  process.stderr.write(`desktop backend failed: ${String(error?.message ?? error)}\n`);
  process.exit(1);
});
