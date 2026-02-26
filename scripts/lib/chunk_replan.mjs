#!/usr/bin/env node

/**
 * Chunk Re-Plan — Phase 9 Iterative QC Loop
 *
 * Takes failed chunks from chunk_qc_report.json, re-runs the LLM with
 * specific improvement hints derived from the QC scores, and patches
 * the high-retention-plan.json with improved decisions.
 *
 * Limits: max 3 iterations, only re-plans chunks scoring < threshold.
 *
 * Reads: chunk_qc_report.json, high-retention-plan.json, transcript.json
 * Writes: high-retention-plan.json (patched), chunk_replan_log.json
 *
 * Usage:
 *   node scripts/lib/chunk_replan.mjs \
 *     --project-id <id> [--project-dir <dir>] \
 *     [--llm-provider <p>] [--llm-model <m>] [--max-iterations <n>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

// ── Improvement Hint Builder ─────────────────────────────────────────────────

function buildImprovementHint(qcScore) {
  const hints = [];
  const s = qcScore.scores || {};

  if (s.timing < 70) {
    hints.push('TIMING: Stagger overlays so template appears 0-3s, then B-roll fills the rest. Avoid overlapping.');
  }
  if (s.readability < 70) {
    hints.push('READABILITY: Reduce overlayText to max 6 words. Keep it scannable in 2 seconds.');
  }
  if (s.clutter < 70) {
    hints.push('CLUTTER: Use at most 2 overlay elements per chunk (e.g. template + image, NOT template + image + video + text).');
  }
  if (s.relevance < 70) {
    hints.push('RELEVANCE: Make imageQuery/videoQuery directly match the speech topic. Use keywords from the transcript.');
  }
  if (s.pacing < 70) {
    hints.push('PACING: This chunk duration feels unbalanced vs neighbors. Consider if content warrants a shorter/longer display.');
  }

  return hints.length > 0
    ? hints.join('\n')
    : 'General: Improve overall quality of overlay selection and timing.';
}

// ── Re-Plan Single Chunk ─────────────────────────────────────────────────────

async function replanChunk(chunk, originalDecision, improvementHint, llmConfig, catalog, allSegments, chunkTotal) {
  // Dynamic import to avoid circular deps
  const { runLLMPrompt, extractJsonFromLLMOutput } = await import('./llm_provider.mjs');

  const durationSec = Math.round((chunk.endUs - chunk.startUs) / 1_000_000);
  const templateOptions = catalog.slice(0, 6).map(t => ({
    id: t.id, name: t.name, category: t.category,
  }));

  // Build context from surrounding segments
  const CONTEXT_WINDOW_US = 2 * 60 * 1_000_000;
  const windowStart = chunk.startUs - CONTEXT_WINDOW_US;
  const windowEnd = chunk.endUs + CONTEXT_WINDOW_US;
  const contextText = allSegments
    .filter(s => s.endUs >= windowStart && s.startUs <= windowEnd)
    .map(s => s.text)
    .join(' ')
    .slice(0, 600);

  const prompt = `You are an expert video editor creating HIGH-RETENTION content. A previous edit plan for this chunk failed quality checks. Re-plan with the improvements below.

CHUNK (${durationSec}s, chunk ${chunk.index + 1}/${chunkTotal}):
"${chunk.text}"

CONTEXT (±2 min):
"${contextText}"

PREVIOUS PLAN (scored poorly):
${JSON.stringify(originalDecision, null, 1)}

REQUIRED IMPROVEMENTS:
${improvementHint}

AVAILABLE TEMPLATES:
${JSON.stringify(templateOptions, null, 1)}

TIMING RULES:
- startOffsetSec is relative to chunk start (0 = chunk begins)
- durationSec is how long the element displays
- Max chunk duration: ${durationSec}s
- Template first (0-3s), then B-roll fills rest — NO overlap

Output ONLY raw JSON (improved plan):
{
  "cut": false,
  "cutReason": null,
  "template": {
    "templateId": "id",
    "headline": "5-7 word headline",
    "subline": "supporting text (max 40 chars)",
    "startOffsetSec": 0,
    "durationSec": 3
  },
  "imageQuery": "specific descriptive English query",
  "imageTiming": { "startOffsetSec": 3, "durationSec": ${Math.max(2, durationSec - 3)} },
  "videoQuery": "or null if image is better",
  "videoTiming": null,
  "overlayText": "max 6 words",
  "overlayTextTiming": { "startOffsetSec": 1, "durationSec": 2 },
  "visualPriority": "template|image|video",
  "transition": "cut|dissolve|slide"
}`;

  try {
    const response = await runLLMPrompt(llmConfig, prompt, 120_000);
    const result = extractJsonFromLLMOutput(response);

    const normTemplate = result.template ? {
      ...result.template,
      startOffsetSec: Number(result.template.startOffsetSec ?? 0),
      durationSec: Math.min(Number(result.template.durationSec ?? 3), durationSec),
    } : null;

    return {
      chunkIndex: chunk.index,
      startUs: chunk.startUs,
      endUs: chunk.endUs,
      durationSec,
      text: chunk.text,
      cut: Boolean(result.cut),
      cutReason: result.cutReason || null,
      template: normTemplate,
      imageQuery: result.imageQuery || null,
      imageTiming: result.imageTiming ? {
        startOffsetSec: Math.min(Number(result.imageTiming.startOffsetSec ?? 0), durationSec),
        durationSec: Math.min(Number(result.imageTiming.durationSec ?? durationSec), durationSec),
      } : null,
      videoQuery: result.videoQuery || null,
      videoTiming: result.videoTiming ? {
        startOffsetSec: Math.min(Number(result.videoTiming.startOffsetSec ?? 0), durationSec),
        durationSec: Math.min(Number(result.videoTiming.durationSec ?? durationSec), durationSec),
      } : null,
      overlayText: result.overlayText || null,
      overlayTextTiming: result.overlayTextTiming ? {
        startOffsetSec: Math.min(Number(result.overlayTextTiming.startOffsetSec ?? 0), durationSec),
        durationSec: Math.min(Number(result.overlayTextTiming.durationSec ?? 3), durationSec),
      } : null,
      visualPriority: result.visualPriority || 'template',
      transition: result.transition || 'cut',
      aiSource: `${llmConfig.provider}/${llmConfig.model}`,
      replanned: true,
    };
  } catch (e) {
    console.error(`[Replan] Chunk ${chunk.index} re-plan failed: ${e.message}`);
    return null; // Keep original
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = readArg('--project-id');
  if (!projectId) throw new Error('Missing --project-id');

  const projectDir = readArg('--project-dir') || path.resolve(ROOT_DIR, 'desktop', 'data', projectId);
  const maxIterations = Number(readArg('--max-iterations', '2')) || 2;
  const llmProvider = readArg('--llm-provider') || process.env.LAPAAS_LLM_PROVIDER || 'ollama';
  const llmModel = readArg('--llm-model') || process.env.LAPAAS_LLM_MODEL || 'qwen3:1.7b';
  const llmConfig = { provider: llmProvider, model: llmModel };

  const qcPath = path.join(projectDir, 'chunk_qc_report.json');
  const hrPlanPath = path.join(projectDir, 'high-retention-plan.json');
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const logPath = path.join(projectDir, 'chunk_replan_log.json');

  if (!(await exists(qcPath)) || !(await exists(hrPlanPath))) {
    const result = { ok: true, projectId, replanned: 0, iterations: 0, message: 'No QC report or HR plan found' };
    await writeJson(logPath, result);
    await new Promise(r => process.stdout.write(JSON.stringify(result, null, 2), r));
    return;
  }

  const qcReport = await readJson(qcPath);
  const hrPlan = await readJson(hrPlanPath);
  const transcript = await readJson(transcriptPath);
  const segments = transcript.segments || [];
  const decisions = hrPlan.decisions || [];

  // Discover template catalog (inline fallback)
  let catalog = [
    { id: 'breaking-news', name: 'Breaking Business News', category: 'news' },
    { id: 'earnings-report', name: 'Earnings Report', category: 'finance' },
    { id: 'ai-ml-update', name: 'AI / ML Update', category: 'tech' },
    { id: 'stat-reveal', name: 'Stat Reveal', category: 'stat' },
    { id: 'key-point', name: 'Key Point', category: 'highlight' },
    { id: 'quote-card', name: 'Quote Card', category: 'quote' },
  ];

  const failedScores = (qcReport.scores || []).filter(s => !s.passed);

  if (failedScores.length === 0) {
    console.error('[Replan] All chunks passed QC — no re-planning needed');
    const result = { ok: true, projectId, replanned: 0, iterations: 0, message: 'All chunks passed' };
    await writeJson(logPath, result);
    await new Promise(r => process.stdout.write(JSON.stringify(result, null, 2), r));
    return;
  }

  console.error(`[Replan] ${failedScores.length} chunks failed QC (threshold: ${qcReport.config?.passThreshold || 70}). Max iterations: ${maxIterations}`);

  const replanLog = [];
  let totalReplanned = 0;

  for (let iter = 1; iter <= maxIterations; iter++) {
    // Re-read QC report after each iteration (it may have been updated)
    const currentQc = iter === 1 ? qcReport : await readJson(qcPath);
    const currentFailed = (currentQc.scores || []).filter(s => !s.passed);

    if (currentFailed.length === 0) {
      console.error(`[Replan] Iteration ${iter}: All chunks now pass QC`);
      break;
    }

    console.error(`[Replan] Iteration ${iter}: Re-planning ${currentFailed.length} failed chunks...`);

    let iterReplanned = 0;

    for (const failedChunk of currentFailed) {
      const chunkIdx = failedChunk.chunkIndex;
      const originalDecision = decisions[chunkIdx];
      if (!originalDecision) continue;

      const hint = buildImprovementHint(failedChunk);
      const chunk = {
        index: chunkIdx,
        startUs: originalDecision.startUs,
        endUs: originalDecision.endUs,
        text: originalDecision.text || '',
      };

      const improved = await replanChunk(chunk, originalDecision, hint, llmConfig, catalog, segments, decisions.length);

      if (improved) {
        // Patch the decision in place
        decisions[chunkIdx] = improved;
        iterReplanned++;
        totalReplanned++;

        replanLog.push({
          iteration: iter,
          chunkIndex: chunkIdx,
          previousScore: failedChunk.overall,
          hint,
          replanned: true,
        });

        console.error(`  ✓ Chunk ${chunkIdx}: re-planned (was ${failedChunk.overall}/100)`);
      } else {
        replanLog.push({
          iteration: iter,
          chunkIndex: chunkIdx,
          previousScore: failedChunk.overall,
          hint,
          replanned: false,
          reason: 'LLM re-plan failed',
        });
      }
    }

    console.error(`[Replan] Iteration ${iter}: ${iterReplanned} chunks re-planned`);

    // Save updated HR plan
    hrPlan.decisions = decisions;
    hrPlan.replanIterations = (hrPlan.replanIterations || 0) + 1;
    hrPlan.lastReplanAt = new Date().toISOString();
    await writeJson(hrPlanPath, hrPlan);

    // Re-run chunk QC to check if improvements helped
    if (iter < maxIterations) {
      try {
        const { execFile: execFileCb } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execFile = promisify(execFileCb);

        const scriptPath = path.join(ROOT_DIR, 'scripts', 'lib', 'chunk_qc.mjs');
        await execFile('node', [scriptPath, '--project-id', projectId, '--project-dir', projectDir], {
          timeout: 5 * 60 * 1000,
          maxBuffer: 1024 * 1024 * 16,
        });
      } catch (e) {
        console.error(`[Replan] Re-scoring failed: ${e.message}`);
        break;
      }
    }
  }

  const result = {
    ok: true,
    projectId,
    completedAt: new Date().toISOString(),
    replanned: totalReplanned,
    iterations: Math.min(maxIterations, replanLog.length > 0 ? replanLog[replanLog.length - 1].iteration : 0),
    maxIterations,
    log: replanLog,
  };

  await writeJson(logPath, result);

  console.error(`[Replan] Done: ${totalReplanned} chunks re-planned across ${result.iterations} iterations`);

  await new Promise(r => process.stdout.write(JSON.stringify(result, null, 2), r));
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
