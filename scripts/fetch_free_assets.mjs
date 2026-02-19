#!/usr/bin/env node

/**
 * Fetch Free Assets — Downloads stock images/videos from free APIs.
 *
 * Searches Pexels, Pixabay, and Unsplash for matching assets.
 * Downloads the best match to the project's asset directory.
 *
 * Usage:
 *   node scripts/fetch_free_assets.mjs \
 *     --project-id <id> \
 *     --query "sunset landscape" \
 *     --kind image \
 *     --provider pexels
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config'; // Load .env
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';

function readArg(flag, fallback = '') {
    const idx = process.argv.indexOf(flag);
    if (idx === -1) return fallback;
    return process.argv[idx + 1] ?? fallback;
}

// ── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchJson(url, options = {}) {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}

async function downloadToFile(url, filePath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const body = res.body;
    if (!body) throw new Error('No response body');
    await pipeline(Readable.fromWeb(body), createWriteStream(filePath));
    return filePath;
}

function sanitizeFilename(input) {
    return String(input || 'asset')
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 40);
}

function extensionFromUrl(url, fallback = '.jpg') {
    try {
        const pathname = new URL(url).pathname;
        const ext = path.extname(pathname);
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov'].includes(ext.toLowerCase())) {
            return ext.toLowerCase();
        }
    } catch { }
    return fallback;
}

// ── Provider Search Functions ───────────────────────────────────────────────

async function searchPexels(query, kind, apiKey) {
    const q = encodeURIComponent(query);

    if (kind === 'video') {
        const data = await fetchJson(`https://api.pexels.com/videos/search?query=${q}&per_page=1&orientation=landscape`, {
            headers: { Authorization: apiKey },
        });
        const item = data?.videos?.[0];
        if (!item) throw new Error('No Pexels video');
        const files = item.video_files || [];
        const picked = files.find(f => f.width >= 640 && f.width <= 1920) || files[0];
        if (!picked?.link) throw new Error('Pexels video URL missing');
        return { url: picked.link, provider: 'pexels', creator: item?.user?.name || '', license: 'Pexels License' };
    }

    const data = await fetchJson(`https://api.pexels.com/v1/search?query=${q}&per_page=1&orientation=landscape`, {
        headers: { Authorization: apiKey },
    });
    const item = data?.photos?.[0];
    if (!item) throw new Error('No Pexels image');
    const src = item?.src || {};
    const url = src.large2x || src.large || src.original || src.medium;
    if (!url) throw new Error('Pexels image URL missing');
    return { url, provider: 'pexels', creator: item.photographer || '', license: 'Pexels License' };
}

async function searchPixabay(query, kind, apiKey) {
    const q = encodeURIComponent(query);

    if (kind === 'video') {
        const data = await fetchJson(`https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${q}&per_page=3&safesearch=true`);
        const item = data?.hits?.[0];
        if (!item) throw new Error('No Pixabay video');
        const variants = item.videos || {};
        const picked = variants.medium || variants.small || variants.large;
        if (!picked?.url) throw new Error('Pixabay video URL missing');
        return { url: picked.url, provider: 'pixabay', creator: item.user || '', license: 'Pixabay License' };
    }

    const data = await fetchJson(`https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${q}&image_type=photo&per_page=3&safesearch=true`);
    const item = data?.hits?.[0];
    if (!item) throw new Error('No Pixabay image');
    const url = item.largeImageURL || item.webformatURL;
    if (!url) throw new Error('Pixabay image URL missing');
    return { url, provider: 'pixabay', creator: item.user || '', license: 'Pixabay License' };
}

async function searchUnsplash(query, kind, apiKey) {
    if (kind === 'video') throw new Error('Unsplash does not support video');

    const q = encodeURIComponent(query);
    const data = await fetchJson(`https://api.unsplash.com/search/photos?query=${q}&per_page=1&orientation=landscape`, {
        headers: { Authorization: `Client-ID ${apiKey}` },
    });
    const item = data?.results?.[0];
    if (!item) throw new Error('No Unsplash image');
    const url = item?.urls?.regular || item?.urls?.full || item?.urls?.small;
    if (!url) throw new Error('Unsplash image URL missing');
    return { url, provider: 'unsplash', creator: item?.user?.name || '', license: 'Unsplash License' };
}

async function searchWikimedia(query, kind) {
    const type = kind === 'video' ? 'filetype:video' : 'filetype:bitmap';
    const q = encodeURIComponent(`${type} ${query}`);
    // Search generator
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${q}&prop=imageinfo&iiprop=url|mime|extmetadata&format=json&gsrlimit=1&origin=*`;

    const data = await fetchJson(url, { headers: { 'User-Agent': 'LapaasAIEditor/1.0 (https://lapaas.com; contact@lapaas.com)' } });
    const pages = data?.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    if (!pageId || pageId === '-1') throw new Error('No Wikimedia result');

    const info = pages[pageId]?.imageinfo?.[0];
    if (!info?.url) throw new Error('Wikimedia URL missing');

    const metadata = info.extmetadata || {};
    const creator = metadata.Artist?.value?.replace(/<[^>]*>/g, '') || 'Wikimedia User';
    const license = metadata.LicenseShortName?.value || 'CC BY-SA';

    return {
        url: info.url,
        provider: 'wikimedia',
        creator: creator.trim(),
        license: license
    };
}

// ── Main Search Logic ───────────────────────────────────────────────────────

async function searchAsset(query, kind, preferredProvider) {
    const keys = {
        pexels: process.env.PEXELS_API_KEY || '',
        pixabay: process.env.PIXABAY_API_KEY || '',
        unsplash: process.env.UNSPLASH_API_KEY || '',
    };

    // Try preferred provider first, then fallback to others. Wikimedia is always available (no key).
    const providers = [preferredProvider, 'pexels', 'pixabay', 'unsplash', 'wikimedia'].filter(Boolean);
    const tried = new Set();

    for (const provider of providers) {
        if (tried.has(provider)) continue;
        tried.add(provider);

        // Skip providers without keys (except wikimedia)
        const key = keys[provider];
        if (provider !== 'wikimedia' && !key) {
            console.error(`[Asset] Skipping ${provider} — no API key (set ${provider.toUpperCase()}_API_KEY)`);
            continue;
        }

        try {
            if (provider === 'pexels') return await searchPexels(query, kind, key);
            if (provider === 'pixabay') return await searchPixabay(query, kind, key);
            if (provider === 'unsplash') return await searchUnsplash(query, kind, key);
            if (provider === 'wikimedia') return await searchWikimedia(query, kind);
        } catch (e) {
            console.error(`[Asset] ${provider} search failed: ${e.message}`);
        }
    }

    throw new Error(`No asset found for "${query}" (${kind}) — tried: ${[...tried].join(', ')}.`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const projectId = readArg('--project-id');
    const query = readArg('--query');
    const kind = readArg('--kind', 'image');
    const provider = readArg('--provider', 'pexels');

    if (!projectId) throw new Error('Missing --project-id');
    if (!query) throw new Error('Missing --query');

    const projectDir = readArg('--project-dir') || path.resolve('desktop', 'data', projectId);
    const assetsDir = path.join(projectDir, 'assets');
    await fs.mkdir(assetsDir, { recursive: true });

    // 1. Search
    console.error(`[Asset] Searching ${provider} for "${query}" (${kind})...`);
    const result = await searchAsset(query, kind, provider);
    console.error(`[Asset] Found: ${result.provider} — ${result.url.slice(0, 80)}`);

    // 2. Download
    const ext = kind === 'video' ? extensionFromUrl(result.url, '.mp4') : extensionFromUrl(result.url, '.jpg');
    const filename = `${sanitizeFilename(query)}_${Date.now()}${ext}`;
    const localPath = path.join(assetsDir, filename);

    console.error(`[Asset] Downloading to ${localPath}...`);
    await downloadToFile(result.url, localPath);

    // 3. Output
    process.stdout.write(JSON.stringify({
        ok: true,
        query,
        kind,
        provider: result.provider,
        localPath,
        creator: result.creator,
        license: result.license,
    }, null, 2) + '\n');
}

main().catch(e => { process.stderr.write(`${e.message}\n`); process.exit(1); });
