#!/usr/bin/env node

/**
 * Overlay Plan Chunk — AI-powered overlay planning for a single transcript chunk.
 *
 * Takes a chunk of transcript segments + template catalog and asks the LLM
 * to suggest overlay templates with content for that chunk.
 *
 * Usage:
 *   node scripts/overlay_plan_chunk.mjs \
 *     --project-id <id> \
 *     --chunk-index 0 \
 *     --chunk-start-us 0 \
 *     --chunk-end-us 60000000
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { runLLMPrompt, extractJsonFromLLMOutput, detectBestLLM } from './lib/llm_provider.mjs';

function readArg(flag, fallback = '') {
    const idx = process.argv.indexOf(flag);
    if (idx === -1) return fallback;
    return process.argv[idx + 1] ?? fallback;
}

async function fileExists(filePath) {
    try { await fs.access(filePath); return true; } catch { return false; }
}

// ── Template Catalog Discovery ──────────────────────────────────────────────

function extractStringField(source, fieldName) {
    const regex = new RegExp(`${fieldName}\\s*[:=]\\s*['"\`]([^'"\`]+)['"\`]`);
    const match = source.match(regex);
    return match ? match[1] : '';
}

function discoverTemplateMetaFromSource(rawSource, fallbackId, fallbackName, fallbackCategory) {
    const id = extractStringField(rawSource, 'id') || fallbackId;
    const name = extractStringField(rawSource, 'name') || fallbackName;
    const category = extractStringField(rawSource, 'category') || fallbackCategory;

    // Try to extract description from comments or description field
    const descMatch = rawSource.match(/description\s*[:=]\s*['"`]([^'"`]+)['"`]/);
    const description = descMatch ? descMatch[1] : '';

    // Extract prop field names for content schema
    const propsMatch = rawSource.match(/(?:Props|Schema)\s*=\s*z\.object\(\{([^}]+)\}/s);
    const fields = [];
    if (propsMatch) {
        const fieldMatches = propsMatch[1].matchAll(/(\w+)\s*:/g);
        for (const fm of fieldMatches) {
            fields.push(fm[1]);
        }
    }

    return { id, name, category, description, fields };
}

async function discoverTemplateCatalog() {
    const templatesRoot = path.resolve('src', 'templates');
    const registryPath = path.resolve('src', 'templates', 'registry.ts');

    if (!(await fileExists(templatesRoot))) {
        return [];
    }

    // Read registry to discover categories
    const registrySource = await fs.readFile(registryPath, 'utf8').catch(() => '');
    const categories = new Set();
    const categoryMatches = registrySource.matchAll(/category:\s*['"`]([^'"`]+)['"`]/g);
    for (const cm of categoryMatches) categories.add(cm[1]);

    // Scan template files
    const discovered = [];
    const seenIds = new Set();

    async function scanDir(dirPath, categoryName) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                await scanDir(fullPath, entry.name);
                continue;
            }
            if (!entry.name.endsWith('.tsx') || entry.name === 'registry.ts' || entry.name.startsWith('_')) continue;

            const source = await fs.readFile(fullPath, 'utf8').catch(() => '');
            const fallbackId = path.basename(entry.name, '.tsx').replace(/\s+/g, '-').toLowerCase();
            const meta = discoverTemplateMetaFromSource(source, fallbackId, fallbackId, categoryName);

            if (!meta.id || seenIds.has(meta.id)) continue;
            seenIds.add(meta.id);

            discovered.push({
                id: meta.id,
                name: meta.name,
                category: meta.category,
                description: meta.description || `${meta.category} template: ${meta.name}`,
                fields: meta.fields,
                source: path.relative(path.resolve('.'), fullPath),
            });
        }
    }

    await scanDir(templatesRoot, 'misc');
    discovered.sort((a, b) => a.id.localeCompare(b.id));
    return discovered;
}

// ── Chunk Splitting ─────────────────────────────────────────────────────────

function splitTranscriptIntoChunks(segments, maxChunkDurationUs = 60_000_000, maxSentences = 3) {
    const chunks = [];
    let currentChunk = [];
    let chunkStartUs = segments.length > 0 ? segments[0].startUs : 0;

    for (const seg of segments) {
        currentChunk.push(seg);
        const chunkDuration = seg.endUs - chunkStartUs;

        if (currentChunk.length >= maxSentences || chunkDuration >= maxChunkDurationUs) {
            chunks.push({
                index: chunks.length,
                startUs: chunkStartUs,
                endUs: seg.endUs,
                segments: [...currentChunk],
            });
            currentChunk = [];
            chunkStartUs = seg.endUs;
        }
    }

    // Remaining segments
    if (currentChunk.length > 0) {
        chunks.push({
            index: chunks.length,
            startUs: chunkStartUs,
            endUs: currentChunk[currentChunk.length - 1].endUs,
            segments: [...currentChunk],
        });
    }

    return chunks;
}

// ── LLM Overlay Planning ────────────────────────────────────────────────────

function truncateWords(text, maxWords = 8) {
    const words = String(text || '').trim().split(/\s+/);
    if (words.length <= maxWords) return words.join(' ');
    return words.slice(0, maxWords).join(' ') + '…';
}

async function generateOverlayPlanForChunk(chunkSegments, catalog, chunkStartUs, chunkEndUs, llmConfig) {
    const templateList = catalog.slice(0, 30).map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        description: t.description || '',
    }));

    const simplifiedSegments = chunkSegments.map(s => ({
        startUs: s.startUs,
        endUs: s.endUs,
        text: (s.text || '').slice(0, 200),
    }));

    const chunkDurationSec = Math.round((chunkEndUs - chunkStartUs) / 1_000_000);

    const prompt = `You are an expert video editor AI. Analyze this transcript chunk and suggest overlay templates.

Transcript chunk (${chunkDurationSec}s):
${JSON.stringify(simplifiedSegments, null, 1)}

Available templates:
${JSON.stringify(templateList, null, 1)}

Rules:
- Suggest 1-3 overlays for the most impactful moments in this chunk
- Match template style to content (e.g. "stat" for numbers, "quote" for key statements, "list" for enumerations)
- Generate a catchy **English** headline (max 8 words) from the transcript content
- Generate a brief **English** subline (max 50 chars)
- Each overlay should have a search query for a relevant background image/video
- All startUs/endUs must be within [${chunkStartUs}, ${chunkEndUs}]

Respond ONLY with this JSON (no markdown):
{
  "overlays": [
    {
      "templateId": "template-id-from-list",
      "startUs": ${chunkStartUs},
      "endUs": ${chunkStartUs + 2000000},
      "headline": "catchy headline",
      "subline": "supporting text",
      "assetQuery": "search query for background image",
      "assetKind": "image"
    }
  ]
}`;

    console.error(`[LLM] Planning overlays for chunk ${chunkStartUs / 1_000_000}s - ${chunkEndUs / 1_000_000}s...`);

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await runLLMPrompt(llmConfig, prompt, 120000);
            const result = extractJsonFromLLMOutput(response);
            const overlays = result.overlays || result.templatePlacements || [];

            if (!Array.isArray(overlays) || overlays.length === 0) {
                throw new Error('No overlays returned');
            }

            const catalogMap = new Map(catalog.map(t => [t.id, t]));

            return overlays.map((o, idx) => {
                const template = catalogMap.get(o.templateId) || catalog[idx % catalog.length];
                return {
                    id: `overlay-chunk-${o.startUs}-${idx}`,
                    templateId: template.id,
                    templateName: template.name,
                    category: template.category,
                    startUs: Math.max(chunkStartUs, Number(o.startUs || chunkStartUs)),
                    endUs: Math.min(chunkEndUs, Number(o.endUs || o.startUs + 2_000_000)),
                    content: {
                        headline: truncateWords(o.headline || 'Key moment', 8),
                        subline: String(o.subline || '').slice(0, 52) || `${template.category} template`,
                    },
                    assetQuery: o.assetQuery || o.headline || template.name,
                    assetKind: o.assetKind || 'image',
                    approved: false,
                };
            });
        } catch (e) {
            console.error(`[LLM] Overlay plan attempt ${attempt} failed:`, e.message);
            if (attempt === 2) throw e;
        }
    }
}

// ── Heuristic Fallback ──────────────────────────────────────────────────────

function buildHeuristicOverlays(chunkSegments, catalog, chunkStartUs, chunkEndUs) {
    const overlays = [];
    if (chunkSegments.length === 0 || catalog.length === 0) return overlays;

    // Pick the longest segment as the "key moment"
    const sorted = [...chunkSegments].sort((a, b) => (b.endUs - b.startUs) - (a.endUs - a.startUs));
    const keySeg = sorted[0];

    const templateCategories = ['quote', 'stat', 'title', 'list', 'callout'];
    const matchedTemplate = catalog.find(t => templateCategories.includes(t.category)) || catalog[0];

    const words = keySeg.text.split(/\s+/).slice(0, 6).join(' ');

    overlays.push({
        id: `overlay-heur-${chunkStartUs}`,
        templateId: matchedTemplate.id,
        templateName: matchedTemplate.name,
        category: matchedTemplate.category,
        startUs: keySeg.startUs,
        endUs: Math.min(keySeg.endUs, keySeg.startUs + 3_000_000),
        content: {
            headline: truncateWords(words, 6),
            subline: matchedTemplate.category + ' highlight',
        },
        assetQuery: words,
        assetKind: 'image',
        approved: false,
    });

    return overlays;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const projectId = readArg('--project-id');
    const chunkIndex = Number(readArg('--chunk-index', '0'));
    const chunkStartUs = Number(readArg('--chunk-start-us', '0'));
    const chunkEndUs = Number(readArg('--chunk-end-us', '60000000'));
    const mode = readArg('--mode', 'auto'); // auto, llm, heuristic
    // Priority: explicit arg → env override → auto-detect (Codex CLI → OpenAI → Google → Anthropic → Ollama)
    const argProvider = readArg('--llm-provider', '');
    const argModel = readArg('--llm-model', '');
    const autoConfig = (argProvider || argModel) ? null : await detectBestLLM();
    const llmProvider = argProvider || autoConfig?.provider || 'ollama';
    const llmModel = argModel || autoConfig?.model || 'qwen3:1.7b';

    if (!projectId) throw new Error('Missing --project-id');

    const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
    const transcriptPath = path.join(projectDir, 'transcript.json');

    // 1. Read transcript
    let transcript;
    try {
        transcript = JSON.parse(await fs.readFile(transcriptPath, 'utf8'));
    } catch (e) {
        throw new Error(`Cannot read transcript: ${e.message}`);
    }

    // 2. Get chunk segments
    const allSegments = transcript.segments || [];
    const chunkSegments = allSegments.filter(s => s.startUs >= chunkStartUs && s.startUs < chunkEndUs);

    if (chunkSegments.length === 0) {
        process.stdout.write(JSON.stringify({ ok: true, chunkIndex, overlays: [], message: 'No segments in this chunk range' }, null, 2) + '\n');
        return;
    }

    // 3. Discover template catalog
    console.error('[OverlayPlan] Discovering template catalog...');
    const catalog = await discoverTemplateCatalog();
    console.error(`[OverlayPlan] Found ${catalog.length} templates`);

    // 4. Generate overlay plan
    let overlays;
    const llmConfig = { provider: llmProvider, model: llmModel };

    if (mode === 'heuristic') {
        overlays = buildHeuristicOverlays(chunkSegments, catalog, chunkStartUs, chunkEndUs);
    } else {
        try {
            overlays = await generateOverlayPlanForChunk(chunkSegments, catalog, chunkStartUs, chunkEndUs, llmConfig);
        } catch (e) {
            console.error('[OverlayPlan] LLM failed, using heuristic fallback:', e.message);
            overlays = buildHeuristicOverlays(chunkSegments, catalog, chunkStartUs, chunkEndUs);
        }
    }

    // 5. Save chunk overlay plan
    const overlayDir = path.join(projectDir, 'overlays');
    await fs.mkdir(overlayDir, { recursive: true });
    const chunkFile = path.join(overlayDir, `chunk-${chunkIndex}.json`);
    await fs.writeFile(chunkFile, JSON.stringify({ chunkIndex, chunkStartUs, chunkEndUs, overlays }, null, 2) + '\n', 'utf8');

    // 6. Output
    process.stdout.write(JSON.stringify({
        ok: true,
        chunkIndex,
        chunkStartUs,
        chunkEndUs,
        segmentCount: chunkSegments.length,
        overlayCount: overlays.length,
        overlays,
        catalog: catalog.slice(0, 10).map(t => ({ id: t.id, name: t.name, category: t.category })),
    }, null, 2) + '\n');
}

main().catch(e => { process.stderr.write(`${e.message}\n`); process.exit(1); });
