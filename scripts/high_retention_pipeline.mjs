#!/usr/bin/env node

/**
 * High-Retention Editing Pipeline
 *
 * Splits the transcript into topic chunks (2-3 sentences, ~5-7s each).
 * For each chunk, AI (with 2-3 min context window) decides:
 *   - Template to show (title card, stat, quote, etc.)
 *   - Stock image search query
 *   - Stock video search query
 *   - Whether to CUT this chunk (repetition / filler)
 *
 * Guarantees something happens every 5-7 seconds in the output.
 * Chunks are processed in parallel (Metal-optimised on Apple Silicon).
 *
 * Output: high-retention-plan.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { runLLMPrompt, extractJsonFromLLMOutput, detectBestLLM } from './lib/llm_provider.mjs';
import { parallelMap } from './lib/metal_accel.mjs';

const execFile = promisify(execFileCb);

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readArg(flag, fallback = '') {
    const idx = process.argv.indexOf(flag);
    if (idx === -1) return fallback;
    return process.argv[idx + 1] ?? fallback;
}

async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Topic Chunker ─────────────────────────────────────────────────────────────
// Groups transcript segments into topic chunks of 2-3 sentences (~5-7 seconds).
// A new chunk starts when:
//   - We have ≥2 sentences AND duration ≥5s, OR
//   - We have ≥3 sentences, OR
//   - There's a long pause (>1.5s gap between segments)

const TARGET_CHUNK_DURATION_US = 7_000_000;  // ~7 seconds per chunk
const MAX_WORDS_PER_CHUNK       = 25;          // ~2-3 Hindi sentences

/**
 * Splits transcript segments into 2-3 sentence topic chunks (~5-7s each).
 * Handles large Sarvam segments (25s each) by splitting on sentence boundaries
 * and interpolating timestamps proportionally by word count.
 */
function splitIntoTopicChunks(segments) {
    if (!segments || segments.length === 0) return [];

    // First, explode each segment into sentence-level micro-segments
    // by splitting on sentence-ending punctuation and interpolating timestamps.
    const sentences = [];
    for (const seg of segments) {
        const text = (seg.text || '').trim();
        if (!text) continue;

        // Split on sentence boundaries (Hindi uses ।, English uses . ! ?)
        const parts = text.split(/(?<=[।.!?]\s)|(?<=\s{2,})/u)
            .map(p => p.trim()).filter(Boolean);

        if (parts.length <= 1) {
            sentences.push({ text, startUs: seg.startUs, endUs: seg.endUs });
            continue;
        }

        // Interpolate timestamps proportionally by character count
        const totalChars = text.length;
        let cursor = seg.startUs;
        for (const part of parts) {
            const fraction = part.length / totalChars;
            const durationUs = Math.round((seg.endUs - seg.startUs) * fraction);
            sentences.push({
                text: part,
                startUs: cursor,
                endUs: cursor + durationUs,
            });
            cursor += durationUs;
        }
    }

    // Now group sentences into chunks of MAX_WORDS_PER_CHUNK words or TARGET_CHUNK_DURATION_US
    const chunks = [];
    let current = [];
    let currentWords = 0;

    for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i];
        const wordCount = (s.text.match(/\S+/g) || []).length;
        current.push(s);
        currentWords += wordCount;

        const chunkDuration = current[current.length - 1].endUs - current[0].startUs;
        const isLast = i === sentences.length - 1;

        const shouldBreak =
            currentWords >= MAX_WORDS_PER_CHUNK ||
            chunkDuration >= TARGET_CHUNK_DURATION_US ||
            isLast;

        if (shouldBreak && current.length > 0) {
            chunks.push({
                index: chunks.length,
                startUs: current[0].startUs,
                endUs: current[current.length - 1].endUs,
                text: current.map(s => s.text).join(' '),
            });
            current = [];
            currentWords = 0;
        }
    }

    return chunks;
}

// ── Context Window Builder ────────────────────────────────────────────────────
// Returns ±2 minutes of surrounding transcript text for AI context.

const CONTEXT_WINDOW_US = 2 * 60 * 1_000_000; // 2 minutes each side

function buildContextWindow(allSegments, chunkStartUs, chunkEndUs) {
    const windowStart = chunkStartUs - CONTEXT_WINDOW_US;
    const windowEnd   = chunkEndUs   + CONTEXT_WINDOW_US;
    return allSegments
        .filter(s => s.endUs >= windowStart && s.startUs <= windowEnd)
        .map(s => s.text)
        .join(' ');
}

// ── Per-Chunk AI Analysis ─────────────────────────────────────────────────────

