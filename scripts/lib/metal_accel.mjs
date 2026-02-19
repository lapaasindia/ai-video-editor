#!/usr/bin/env node

/**
 * Apple Silicon / Metal GPU acceleration helpers.
 *
 * Detects VideoToolbox support and provides optimised ffmpeg argument builders
 * for all pipeline stages (audio extraction, video render, silence detection).
 *
 * On Apple M-series chips:
 *  - Video decode: -hwaccel videotoolbox  (uses Neural Engine / Media Engine)
 *  - Video encode: hevc_videotoolbox      (~10x faster than libx264 on M3 Max)
 *  - Audio encode: aac_at (AudioToolbox)  (native Apple AAC, lower CPU)
 *  - Parallel audio chunking: Promise.all with concurrency limit
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execFile = promisify(execFileCb);

// ── Hardware Detection ───────────────────────────────────────────────────────

let _hwAccelCache = null;

export async function detectHWAccel() {
    if (_hwAccelCache) return _hwAccelCache;

    const isAppleSilicon = process.platform === 'darwin' &&
        (os.cpus()[0]?.model?.includes('Apple') ?? false);

    if (!isAppleSilicon) {
        _hwAccelCache = { videotoolbox: false, aac_at: false, isAppleSilicon: false };
        return _hwAccelCache;
    }

    try {
        const { stdout } = await execFile('ffmpeg', ['-hwaccels'], { timeout: 5000 });
        const hasVT = stdout.includes('videotoolbox');

        // Check for aac_at (Apple AudioToolbox AAC encoder)
        const { stdout: encoders } = await execFile('ffmpeg', ['-encoders'], { timeout: 5000 });
        const hasAacAt = encoders.includes('aac_at');

        _hwAccelCache = { videotoolbox: hasVT, aac_at: hasAacAt, isAppleSilicon };
        console.error(`[Metal] VideoToolbox=${hasVT} aac_at=${hasAacAt} (Apple Silicon detected)`);
    } catch {
        _hwAccelCache = { videotoolbox: false, aac_at: false, isAppleSilicon };
    }

    return _hwAccelCache;
}

// ── ffmpeg Argument Builders ─────────────────────────────────────────────────

/**
 * Returns ffmpeg args for hardware-accelerated video decode.
 * Place BEFORE -i flag.
 */
export async function hwDecodeArgs() {
    const hw = await detectHWAccel();
    if (!hw.videotoolbox) return [];
    return ['-hwaccel', 'videotoolbox'];
}

/**
 * Returns ffmpeg args for hardware-accelerated video encode.
 * Replaces -c:v libx264 -preset X -crf Y.
 *
 * VideoToolbox HEVC is ~10x faster than libx264 on M3 Max.
 * Falls back to libx264 if VideoToolbox unavailable.
 */
export async function hwEncodeVideoArgs({ quality = 'balanced', pixFmt = 'yuv420p' } = {}) {
    const hw = await detectHWAccel();

    if (hw.videotoolbox) {
        // VideoToolbox quality: lower = better (0-100, ~50 is visually lossless)
        const qMap = { fast: 65, balanced: 55, high: 45, lossless: 35 };
        const q = qMap[quality] ?? 55;
        return [
            '-c:v', 'hevc_videotoolbox',
            '-q:v', String(q),
            '-tag:v', 'hvc1',        // Apple-compatible HEVC tag
            '-pix_fmt', pixFmt,
        ];
    }

    // CPU fallback
    const presetMap = { fast: 'fast', balanced: 'medium', high: 'slow', lossless: 'veryslow' };
    const crfMap = { fast: 28, balanced: 23, high: 18, lossless: 14 };
    return [
        '-c:v', 'libx264',
        '-preset', presetMap[quality] ?? 'medium',
        '-crf', String(crfMap[quality] ?? 23),
        '-pix_fmt', pixFmt,
    ];
}

/**
 * Returns ffmpeg args for hardware-accelerated audio encode.
 * Uses Apple AudioToolbox AAC (aac_at) on Apple Silicon, falls back to aac.
 */
export async function hwEncodeAudioArgs({ bitrate = '160k' } = {}) {
    const hw = await detectHWAccel();
    if (hw.aac_at) {
        return ['-c:a', 'aac_at', '-b:a', bitrate];
    }
    return ['-c:a', 'aac', '-b:a', bitrate];
}

/**
 * Returns ffmpeg args for audio extraction (for Sarvam chunking / silence detection).
 * -hwaccel videotoolbox is a video decoder flag and must NOT be used for audio-only
 * operations — it has no benefit and can fail on audio-only input files.
 */
export async function audioExtractArgs() {
    return [];
}

// ── Parallel Chunk Processor ─────────────────────────────────────────────────

/**
 * Process items in parallel with a concurrency limit.
 * On M3 Max (14 cores), concurrency=6 is optimal for mixed CPU/API tasks.
 */
export async function parallelMap(items, fn, concurrency = 6) {
    const results = new Array(items.length);
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const i = index++;
            results[i] = await fn(items[i], i);
        }
    }

    const workers = Array.from(
        { length: Math.min(concurrency, items.length) },
        () => worker()
    );
    await Promise.all(workers);
    return results;
}

// ── MLX Whisper (Metal GPU local transcription) ──────────────────────────────

/**
 * Check if mlx_whisper is available (Apple Silicon Metal GPU whisper).
 */
export async function isMlxWhisperAvailable() {
    try {
        await execFile('mlx_whisper', ['--help'], { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

/**
 * Transcribe audio file using mlx_whisper (Metal GPU).
 * Much faster than CPU whisper on Apple Silicon.
 */
export async function transcribeWithMlxWhisper(audioPath, language = 'hi', outputDir) {
    const args = [
        audioPath,
        '--model', 'mlx-community/whisper-large-v3-turbo',
        '--language', language,
        '--output-format', 'json',
        '--output-dir', outputDir,
    ];

    console.error(`[Metal] mlx_whisper transcribing ${audioPath}...`);
    const { stdout, stderr } = await execFile('mlx_whisper', args, {
        timeout: 10 * 60 * 1000,
        maxBuffer: 1024 * 1024 * 8,
    });

    return { stdout, stderr };
}
