import fs from 'node:fs/promises';
import path from 'node:path';

function nowIso() {
  return new Date().toISOString();
}

function toSafeNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, numeric);
}

function average(nextValue, currentAverage, count) {
  if (count <= 1) {
    return nextValue;
  }
  return currentAverage + (nextValue - currentAverage) / count;
}

async function readJsonIfExists(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function createStageTracker() {
  const stageDurationsMs = {};

  return {
    async run(stage, fn) {
      const startNs = process.hrtime.bigint();
      try {
        return await fn();
      } finally {
        const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
        stageDurationsMs[stage] = Number(elapsedMs.toFixed(2));
      }
    },
    snapshot() {
      return { ...stageDurationsMs };
    },
  };
}

export async function recordProjectTelemetry({
  projectDir,
  projectId,
  pipeline,
  status,
  stageDurationsMs = {},
  meta = {},
  error = '',
}) {
  const telemetryDir = path.join(projectDir, 'telemetry');
  const eventsPath = path.join(telemetryDir, 'events.jsonl');
  const summaryPath = path.join(telemetryDir, 'summary.json');
  await fs.mkdir(telemetryDir, { recursive: true });

  const totalDurationMs = Object.values(stageDurationsMs).reduce(
    (sum, value) => sum + toSafeNumber(value),
    0,
  );

  const event = {
    timestamp: nowIso(),
    projectId,
    pipeline,
    status,
    error: String(error || ''),
    totalDurationMs: Number(totalDurationMs.toFixed(2)),
    stageDurationsMs,
    meta,
  };
  await fs.appendFile(eventsPath, `${JSON.stringify(event)}\n`, 'utf8');

  const summary = await readJsonIfExists(summaryPath, {
    projectId,
    updatedAt: '',
    totals: {
      events: 0,
      success: 0,
      failed: 0,
    },
    byPipeline: {},
  });

  const normalized = summary && typeof summary === 'object' ? summary : {};
  const totals = normalized.totals && typeof normalized.totals === 'object' ? normalized.totals : {};
  const byPipeline =
    normalized.byPipeline && typeof normalized.byPipeline === 'object' ? normalized.byPipeline : {};
  const statusUpper = String(status || '').toUpperCase();
  const failed = statusUpper.includes('FAILED') || statusUpper.includes('ERROR');
  const success = !failed;

  totals.events = Number(totals.events || 0) + 1;
  if (failed) {
    totals.failed = Number(totals.failed || 0) + 1;
  }
  if (success) {
    totals.success = Number(totals.success || 0) + 1;
  }

  const current = byPipeline[pipeline] && typeof byPipeline[pipeline] === 'object' ? byPipeline[pipeline] : {};
  current.events = Number(current.events || 0) + 1;
  current.failed = Number(current.failed || 0) + (failed ? 1 : 0);
  current.success = Number(current.success || 0) + (success ? 1 : 0);
  current.lastStatus = status;
  current.lastEventAt = event.timestamp;
  current.avgTotalDurationMs = Number(
    average(
      event.totalDurationMs,
      toSafeNumber(current.avgTotalDurationMs || 0),
      Number(current.events || 1),
    ).toFixed(2),
  );

  const stageAverages =
    current.stageAveragesMs && typeof current.stageAveragesMs === 'object'
      ? current.stageAveragesMs
      : {};
  const stageCounts =
    current.stageSampleCounts && typeof current.stageSampleCounts === 'object'
      ? current.stageSampleCounts
      : {};

  for (const [stage, rawValue] of Object.entries(stageDurationsMs || {})) {
    const value = toSafeNumber(rawValue);
    const count = Number(stageCounts[stage] || 0) + 1;
    const avg = average(value, toSafeNumber(stageAverages[stage] || 0), count);
    stageCounts[stage] = count;
    stageAverages[stage] = Number(avg.toFixed(2));
  }

  current.stageAveragesMs = stageAverages;
  current.stageSampleCounts = stageCounts;
  byPipeline[pipeline] = current;

  await writeJson(summaryPath, {
    projectId,
    updatedAt: event.timestamp,
    totals,
    byPipeline,
  });

  return {
    eventsPath,
    summaryPath,
    event,
  };
}

