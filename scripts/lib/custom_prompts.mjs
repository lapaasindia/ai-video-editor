/**
 * Custom Prompts Loader
 * 
 * Reads user-customized system prompts from desktop/data/custom_prompts.json.
 * Each pipeline stage can have a custom prompt override.
 * If no custom prompt is set for a stage, the default prompt is used.
 * 
 * Stage keys:
 *   - high_retention_analysis: Per-chunk analysis in high_retention_pipeline
 *   - cut_plan: Cut planning in cut_plan_only
 *   - overlay_plan: Overlay planning in overlay_plan_chunk
 *   - template_plan: Template planning in edit_now_pipeline
 *   - stock_suggestions: Stock media suggestions in edit_now_pipeline
 *   - chunk_replan: Chunk re-planning after QC failure
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const PROMPTS_PATH = path.join(ROOT_DIR, 'desktop', 'data', 'custom_prompts.json');

let _cached = null;

/**
 * Load all custom prompts from disk.
 * Returns { [stageKey]: string } map.
 */
export async function loadCustomPrompts() {
    if (_cached) return _cached;
    try {
        const raw = await fs.readFile(PROMPTS_PATH, 'utf8');
        const data = JSON.parse(raw);
        _cached = data.prompts || {};
        return _cached;
    } catch {
        _cached = {};
        return _cached;
    }
}

/**
 * Get custom prompt for a specific stage.
 * Returns the custom prompt string if set, or null if not customized.
 */
export async function getCustomPrompt(stageKey) {
    const prompts = await loadCustomPrompts();
    const value = prompts[stageKey];
    return (typeof value === 'string' && value.trim()) ? value.trim() : null;
}

/**
 * Build the final prompt for a stage. If a custom system prompt is set,
 * prepend it to the dynamic part. Otherwise use the default prompt as-is.
 * 
 * @param {string} stageKey - Pipeline stage key
 * @param {string} defaultPrompt - The full default prompt
 * @param {string} dynamicPart - The dynamic data part (transcript, context etc.)
 * @returns {string} Final prompt to send to LLM
 */
export async function buildPrompt(stageKey, defaultPrompt, dynamicPart = '') {
    const custom = await getCustomPrompt(stageKey);
    if (!custom) {
        return dynamicPart ? `${defaultPrompt}\n\n${dynamicPart}` : defaultPrompt;
    }
    // Custom prompt replaces the system instruction part, dynamic data is appended
    return dynamicPart ? `${custom}\n\n${dynamicPart}` : custom;
}
