#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { createStageTracker, recordProjectTelemetry } from './lib/pipeline_telemetry.mjs';
import {
  validateAssetSuggestions,
  validateTemplatePlacements,
  validateTemplatePlan,
} from './lib/pipeline_schema.mjs';

function readArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function readBooleanArg(flag, fallback = true) {
  const raw = readArg(flag, fallback ? 'true' : 'false');
  const normalized = String(raw || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized !== 'false' && normalized !== '0' && normalized !== 'no';
}

function safeInteger(input, fallback, minimum = 0, maximum = 20) {
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, Math.round(numeric)));
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(label, maxRetries, retryDelayMs, runAction, onRetry = null) {
  const totalAttempts = Math.max(1, maxRetries + 1);
  let lastError = null;
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      return await runAction(attempt, totalAttempts);
    } catch (error) {
      lastError = error;
      if (attempt >= totalAttempts) {
        break;
      }
      if (onRetry) {
        onRetry({
          label,
          attempt,
          totalAttempts,
          error: String(error?.message || error),
        });
      }
      await sleep(retryDelayMs * attempt);
    }
  }
  throw lastError;
}

function safeFallbackPolicy(input) {
  const normalized = String(input || '').trim().toLowerCase();
  if (
    normalized === 'local-first' ||
    normalized === 'api-first' ||
    normalized === 'local-only' ||
    normalized === 'api-only'
  ) {
    return normalized;
  }
  return 'local-first';
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function writeText(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function hasGlobalFetch() {
  return typeof fetch === 'function';
}

async function fetchJson(url, options = {}) {
  if (!hasGlobalFetch()) {
    throw new Error('Global fetch is not available in current Node runtime.');
  }
  const controller = new AbortController();
  const timeoutMs = 25_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Lapaas-AI-Editor/0.1',
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function downloadToFile(url, filePath) {
  if (!hasGlobalFetch()) {
    throw new Error('Global fetch is not available in current Node runtime.');
  }
  const controller = new AbortController();
  const timeoutMs = 45_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Lapaas-AI-Editor/0.1',
      },
    });
    if (!response.ok) {
      throw new Error(`Asset download failed with HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    return filePath;
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonIfExists(filePath, fallback = null) {
  try {
    return await readJson(filePath);
  } catch {
    return fallback;
  }
}

function sanitizeFilePart(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function extensionFromUrl(url, fallback = '.bin') {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (!ext) return fallback;
    if (ext.length > 6) return fallback;
    return ext;
  } catch {
    return fallback;
  }
}

function providerApiKey(provider) {
  const key = String(provider || '').toLowerCase();
  if (key === 'pexels') {
    return process.env.PEXELS_API_KEY || process.env.LAPAAS_PEXELS_API_KEY || '';
  }
  if (key === 'pixabay') {
    return process.env.PIXABAY_API_KEY || process.env.LAPAAS_PIXABAY_API_KEY || '';
  }
  if (key === 'unsplash') {
    return process.env.UNSPLASH_ACCESS_KEY || process.env.LAPAAS_UNSPLASH_ACCESS_KEY || '';
  }
  return '';
}

function buildStockCacheKey(asset) {
  return [asset.provider, asset.kind, String(asset.query || '').trim().toLowerCase()].join('|');
}

async function listFilesRecursive(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function truncateWords(text, maxWords = 8) {
  const tokens = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length <= maxWords) {
    return tokens.join(' ');
  }
  return `${tokens.slice(0, maxWords).join(' ')}...`;
}

function hashSeed(input) {
  let hash = 2166136261;
  const text = String(input || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function colorFromSeed(seed) {
  const base = hashSeed(seed);
  const r = 70 + (base % 140);
  const g = 70 + ((base >> 8) % 140);
  const b = 70 + ((base >> 16) % 140);
  return { r, g, b };
}

function mixColor(a, b, ratio) {
  return {
    r: Math.round(a.r + (b.r - a.r) * ratio),
    g: Math.round(a.g + (b.g - a.g) * ratio),
    b: Math.round(a.b + (b.b - a.b) * ratio),
  };
}

function buildPpmGradient(width, height, startColor, endColor) {
  const lines = ['P3', `${width} ${height}`, '255'];
  for (let y = 0; y < height; y += 1) {
    const rowRatio = height <= 1 ? 0 : y / (height - 1);
    const rowColor = mixColor(startColor, endColor, rowRatio);
    const row = [];
    for (let x = 0; x < width; x += 1) {
      row.push(`${rowColor.r} ${rowColor.g} ${rowColor.b}`);
    }
    lines.push(row.join(' '));
  }
  return `${lines.join('\n')}\n`;
}

function providerAccent(provider) {
  const key = String(provider || '').toLowerCase();
  if (key === 'pexels') return { r: 55, g: 130, b: 245 };
  if (key === 'pixabay') return { r: 244, g: 147, b: 42 };
  if (key === 'unsplash') return { r: 67, g: 195, b: 116 };
  return { r: 120, g: 120, b: 120 };
}

function fallbackTemplates() {
  return [
    { id: 'social-hooks-headline', name: 'Headline Hook', category: 'social-hooks', source: 'fallback' },
    { id: 'lower-third-minimal', name: 'Lower Third Minimal', category: 'lower-thirds', source: 'fallback' },
    { id: 'text-animation-gradient', name: 'Gradient Text', category: 'text-animation', source: 'fallback' },
    { id: 'startup-showcase-bold', name: 'Bold Pitch', category: 'startup-showcase', source: 'fallback' },
  ];
}

function extractStringField(source, fieldName) {
  const regex = new RegExp(`\\b${fieldName}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`);
  const match = source.match(regex);
  return String(match?.[1] || '').trim();
}

function parseRegistryCategories(registrySource) {
  const blockMatch = String(registrySource || '').match(
    /export\s+const\s+TEMPLATE_CATEGORIES\s*=\s*\[([\s\S]*?)\]\s*as\s+const/,
  );
  if (!blockMatch) {
    return new Set();
  }
  const values = [...blockMatch[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((match) => String(match[1] || '').trim());
  return new Set(values.filter(Boolean));
}

function discoverTemplateMetaFromTemplateSource(rawSource, fallbackId, fallbackName, fallbackCategory) {
  const source = String(rawSource || '');
  const registerMatch = source.match(/registerTemplate\s*\(\s*\{([\s\S]*?)\}\s*\)\s*;/m);
  const body = registerMatch ? registerMatch[1] : source;

  const id = extractStringField(body, 'id') || fallbackId;
  const name = extractStringField(body, 'name') || fallbackName;
  const category = extractStringField(body, 'category') || fallbackCategory || 'misc';
  return {
    id,
    name,
    category,
  };
}

async function discoverTemplateCatalogByFileScan(templatesRoot) {
  const files = await listFilesRecursive(templatesRoot);
  const tsxFiles = files.filter((filePath) => filePath.endsWith('.tsx'));
  const discovered = [];
  const seen = new Set();

  for (const filePath of tsxFiles) {
    const rel = path.relative(templatesRoot, filePath);
    const [category = 'misc'] = rel.split(path.sep);
    const source = `src/templates/${rel.split(path.sep).join('/')}`;
    const raw = await fs.readFile(filePath, 'utf8');
    const idMatch = raw.match(/\bid:\s*['"`]([^'"`]+)['"`]/);
    const nameMatch = raw.match(/\bname:\s*['"`]([^'"`]+)['"`]/);
    const fallbackId = path.basename(filePath, '.tsx').replace(/\s+/g, '-').toLowerCase();
    const id = (idMatch?.[1] || fallbackId).trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    discovered.push({
      id,
      name: (nameMatch?.[1] || fallbackId).trim(),
      category,
      source,
    });
  }

  if (discovered.length === 0) {
    return fallbackTemplates();
  }

  discovered.sort((a, b) => a.id.localeCompare(b.id));
  return discovered;
}

async function discoverTemplateCatalog() {
  const templatesRoot = path.resolve('src', 'templates');
  const rootPath = path.resolve('src', 'Root.tsx');
  const registryPath = path.resolve('src', 'templates', 'registry.ts');

  if (!(await exists(templatesRoot))) {
    return fallbackTemplates();
  }

  const categories = parseRegistryCategories(await fs.readFile(registryPath, 'utf8').catch(() => ''));
  const rootSource = await fs.readFile(rootPath, 'utf8').catch(() => '');
  const importMatches = [...rootSource.matchAll(/import\s+['"]\.\/templates\/([^'"]+)['"]\s*;/g)];

  if (importMatches.length === 0) {
    return discoverTemplateCatalogByFileScan(templatesRoot);
  }

  const discovered = [];
  const seenTemplateIds = new Set();
  const seenTemplateFiles = new Set();

  for (const match of importMatches) {
    const importRef = String(match?.[1] || '').trim();
    if (!importRef || seenTemplateFiles.has(importRef)) {
      continue;
    }
    seenTemplateFiles.add(importRef);

    const rel = importRef.endsWith('.tsx') ? importRef : `${importRef}.tsx`;
    const filePath = path.resolve('src', 'templates', rel);
    if (!(await exists(filePath))) {
      continue;
    }

    const templateSource = await fs.readFile(filePath, 'utf8');
    const fallbackId = path.basename(rel, '.tsx').replace(/\s+/g, '-').toLowerCase();
    const fallbackName = fallbackId;
    const fallbackCategory = rel.split('/')[0] || 'misc';

    const parsed = discoverTemplateMetaFromTemplateSource(
      templateSource,
      fallbackId,
      fallbackName,
      fallbackCategory,
    );
    if (!parsed.id || seenTemplateIds.has(parsed.id)) {
      continue;
    }
    seenTemplateIds.add(parsed.id);

    discovered.push({
      id: parsed.id,
      name: parsed.name,
      category: categories.has(parsed.category) ? parsed.category : fallbackCategory,
      source: `src/templates/${rel.split(path.sep).join('/')}`,
    });
  }

  if (discovered.length === 0) {
    const scanned = await discoverTemplateCatalogByFileScan(templatesRoot);
    return scanned.length > 0 ? scanned : fallbackTemplates();
  }

  discovered.sort((a, b) => a.id.localeCompare(b.id));
  return discovered;
}

function ensureTracks(tracks) {
  const normalized = Array.isArray(tracks) ? [...tracks] : [];
  const trackIds = new Set(normalized.map((track) => track?.id).filter(Boolean));

  if (!trackIds.has('track-template-overlay')) {
    normalized.push({
      id: 'track-template-overlay',
      name: 'Template Overlay',
      kind: 'template',
      order: normalized.length,
      locked: false,
    });
  }

  if (!trackIds.has('track-broll')) {
    normalized.push({
      id: 'track-broll',
      name: 'B-roll / Assets',
      kind: 'video',
      order: normalized.length,
      locked: false,
    });
  }

  return normalized.map((track, index) => ({
    ...track,
    order: index,
  }));
}

function createFallbackTimeline(projectId, durationUs, fps, sourceRef) {
  const now = new Date().toISOString();
  return {
    id: `timeline-${Date.now()}`,
    projectId,
    version: 1,
    status: 'ROUGH_CUT_READY',
    fps,
    durationUs,
    createdAt: now,
    updatedAt: now,
    tracks: [
      { id: 'track-video-main', name: 'Main Video', kind: 'video', order: 0, locked: false },
      { id: 'track-captions', name: 'Captions', kind: 'caption', order: 1, locked: false },
    ],
    clips: [
      {
        clipId: 'clip-1',
        trackId: 'track-video-main',
        clipType: 'source_clip',
        startUs: 0,
        endUs: durationUs,
        sourceStartUs: 0,
        sourceEndUs: durationUs,
        sourceRef,
        effects: {},
        transform: {},
        meta: {
          generatedBy: 'fallback-timeline',
        },
      },
    ],
  };
}

function buildTemplatePlacements(segments, templates, durationUs) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }
  if (!Array.isArray(templates) || templates.length === 0) {
    return [];
  }

  const targetCount = Math.min(6, Math.max(2, Math.ceil(segments.length / 2)));
  const stride = Math.max(1, Math.floor(segments.length / targetCount));
  const placements = [];

  for (let index = 0; index < targetCount; index += 1) {
    const segment = segments[Math.min(segments.length - 1, index * stride)];
    const template = templates[index % templates.length];
    const startUs = Math.max(0, Number(segment.startUs || 0));
    const maxSegmentEnd = Math.max(startUs + 400_000, Number(segment.endUs || startUs + 1_500_000));
    const endUs = Math.min(durationUs, Math.min(maxSegmentEnd, startUs + 2_400_000));
    if (endUs <= startUs) {
      continue;
    }
    const headline = truncateWords(segment.text || 'Generated template line', 8);
    const subline = `${template.category} template`;
    placements.push({
      id: `tpl-placement-${index + 1}`,
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      startUs,
      endUs,
      confidence: Number((0.58 + index * 0.04).toFixed(2)),
      content: {
        headline,
        subline,
      },
    });
  }

  return placements;
}

function buildAssetSuggestions(templatePlacements) {
  const providers = ['pexels', 'pixabay', 'unsplash'];
  const suggestions = [];
  for (let index = 0; index < templatePlacements.length; index += 1) {
    if (index % 2 !== 0) {
      continue;
    }
    const placement = templatePlacements[index];
    const provider = providers[index % providers.length];
    const query = placement.content.headline.replace(/\.\.\.$/, '');
    suggestions.push({
      id: `asset-${index + 1}`,
      provider,
      kind: index % 4 === 0 ? 'video' : 'image',
      query,
      startUs: placement.startUs,
      endUs: placement.endUs,
      effects: {
        zoom: {
          type: 'ken-burns',
          scaleFrom: 1,
          scaleTo: 1.08,
          anchor: 'center',
        },
      },
      attribution: {
        required: true,
        source: provider,
      },
    });
  }
  return suggestions;
}

// ── LLM AI helpers (unified provider) ────────────────────────────────────────

import os from 'node:os';
import { promisify } from 'node:util';
import { runLLMPrompt, extractJsonFromLLMOutput, detectBestLLM } from './lib/llm_provider.mjs';

async function generateTemplatePlanWithOllama(segments, catalog, durationUs, llmConfig) {
  const templateList = catalog.map(t => ({ id: t.id, name: t.name, category: t.category }));
  const simplifiedSegments = segments.slice(0, 20).map(s => ({
    startUs: s.startUs,
    endUs: s.endUs,
    text: (s.text || '').slice(0, 120)
  }));

  const prompt = `You are an expert video editor AI specializing in Hindi/Hinglish content. Analyze this transcript and pick the BEST templates for key moments.

Transcript segments:
${JSON.stringify(simplifiedSegments, null, 1)}

Available templates:
${JSON.stringify(templateList, null, 1)}

Total video duration: ${Math.round(durationUs / 1_000_000)}s

Rules:
- Pick 2-6 templates for the most impactful moments
- Match template style to content (e.g. "stat" for numbers, "quote" for key statements)
- Generate a catchy Hindi/English headline (max 8 words) from the transcript content
- Generate a brief subline (max 50 chars)
- Space templates at least 3 seconds apart

Respond ONLY with this JSON (no markdown):
{
  "templatePlacements": [
    {
      "templateId": "template-id-from-catalog",
      "startUs": 0,
      "endUs": 2000000,
      "headline": "catchy headline from content",
      "subline": "brief supporting text",
      "reason": "why this template fits here"
    }
  ]
}`;

  console.error(`[LLM] Generating AI template plan with ${llmConfig.provider}/${llmConfig.model}...`);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await runLLMPrompt(llmConfig, prompt, 180000);
      const result = extractJsonFromLLMOutput(response);
      const placements = result.templatePlacements || result;

      if (!Array.isArray(placements) || placements.length === 0) {
        throw new Error('No template placements returned');
      }

      const catalogMap = new Map(catalog.map(t => [t.id, t]));

      return placements.map((p, idx) => {
        const template = catalogMap.get(p.templateId) || catalog[idx % catalog.length];
        return {
          id: `tpl-placement-${idx + 1}`,
          templateId: template.id,
          templateName: template.name,
          category: template.category,
          startUs: Math.max(0, Number(p.startUs || 0)),
          endUs: Math.min(durationUs, Number(p.endUs || p.startUs + 2_000_000)),
          confidence: 0.85,
          content: {
            headline: truncateWords(p.headline || p.text || 'Key moment', 8),
            subline: truncateChars(p.subline || `${template.category} template`, 52),
          },
          aiReason: p.reason || 'AI-selected',
        };
      });
    } catch (e) {
      console.error(`[Ollama] Template plan attempt ${attempt}:`, e.message);
      if (attempt === 2) throw e;
    }
  }
}

async function generateStockSuggestionsWithOllama(segments, templatePlacements, llmConfig) {
  const simplifiedSegments = segments.slice(0, 15).map(s => ({
    startUs: s.startUs,
    endUs: s.endUs,
    text: (s.text || '').slice(0, 100)
  }));

  const prompt = `You are a video editor AI. Based on these Hindi/Hinglish transcript segments, suggest stock images/videos to use as B-roll.

Transcript:
${JSON.stringify(simplifiedSegments, null, 1)}

Rules:
- Suggest 2-5 stock media items
- For each, provide an ENGLISH search query (stock sites use English)
- Pick "image" for static concepts, "video" for dynamic/action
- Queries should be visual and descriptive (e.g. "indian entrepreneur working laptop" not "business")
- Match the media to what's being discussed in the transcript

Respond ONLY with JSON (no markdown):
{
  "suggestions": [
    {
      "query": "english search query for stock media",
      "kind": "image or video",
      "startUs": 0,
      "endUs": 2000000,
      "reason": "why this visual fits the content"
    }
  ]
}`;

  console.error(`[LLM] Generating AI stock media suggestions with ${llmConfig.provider}/${llmConfig.model}...`);

  try {
    const response = await runLLMPrompt(llmConfig, prompt, 120000);
    const result = extractJsonFromLLMOutput(response);
    const suggestions = result.suggestions || result;

    if (!Array.isArray(suggestions)) return [];

    const providers = ['pexels', 'pixabay', 'unsplash'];
    return suggestions.map((s, idx) => ({
      id: `asset-${idx + 1}`,
      provider: providers[idx % providers.length],
      kind: s.kind === 'video' ? 'video' : 'image',
      query: s.query || 'stock footage',
      startUs: Math.max(0, Number(s.startUs || 0)),
      endUs: Math.max(Number(s.startUs || 0) + 500_000, Number(s.endUs || 0)),
      effects: {
        zoom: { type: 'ken-burns', scaleFrom: 1, scaleTo: 1.08, anchor: 'center' },
      },
      attribution: { required: true, source: providers[idx % providers.length] },
      aiReason: s.reason || 'AI-suggested',
    }));
  } catch (e) {
    console.error('[Ollama] Stock suggestion failed:', e.message);
    return [];
  }
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, numeric));
}

function truncateChars(text, maxChars) {
  const source = String(text || '').trim();
  if (source.length <= maxChars) {
    return source;
  }
  return `${source.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function enforceTemplatePlacementConstraints(rawPlacements, durationUs) {
  const MIN_TEMPLATE_DURATION_US = 450_000;
  const MAX_TEMPLATE_DURATION_US = 2_400_000;
  const MIN_TEMPLATE_GAP_US = 120_000;
  const MAX_HEADLINE_WORDS = 8;
  const MAX_SUBLINE_CHARS = 52;

  const sorted = [...(rawPlacements || [])].sort((a, b) => Number(a.startUs || 0) - Number(b.startUs || 0));
  const placements = [];
  const warnings = [];
  let cursorUs = 0;

  for (const placement of sorted) {
    const id = String(placement?.id || `tpl-placement-${placements.length + 1}`);
    const originalStartUs = Number(placement?.startUs || 0);
    const originalEndUs = Number(placement?.endUs || 0);

    let startUs = clampNumber(originalStartUs, 0, Math.max(0, durationUs - MIN_TEMPLATE_DURATION_US));
    if (startUs < cursorUs) {
      warnings.push({
        code: 'template_overlap_adjusted',
        severity: 'warning',
        placementId: id,
        message: `Adjusted template start time from ${startUs} to ${cursorUs} to avoid overlap.`,
      });
      startUs = cursorUs;
    }

    const desiredDurationUs = clampNumber(
      Math.max(MIN_TEMPLATE_DURATION_US, originalEndUs - originalStartUs),
      MIN_TEMPLATE_DURATION_US,
      MAX_TEMPLATE_DURATION_US,
    );
    let endUs = Math.min(durationUs, startUs + desiredDurationUs);
    if (endUs - startUs < MIN_TEMPLATE_DURATION_US) {
      if (startUs + MIN_TEMPLATE_DURATION_US > durationUs) {
        warnings.push({
          code: 'template_skipped_out_of_bounds',
          severity: 'warning',
          placementId: id,
          message: 'Skipped template placement because it does not fit inside source duration.',
        });
        continue;
      }
      endUs = startUs + MIN_TEMPLATE_DURATION_US;
    }

    const originalHeadline = String(placement?.content?.headline || '').trim();
    const originalSubline = String(placement?.content?.subline || '').trim();
    const headline = truncateWords(originalHeadline || 'Generated template line', MAX_HEADLINE_WORDS);
    const subline = truncateChars(originalSubline || 'Template', MAX_SUBLINE_CHARS);

    if (headline !== originalHeadline) {
      warnings.push({
        code: 'template_headline_truncated',
        severity: 'info',
        placementId: id,
        message: 'Template headline truncated to meet max word count.',
      });
    }

    if (subline !== originalSubline) {
      warnings.push({
        code: 'template_subline_truncated',
        severity: 'info',
        placementId: id,
        message: 'Template subline truncated to meet max character count.',
      });
    }

    placements.push({
      ...placement,
      id,
      startUs,
      endUs,
      content: {
        headline,
        subline,
      },
      constraints: {
        minDurationUs: MIN_TEMPLATE_DURATION_US,
        maxDurationUs: MAX_TEMPLATE_DURATION_US,
        minGapUs: MIN_TEMPLATE_GAP_US,
        maxHeadlineWords: MAX_HEADLINE_WORDS,
        maxSublineChars: MAX_SUBLINE_CHARS,
      },
    });

    cursorUs = endUs + MIN_TEMPLATE_GAP_US;
  }

  return {
    placements,
    warnings,
    constraints: {
      minDurationUs: MIN_TEMPLATE_DURATION_US,
      maxDurationUs: MAX_TEMPLATE_DURATION_US,
      minGapUs: MIN_TEMPLATE_GAP_US,
      maxHeadlineWords: MAX_HEADLINE_WORDS,
      maxSublineChars: MAX_SUBLINE_CHARS,
    },
  };
}

function buildValidationWarnings({ templatePlacements, assetSuggestions, durationUs }) {
  const warnings = [];

  const sortedTemplates = [...(templatePlacements || [])].sort(
    (a, b) => Number(a.startUs || 0) - Number(b.startUs || 0),
  );
  for (let index = 0; index < sortedTemplates.length; index += 1) {
    const current = sortedTemplates[index];
    const currentStartUs = Number(current.startUs || 0);
    const currentEndUs = Number(current.endUs || 0);

    if (currentStartUs < 0 || currentEndUs > durationUs || currentEndUs <= currentStartUs) {
      warnings.push({
        code: 'template_invalid_bounds',
        severity: 'error',
        placementId: current.id,
        message: `Template placement has invalid bounds (${currentStartUs}-${currentEndUs}).`,
      });
    }

    if (index > 0) {
      const previous = sortedTemplates[index - 1];
      if (currentStartUs < Number(previous.endUs || 0)) {
        warnings.push({
          code: 'template_overlap_remaining',
          severity: 'error',
          placementId: current.id,
          message: 'Template placement still overlaps with previous template after constraint pass.',
        });
      }
    }
  }

  for (const asset of assetSuggestions || []) {
    const status = String(asset?.media?.status || 'unknown');
    if (status === 'downloaded' || status === 'cached') {
      continue;
    }
    warnings.push({
      code: 'asset_media_unavailable',
      severity: status === 'fetch_failed' ? 'warning' : 'info',
      assetId: asset.id,
      provider: asset.provider,
      message: `Asset ${asset.id} is using placeholder media (status: ${status}).`,
      detail: String(asset?.media?.error || ''),
    });
  }

  return warnings;
}

function buildAiDecisionSummary(templatePlacements, resolvedAssetSuggestions) {
  return {
    templateAssignments: (templatePlacements || []).map((placement) => ({
      placementId: placement.id,
      templateId: placement.templateId,
      category: placement.category,
      startUs: placement.startUs,
      endUs: placement.endUs,
      confidence: placement.confidence,
      headline: placement?.content?.headline || '',
    })),
    assetAssignments: (resolvedAssetSuggestions || []).map((asset) => ({
      assetId: asset.id,
      provider: asset.provider,
      kind: asset.kind,
      query: asset.query,
      startUs: asset.startUs,
      endUs: asset.endUs,
      mediaStatus: asset?.media?.status || 'unknown',
    })),
  };
}

async function searchPexels(asset, apiKey) {
  const query = encodeURIComponent(asset.query || 'business');
  if (asset.kind === 'video') {
    const url = `https://api.pexels.com/videos/search?query=${query}&per_page=1&orientation=landscape`;
    const data = await fetchJson(url, {
      headers: { Authorization: apiKey },
    });
    const item = Array.isArray(data?.videos) ? data.videos[0] : null;
    if (!item) throw new Error('No Pexels video result');
    const files = Array.isArray(item.video_files) ? item.video_files : [];
    const picked =
      files.find((file) => Number(file.width || 0) >= 640 && Number(file.width || 0) <= 1920) ||
      files[0];
    if (!picked?.link) throw new Error('Pexels video file link missing');
    return {
      providerAssetId: String(item.id || ''),
      downloadUrl: picked.link,
      pageUrl: String(item.url || ''),
      creatorName: String(item?.user?.name || ''),
      creatorUrl: String(item?.user?.url || ''),
      license: 'Pexels License',
    };
  }

  const url = `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`;
  const data = await fetchJson(url, {
    headers: { Authorization: apiKey },
  });
  const item = Array.isArray(data?.photos) ? data.photos[0] : null;
  if (!item) throw new Error('No Pexels image result');
  const src = item?.src || {};
  const downloadUrl = src.large2x || src.large || src.original || src.medium;
  if (!downloadUrl) throw new Error('Pexels image URL missing');
  return {
    providerAssetId: String(item.id || ''),
    downloadUrl,
    pageUrl: String(item.url || ''),
    creatorName: String(item.photographer || ''),
    creatorUrl: String(item.photographer_url || ''),
    license: 'Pexels License',
  };
}

async function searchPixabay(asset, apiKey) {
  const query = encodeURIComponent(asset.query || 'business');
  if (asset.kind === 'video') {
    const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${query}&per_page=3&safesearch=true`;
    const data = await fetchJson(url);
    const item = Array.isArray(data?.hits) ? data.hits[0] : null;
    if (!item) throw new Error('No Pixabay video result');
    const variants = item.videos || {};
    const picked = variants.medium || variants.small || variants.tiny || variants.large || null;
    const downloadUrl = picked?.url || '';
    if (!downloadUrl) throw new Error('Pixabay video URL missing');
    return {
      providerAssetId: String(item.id || ''),
      downloadUrl,
      pageUrl: String(item.pageURL || ''),
      creatorName: String(item.user || ''),
      creatorUrl: '',
      license: 'Pixabay License',
    };
  }

  const url = `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${query}&image_type=photo&per_page=3&safesearch=true`;
  const data = await fetchJson(url);
  const item = Array.isArray(data?.hits) ? data.hits[0] : null;
  if (!item) throw new Error('No Pixabay image result');
  const downloadUrl = item.largeImageURL || item.webformatURL || '';
  if (!downloadUrl) throw new Error('Pixabay image URL missing');
  return {
    providerAssetId: String(item.id || ''),
    downloadUrl,
    pageUrl: String(item.pageURL || ''),
    creatorName: String(item.user || ''),
    creatorUrl: '',
    license: 'Pixabay License',
  };
}

async function searchUnsplash(asset, apiKey) {
  if (asset.kind === 'video') {
    throw new Error('Unsplash video search not supported in this adapter');
  }

  const query = encodeURIComponent(asset.query || 'business');
  const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`;
  const data = await fetchJson(url, {
    headers: { Authorization: `Client-ID ${apiKey}` },
  });
  const item = Array.isArray(data?.results) ? data.results[0] : null;
  if (!item) throw new Error('No Unsplash image result');
  const urls = item?.urls || {};
  const user = item?.user || {};
  const links = item?.links || {};
  const downloadUrl = urls.regular || urls.full || urls.small || '';
  if (!downloadUrl) throw new Error('Unsplash image URL missing');
  return {
    providerAssetId: String(item.id || ''),
    downloadUrl,
    pageUrl: String(links.html || ''),
    creatorName: String(user.name || ''),
    creatorUrl: String(user.links?.html || ''),
    license: 'Unsplash License',
  };
}

async function searchProviderAsset(asset, apiKey) {
  const provider = String(asset.provider || '').toLowerCase();
  if (provider === 'pexels') {
    return searchPexels(asset, apiKey);
  }
  if (provider === 'pixabay') {
    return searchPixabay(asset, apiKey);
  }
  if (provider === 'unsplash') {
    return searchUnsplash(asset, apiKey);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

async function resolveExternalMediaForAssets(
  projectDir,
  assetSuggestions,
  fetchExternal,
  { maxRetries = 1, retryDelayMs = 1000 } = {},
) {
  const cacheDir = path.join(projectDir, 'stock-cache');
  const cacheIndexPath = path.join(cacheDir, 'index.json');
  const cacheIndex = (await readJsonIfExists(cacheIndexPath, {})) || {};
  const retryEvents = [];

  const enriched = [];
  for (const asset of assetSuggestions) {
    const provider = String(asset.provider || '').toLowerCase();
    const key = buildStockCacheKey(asset);
    const existing = cacheIndex[key];

    if (existing?.localPath && (await exists(existing.localPath))) {
      enriched.push({
        ...asset,
        media: {
          status: 'cached',
          localPath: existing.localPath,
          attribution: existing.attribution || null,
          license: existing.license || '',
          providerAssetId: existing.providerAssetId || '',
          error: '',
        },
      });
      continue;
    }

    if (!fetchExternal) {
      enriched.push({
        ...asset,
        media: {
          status: 'skipped',
          localPath: '',
          attribution: null,
          license: '',
          providerAssetId: '',
          error: 'External media fetch disabled.',
        },
      });
      continue;
    }

    const apiKey = providerApiKey(provider);
    if (!apiKey) {
      enriched.push({
        ...asset,
        media: {
          status: 'missing_credentials',
          localPath: '',
          attribution: null,
          license: '',
          providerAssetId: '',
          error: `Missing API key for provider: ${provider}`,
        },
      });
      continue;
    }

    try {
      const providerAsset = await withRetries(
        `asset-search:${provider}:${asset.id}`,
        maxRetries,
        retryDelayMs,
        () => searchProviderAsset(asset, apiKey),
        (event) => retryEvents.push(event),
      );

      const ext = extensionFromUrl(providerAsset.downloadUrl, asset.kind === 'video' ? '.mp4' : '.jpg');
      const providerDir = path.join(cacheDir, provider);
      await fs.mkdir(providerDir, { recursive: true });
      const fileName = `${sanitizeFilePart(providerAsset.providerAssetId || `${asset.query}-${Date.now()}`)}${ext}`;
      const localPath = path.join(providerDir, fileName);
      await withRetries(
        `asset-download:${provider}:${asset.id}`,
        maxRetries,
        retryDelayMs,
        () => downloadToFile(providerAsset.downloadUrl, localPath),
        (event) => retryEvents.push(event),
      );

      const attribution = {
        provider,
        creatorName: providerAsset.creatorName,
        creatorUrl: providerAsset.creatorUrl,
        pageUrl: providerAsset.pageUrl,
        required: true,
      };

      cacheIndex[key] = {
        localPath,
        providerAssetId: providerAsset.providerAssetId,
        license: providerAsset.license,
        attribution,
        updatedAt: new Date().toISOString(),
      };

      enriched.push({
        ...asset,
        media: {
          status: 'downloaded',
          localPath,
          attribution,
          license: providerAsset.license,
          providerAssetId: providerAsset.providerAssetId,
          error: '',
        },
      });
    } catch (error) {
      enriched.push({
        ...asset,
        media: {
          status: 'fetch_failed',
          localPath: '',
          attribution: null,
          license: '',
          providerAssetId: '',
          error: String(error?.message || error),
        },
      });
    }
  }

  await writeJson(cacheIndexPath, cacheIndex);
  return {
    assets: enriched,
    retryEvents,
  };
}

async function ensureOverlayArtifacts(projectDir, templatePlacements, assetSuggestions) {
  const artifactsDir = path.join(projectDir, 'generated-overlays');
  await fs.mkdir(artifactsDir, { recursive: true });

  const templateLocalByPlacementId = new Map();
  for (let index = 0; index < templatePlacements.length; index += 1) {
    const placement = templatePlacements[index];
    const startColor = colorFromSeed(`${placement.templateId}:${placement.category}:${index}`);
    const endColor = mixColor(startColor, { r: 20, g: 24, b: 34 }, 0.55);
    const ppm = buildPpmGradient(640, 140, startColor, endColor);
    const filePath = path.join(artifactsDir, `template-${String(index + 1).padStart(2, '0')}.ppm`);
    await writeText(filePath, ppm);
    templateLocalByPlacementId.set(placement.id, filePath);
  }

  const assetLocalById = new Map();
  for (let index = 0; index < assetSuggestions.length; index += 1) {
    const asset = assetSuggestions[index];
    const startColor = providerAccent(asset.provider);
    const endColor = mixColor(startColor, { r: 10, g: 14, b: 20 }, 0.7);
    const ppm = buildPpmGradient(320, 180, startColor, endColor);
    const filePath = path.join(artifactsDir, `asset-${String(index + 1).padStart(2, '0')}.ppm`);
    await writeText(filePath, ppm);
    assetLocalById.set(asset.id, filePath);
  }

  return {
    artifactsDir,
    templateLocalByPlacementId,
    assetLocalById,
  };
}

function buildTemplateClip(placement, index, localOverlayPath) {
  return {
    clipId: `template-clip-${index + 1}`,
    trackId: 'track-template-overlay',
    clipType: 'template_clip',
    startUs: placement.startUs,
    endUs: placement.endUs,
    sourceStartUs: 0,
    sourceEndUs: placement.endUs - placement.startUs,
    sourceRef: localOverlayPath || `template:${placement.templateId}`,
    effects: {
      in: { type: 'fade', durationUs: 120_000 },
      out: { type: 'fade', durationUs: 120_000 },
    },
    transform: {},
    meta: {
      generatedBy: 'ai-template-planner',
      placementId: placement.id,
      templateId: placement.templateId,
      category: placement.category,
      confidence: placement.confidence,
      content: placement.content,
      overlayPath: localOverlayPath || '',
    },
  };
}

function buildAssetClip(asset, index, localOverlayPath) {
  const mediaPath = String(asset?.media?.localPath || '').trim();
  return {
    clipId: `asset-clip-${index + 1}`,
    trackId: 'track-broll',
    clipType: 'asset_clip',
    startUs: asset.startUs,
    endUs: asset.endUs,
    sourceStartUs: 0,
    sourceEndUs: asset.endUs - asset.startUs,
    sourceRef:
      mediaPath || localOverlayPath || `stock:${asset.provider}:${asset.query.toLowerCase().replace(/\s+/g, '-')}`,
    effects: asset.effects,
    transform: {},
    meta: {
      generatedBy: 'ai-stock-planner',
      provider: asset.provider,
      kind: asset.kind,
      query: asset.query,
      attribution: asset.media?.attribution || asset.attribution,
      mediaStatus: asset.media?.status || 'placeholder',
      mediaError: asset.media?.error || '',
      mediaPath,
      license: asset.media?.license || '',
      providerAssetId: asset.media?.providerAssetId || '',
      overlayPath: localOverlayPath || '',
    },
  };
}

function stripPreviousAIGenerated(clips) {
  return (clips || []).filter((clip) => {
    const generatedBy = String(clip?.meta?.generatedBy || '');
    return generatedBy !== 'ai-template-planner' && generatedBy !== 'ai-stock-planner';
  });
}

async function main() {
  const projectId = readArg('--project-id');
  const fps = Math.max(1, Number(readArg('--fps', '30')) || 30);
  const sourceRef = readArg('--source-ref', 'source-video') || 'source-video';
  const fetchExternal = readBooleanArg('--fetch-external', true);
  const fallbackPolicy = safeFallbackPolicy(readArg('--fallback-policy', 'local-first'));
  // Auto-detect best LLM: Codex CLI → OpenAI → Google → Anthropic → Ollama
  const autoLLM = await detectBestLLM();
  const llmProvider = readArg('--llm-provider', process.env.LAPAAS_LLM_PROVIDER || autoLLM.provider);
  const llmModel = readArg('--llm-model', process.env.LAPAAS_LLM_MODEL || autoLLM.model);
  const templatePlannerModel =
    readArg('--template-planner-model', '').trim() ||
    process.env.LAPAAS_TEMPLATE_PLANNER_MODEL ||
    llmModel;
  const llmConfig = { provider: llmProvider, model: llmModel };
  const maxRetries = safeInteger(
    readArg('--max-retries', process.env.LAPAAS_EDIT_NOW_MAX_RETRIES ?? '1'),
    1,
    0,
    10,
  );
  const retryDelayMs = safeInteger(
    readArg('--retry-delay-ms', process.env.LAPAAS_EDIT_NOW_RETRY_DELAY_MS ?? '1200'),
    1200,
    100,
    15000,
  );

  if (!projectId) {
    throw new Error('Missing required argument: --project-id');
  }

  const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
  const transcriptPath = path.join(projectDir, 'transcript.json');
  const timelinePath = path.join(projectDir, 'timeline.json');
  const templatePlanPath = path.join(projectDir, 'template-plan.json');
  const jobPath = path.join(projectDir, 'edit-now-job.json');

  if (!(await exists(transcriptPath))) {
    throw new Error(
      `Transcript not found for project ${projectId}. Run Start Editing first to generate transcript.json.`,
    );
  }

  const tracker = createStageTracker();
  const startedAt = new Date().toISOString();
  let durationUs = 0;
  let templatePlacements = [];
  let assetSuggestions = [];
  let resolvedAssetSuggestions = [];
  let validationWarnings = [];
  let aiDecisions = null;
  let enrichedTimeline = null;
  let templatePlan = null;
  let retryEvents = [];

  try {
    await writeJson(jobPath, {
      projectId,
      status: 'TEMPLATE_PLANNING_IN_PROGRESS',
      startedAt,
      retry: {
        maxRetries,
        retryDelayMs,
      },
    });

    const transcript = await tracker.run('read-transcript', () => readJson(transcriptPath));
    durationUs = Number(transcript?.source?.durationUs || 0);

    const catalog = await tracker.run('template-discovery', () => discoverTemplateCatalog());

    const planningStage = await tracker.run('template-planning', async () => {
      let nextTemplatePlacements;
      let nextAssetSuggestions;
      const isLLM = templatePlannerModel && !templatePlannerModel.startsWith('heuristic');

      if (isLLM) {
        try {
          // AI-driven template selection
          nextTemplatePlacements = await generateTemplatePlanWithOllama(
            transcript?.segments || [], catalog, durationUs, llmConfig
          );
          console.error(`[AI] Template plan: ${nextTemplatePlacements.length} placements`);
        } catch (e) {
          console.error('[AI] Template planning failed, falling back to heuristic:', e.message);
          nextTemplatePlacements = buildTemplatePlacements(transcript?.segments || [], catalog, durationUs);
        }

        try {
          // AI-driven stock media suggestions
          nextAssetSuggestions = await generateStockSuggestionsWithOllama(
            transcript?.segments || [], nextTemplatePlacements, llmConfig
          );
          console.error(`[AI] Stock suggestions: ${nextAssetSuggestions.length} items`);
        } catch (e) {
          console.error('[AI] Stock suggestion failed, falling back to heuristic:', e.message);
          nextAssetSuggestions = buildAssetSuggestions(nextTemplatePlacements);
        }
      } else {
        nextTemplatePlacements = buildTemplatePlacements(transcript?.segments || [], catalog, durationUs);
        nextAssetSuggestions = buildAssetSuggestions(nextTemplatePlacements);
      }

      const constrainedPlacementResult = enforceTemplatePlacementConstraints(nextTemplatePlacements, durationUs);
      return {
        constrainedPlacementResult,
        nextTemplatePlacements: constrainedPlacementResult.placements,
        nextAssetSuggestions,
      };
    });
    templatePlacements = validateTemplatePlacements(planningStage.nextTemplatePlacements, durationUs);
    assetSuggestions = validateAssetSuggestions(planningStage.nextAssetSuggestions, durationUs);

    const assetResolution = await tracker.run('asset-resolution', () =>
      resolveExternalMediaForAssets(projectDir, assetSuggestions, fetchExternal, {
        maxRetries,
        retryDelayMs,
      }),
    );
    resolvedAssetSuggestions = validateAssetSuggestions(assetResolution.assets, durationUs);
    retryEvents = assetResolution.retryEvents;

    validationWarnings = [
      ...planningStage.constrainedPlacementResult.warnings,
      ...buildValidationWarnings({
        templatePlacements,
        assetSuggestions: resolvedAssetSuggestions,
        durationUs,
      }),
    ];
    aiDecisions = buildAiDecisionSummary(templatePlacements, resolvedAssetSuggestions);

    const overlayArtifacts = await tracker.run('overlay-artifacts', () =>
      ensureOverlayArtifacts(projectDir, templatePlacements, assetSuggestions),
    );

    const timeline = await tracker.run('timeline-load', async () => {
      if (await exists(timelinePath)) {
        return readJson(timelinePath);
      }
      return createFallbackTimeline(projectId, durationUs, fps, sourceRef);
    });

    const now = new Date().toISOString();
    const mergeResult = await tracker.run('timeline-merge', async () => {
      const cleanBaseClips = stripPreviousAIGenerated(timeline.clips);
      const templateClips = templatePlacements.map((placement, index) =>
        buildTemplateClip(placement, index, overlayArtifacts.templateLocalByPlacementId.get(placement.id) || ''),
      );
      const assetClips = resolvedAssetSuggestions.map((asset, index) =>
        buildAssetClip(asset, index, overlayArtifacts.assetLocalById.get(asset.id) || ''),
      );
      const mergedTracks = ensureTracks(timeline.tracks);
      const mergedClips = [...cleanBaseClips, ...templateClips, ...assetClips].sort(
        (a, b) => Number(a.startUs || 0) - Number(b.startUs || 0),
      );
      const maxClipEndUs = mergedClips.reduce((max, clip) => Math.max(max, Number(clip.endUs || 0)), 0);

      const nextEnrichedTimeline = {
        ...timeline,
        fps: Number(timeline.fps || fps),
        version: Number(timeline.version || 1) + 1,
        status: 'ENRICHED_TIMELINE_READY',
        updatedAt: now,
        durationUs: Math.max(Number(timeline.durationUs || 0), maxClipEndUs),
        tracks: mergedTracks,
        clips: mergedClips,
      };

      const nextTemplatePlan = {
        planId: `tpl-${Date.now()}`,
        projectId,
        createdAt: now,
        templateCount: templatePlacements.length,
        assetCount: resolvedAssetSuggestions.length,
        fetchExternal,
        fallbackPolicy,
        planner: {
          model: templatePlannerModel,
          strategy: templatePlannerModel.startsWith('heuristic') ? 'rule-based-template-mapper' : 'ollama-ai-planner',
        },
        templatePlacements,
        assetSuggestions: resolvedAssetSuggestions,
        assetFetchSummary: resolvedAssetSuggestions.reduce((summary, asset) => {
          const status = String(asset?.media?.status || 'unknown');
          summary[status] = Number(summary[status] || 0) + 1;
          return summary;
        }, {}),
        overlayArtifacts: {
          dir: overlayArtifacts.artifactsDir,
          templateOverlays: templatePlacements.map((placement) => ({
            placementId: placement.id,
            path: overlayArtifacts.templateLocalByPlacementId.get(placement.id) || '',
          })),
          assetOverlays: assetSuggestions.map((asset) => ({
            assetId: asset.id,
            path: overlayArtifacts.assetLocalById.get(asset.id) || '',
          })),
        },
        constraints: planningStage.constrainedPlacementResult.constraints,
        validationWarnings,
        retry: {
          maxRetries,
          retryDelayMs,
          retryEvents,
        },
        aiDecisions,
        catalogUsed: catalog.slice(0, 32),
      };

      const validatedTemplatePlan = validateTemplatePlan(nextTemplatePlan, durationUs);

      return {
        nextEnrichedTimeline,
        nextTemplatePlan: validatedTemplatePlan,
      };
    });

    enrichedTimeline = mergeResult.nextEnrichedTimeline;
    templatePlan = mergeResult.nextTemplatePlan;

    await tracker.run('artifact-write', async () => {
      await writeJson(templatePlanPath, templatePlan);
      await writeJson(timelinePath, enrichedTimeline);
    });

    const stageDurationsMs = tracker.snapshot();
    const completedAt = new Date().toISOString();
    const telemetry = await recordProjectTelemetry({
      projectDir,
      projectId,
      pipeline: 'edit-now',
      status: 'ENRICHED_TIMELINE_READY',
      stageDurationsMs,
      meta: {
        fallbackPolicy,
        templatePlannerModel,
        fetchExternal,
        maxRetries,
        retryEventCount: retryEvents.length,
      },
    });

    await writeJson(jobPath, {
      projectId,
      status: 'ENRICHED_TIMELINE_READY',
      startedAt,
      completedAt,
      templatePlanPath,
      timelinePath,
      validationWarningsCount: validationWarnings.length,
      planner: templatePlan.planner,
      fallbackPolicy,
      retry: {
        maxRetries,
        retryDelayMs,
        retryEvents,
      },
      stageDurationsMs,
      telemetryPath: telemetry.summaryPath,
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          projectId,
          templatePlanPath,
          timelinePath,
          fetchExternal,
          templatePlacements,
          assetSuggestions: resolvedAssetSuggestions,
          assetFetchSummary: templatePlan.assetFetchSummary,
          planner: templatePlan.planner,
          fallbackPolicy,
          retry: {
            maxRetries,
            retryDelayMs,
            retryEvents,
          },
          stageDurationsMs,
          telemetryPath: telemetry.summaryPath,
          validationWarnings,
          aiDecisions,
          timeline: enrichedTimeline,
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    const stageDurationsMs = tracker.snapshot();
    await writeJson(jobPath, {
      projectId,
      status: 'ENRICHMENT_FAILED',
      startedAt,
      finishedAt: new Date().toISOString(),
      fallbackPolicy,
      planner: {
        model: templatePlannerModel,
      },
      retry: {
        maxRetries,
        retryDelayMs,
        retryEvents,
      },
      stageDurationsMs,
      error: String(error?.message || error),
    }).catch(() => { });

    await recordProjectTelemetry({
      projectDir,
      projectId,
      pipeline: 'edit-now',
      status: 'ENRICHMENT_FAILED',
      stageDurationsMs,
      meta: {
        fallbackPolicy,
        templatePlannerModel,
        fetchExternal,
        maxRetries,
      },
      error: String(error?.message || error),
    }).catch(() => { });

    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exit(1);
});