async function analyseChunkWithAI(chunk, allSegments, catalog, llmConfig, chunkTotal) {
    const contextText = buildContextWindow(allSegments, chunk.startUs, chunk.endUs);
    const durationSec = Math.round((chunk.endUs - chunk.startUs) / 1_000_000);

    // Pick 6 most relevant templates to keep prompt small
    const templateOptions = catalog.slice(0, 6).map(t => ({
        id: t.id, name: t.name, category: t.category,
    }));

    const prompt = `You are an expert video editor creating HIGH-RETENTION content for Indian YouTube audiences.

CURRENT CHUNK (${durationSec}s, chunk ${chunk.index + 1}/${chunkTotal}):
"${chunk.text}"

SURROUNDING CONTEXT (±2 min):
"${contextText.slice(0, 600)}"

AVAILABLE TEMPLATES:
${JSON.stringify(templateOptions, null, 1)}

TASK: Analyse this chunk and output a JSON decision. Be aggressive with cuts — remove anything repeated or filler.

Output ONLY raw JSON:
{
  "cut": false,
  "cutReason": "repetition|filler|tangent|off-topic|null",
  "template": {
    "templateId": "${templateOptions[0]?.id || ''}",
    "headline": "catchy 5-7 word Hindi/English headline from this chunk",
    "subline": "brief supporting stat or context (max 40 chars)"
  },
  "imageQuery": "descriptive English query for stock photo matching this topic",
  "videoQuery": "descriptive English query for B-roll video matching this topic",
  "overlayText": "key stat or quote to show on screen (max 8 words)"
}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await runLLMPrompt(llmConfig, prompt, 120_000);
            const result = extractJsonFromLLMOutput(response);

            // Validate and normalise
            return {
                chunkIndex: chunk.index,
                startUs: chunk.startUs,
                endUs: chunk.endUs,
                durationSec,
                text: chunk.text,
                cut: Boolean(result.cut),
                cutReason: result.cutReason || null,
                template: result.template || null,
                imageQuery: result.imageQuery || null,
                videoQuery: result.videoQuery || null,
                overlayText: result.overlayText || null,
                aiSource: `${llmConfig.provider}/${llmConfig.model}`,
            };
        } catch (e) {
            console.error(`[HR] Chunk ${chunk.index} attempt ${attempt} failed: ${e.message}`);
            if (attempt === 2) {
                // Heuristic fallback — keep chunk, assign first template
                return {
                    chunkIndex: chunk.index,
                    startUs: chunk.startUs,
                    endUs: chunk.endUs,
                    durationSec,
                    text: chunk.text,
                    cut: false,
                    cutReason: null,
                    template: catalog.length > 0 ? {
                        templateId: catalog[chunk.index % catalog.length].id,
                        headline: chunk.text.split(' ').slice(0, 6).join(' '),
                        subline: '',
                    } : null,
                    imageQuery: chunk.text.split(' ').slice(0, 5).join(' '),
                    videoQuery: null,
                    overlayText: null,
                    aiSource: 'heuristic',
                };
            }
        }
    }
}

// ── Density Enforcer ──────────────────────────────────────────────────────────
// Ensures something (template OR asset) happens every 5-7 seconds.
// If a gap > 7s has no overlay, inserts a simple text overlay from the transcript.

const MAX_GAP_US = 7_000_000; // 7 seconds

function enforceDensity(decisions, catalog) {
    const kept = decisions.filter(d => !d.cut);
    if (kept.length === 0) return decisions;

    const result = [...decisions];
    let lastOverlayEndUs = kept[0].startUs;

    for (const d of kept) {
        if (d.cut) continue;
        const gap = d.startUs - lastOverlayEndUs;

        if (gap > MAX_GAP_US && !d.template && !d.imageQuery) {
            // Force a simple overlay on this chunk
            const tmpl = catalog[d.chunkIndex % catalog.length];
            d.template = {
                templateId: tmpl?.id || '',
                headline: d.text.split(' ').slice(0, 6).join(' '),
                subline: '',
            };
            d.overlayText = d.text.split(' ').slice(0, 8).join(' ');
            d.densityForced = true;
        }

        if (d.template || d.imageQuery || d.videoQuery) {
            lastOverlayEndUs = d.endUs;
        }
    }

    return result;
}

// ── Template Catalog Discovery ────────────────────────────────────────────────

async function discoverTemplateCatalog() {
    const templateDirs = [
        path.join(ROOT_DIR, 'public', 'templates'),
        path.join(ROOT_DIR, 'src', 'assets', 'templates'),
        path.join(ROOT_DIR, 'desktop', 'templates'),
    ];

    const catalog = [];
    for (const dir of templateDirs) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const metaPath = path.join(dir, entry.name, 'meta.json');
                try {
                    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
                    catalog.push({
                        id: meta.id || entry.name,
                        name: meta.name || entry.name,
                        category: meta.category || 'general',
                        path: path.join(dir, entry.name),
                    });
                } catch {
                    catalog.push({
                        id: entry.name,
                        name: entry.name,
                        category: 'general',
                        path: path.join(dir, entry.name),
                    });
                }
            }
        } catch { /* dir doesn't exist */ }
    }

    // Fallback built-in catalog if no templates found on disk
    if (catalog.length === 0) {
        return [
            { id: 'breaking-news', name: 'Breaking Business News', category: 'news' },
            { id: 'earnings-report', name: 'Earnings Report', category: 'finance' },
            { id: 'ai-ml-update', name: 'AI / ML Update', category: 'tech' },
            { id: 'money-rain', name: 'Money Rain Number Impact', category: 'finance' },
            { id: 'ma-alert', name: 'M&A / Merger Alert', category: 'business' },
            { id: 'quote-card', name: 'Quote Card', category: 'quote' },
            { id: 'stat-reveal', name: 'Stat Reveal', category: 'stat' },
            { id: 'key-point', name: 'Key Point', category: 'highlight' },
        ];
    }

    return catalog;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const projectId = readArg('--project-id');
    if (!projectId) throw new Error('Missing --project-id');

    const projectDir = readArg('--project-dir') || path.resolve(ROOT_DIR, 'desktop', 'data', projectId);
    const transcriptPath = path.join(projectDir, 'transcript.json');
    const outputPath = path.join(projectDir, 'high-retention-plan.json');

    // Auto-detect best LLM only if not provided by user/frontend
    const requestedProvider = readArg('--llm-provider');
    const requestedModel = readArg('--llm-model');
    const autoLLM = requestedProvider ? null : await detectBestLLM();
    const llmProvider = requestedProvider || process.env.LAPAAS_LLM_PROVIDER || autoLLM?.provider || 'ollama';
    const llmModel = requestedModel || process.env.LAPAAS_LLM_MODEL || autoLLM?.model || 'qwen3:1.7b';
    const llmConfig = { provider: llmProvider, model: llmModel };

    console.error(`[HR] High-retention pipeline starting (${llmProvider}/${llmModel})`);

    // 1. Load transcript
    const transcript = JSON.parse(await fs.readFile(transcriptPath, 'utf8'));
    const segments = transcript.segments || [];
    const durationUs = segments.length > 0
        ? segments[segments.length - 1].endUs
        : 0;

    console.error(`[HR] Transcript: ${segments.length} segments, ${Math.round(durationUs / 1_000_000)}s`);

    // 2. Discover template catalog
    const catalog = await discoverTemplateCatalog();
    console.error(`[HR] Template catalog: ${catalog.length} templates`);

    // 3. Split into topic chunks
    const chunks = splitIntoTopicChunks(segments);
    console.error(`[HR] Split into ${chunks.length} topic chunks (avg ${Math.round(durationUs / 1_000_000 / chunks.length)}s each)`);

    // 4. Analyse each chunk with AI in parallel (concurrency=2 — Codex rate limit safe)
    console.error(`[HR] Analysing ${chunks.length} chunks with AI (parallel, concurrency=2)...`);
    // Concurrency=2 to stay within Codex rate limits (each call is a full session)
    const rawDecisions = await parallelMap(chunks, async (chunk) => {
        console.error(`[HR] Chunk ${chunk.index + 1}/${chunks.length}: "${chunk.text.slice(0, 60)}..."`);
        return analyseChunkWithAI(chunk, segments, catalog, llmConfig, chunks.length);
    }, 2);

    // 5. Enforce density — something every 5-7 seconds
    const decisions = enforceDensity(rawDecisions, catalog);

    // 6. Build summary stats
    const kept = decisions.filter(d => !d.cut);
    const cut  = decisions.filter(d => d.cut);
    const withTemplate = kept.filter(d => d.template);
    const withImage    = kept.filter(d => d.imageQuery);
    const withVideo    = kept.filter(d => d.videoQuery);
    const densityForced = kept.filter(d => d.densityForced);

    // 7. Build cut ranges for timeline
    const removeRanges = cut.map(d => ({
        startUs: d.startUs,
        endUs: d.endUs,
        reason: d.cutReason || 'ai-decision',
        confidence: 0.85,
    }));

    // 8. Build template placements
    const templatePlacements = withTemplate.map((d, i) => {
        const tmpl = catalog.find(t => t.id === d.template?.templateId) || catalog[i % catalog.length];
        return {
            id: `hr-tpl-${d.chunkIndex}`,
            templateId: tmpl.id,
            templateName: tmpl.name,
            category: tmpl.category,
            startUs: d.startUs,
            endUs: Math.min(d.endUs, d.startUs + 3_000_000), // show for max 3s
            content: {
                headline: d.template?.headline || d.text.split(' ').slice(0, 6).join(' '),
                subline: d.template?.subline || '',
            },
            overlayText: d.overlayText || null,
            aiReason: `chunk-${d.chunkIndex}`,
        };
    });

    // 9. Build asset suggestions
    const assetSuggestions = [];
    for (const d of kept) {
        if (d.imageQuery) {
            assetSuggestions.push({
                id: `hr-img-${d.chunkIndex}`,
                kind: 'image',
                query: d.imageQuery,
                startUs: d.startUs,
                endUs: d.endUs,
                aiReason: `chunk-${d.chunkIndex}`,
            });
        }
        if (d.videoQuery) {
            assetSuggestions.push({
                id: `hr-vid-${d.chunkIndex}`,
                kind: 'video',
                query: d.videoQuery,
                startUs: d.startUs,
                endUs: d.endUs,
                aiReason: `chunk-${d.chunkIndex}`,
            });
        }
    }

    // 10. Auto-download stock assets (images via Pexels, videos via Pixabay)
    const pexelsKey = process.env.PEXELS_API_KEY;
    const pixabayKey = process.env.PIXABAY_API_KEY;
    const fetchScript = path.join(ROOT_DIR, 'scripts', 'fetch_free_assets.mjs');

    const downloadableAssets = assetSuggestions.filter(a => {
        if (a.kind === 'image') return !!pexelsKey;
        if (a.kind === 'video') return !!(pixabayKey || pexelsKey);
        return false;
    });

    if (downloadableAssets.length > 0) {
        console.error(`[HR] Downloading ${downloadableAssets.length} assets (images→Pexels, videos→Pixabay, concurrency=4)...`);
        await parallelMap(downloadableAssets, async (asset) => {
            try {
                // Pick best provider per kind
                const provider = asset.kind === 'video'
                    ? (pixabayKey ? 'pixabay' : 'pexels')
                    : 'pexels';
                const { stdout } = await execFile('node', [
                    fetchScript,
                    '--project-id', projectId,
                    '--project-dir', projectDir,
                    '--query', asset.query,
                    '--kind', asset.kind,
                    '--provider', provider,
                ], {
                    env: { ...process.env },
                    timeout: 60_000,
                    maxBuffer: 2 * 1024 * 1024,
                });
                const result = JSON.parse(stdout.trim());
                if (result.ok && result.localPath) {
                    asset.localPath = result.localPath;
                    asset.creator = result.creator;
                    asset.license = result.license;
                    asset.provider = result.provider;
                    console.error(`[HR] ✓ ${asset.kind} (${result.provider}): ${path.basename(result.localPath)}`);
                }
            } catch (e) {
                console.error(`[HR] ✗ Asset download failed (${asset.query.slice(0, 40)}): ${e.message.slice(0, 80)}`);
            }
        }, 4);
        const downloaded = assetSuggestions.filter(a => a.localPath).length;
        console.error(`[HR] Assets downloaded: ${downloaded}/${downloadableAssets.length}`);
    } else {
        console.error('[HR] No API keys set (PEXELS_API_KEY / PIXABAY_API_KEY) — skipping asset download');
    }

    const plan = {
        ok: true,
        projectId,
        createdAt: new Date().toISOString(),
        llm: `${llmProvider}/${llmModel}`,
        stats: {
            totalChunks: chunks.length,
            keptChunks: kept.length,
            cutChunks: cut.length,
            withTemplate: withTemplate.length,
            withImage: withImage.length,
            withVideo: withVideo.length,
            densityForced: densityForced.length,
            avgChunkDurationSec: Math.round(durationUs / 1_000_000 / chunks.length),
        },
        removeRanges,
        templatePlacements,
        assetSuggestions,
        decisions,
    };

    await writeJson(outputPath, plan);

    console.error(`[HR] Done: ${kept.length} kept, ${cut.length} cut, ${withTemplate.length} templates, ${withImage.length} images, ${withVideo.length} videos`);
    process.stdout.write(JSON.stringify(plan, null, 2));
}

main().catch(e => {
    console.error('[HR] Fatal:', e.message);
    process.exitCode = 1;
});
