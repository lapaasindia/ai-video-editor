#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execFile = promisify(execFileCb);

// Simple arg parser
function readArg(flag, fallback = '') {
    const idx = process.argv.indexOf(flag);
    if (idx === -1) return fallback;
    return process.argv[idx + 1] ?? fallback;
}

async function runOllama(model, prompt) {
    const promptPath = path.join(os.tmpdir(), `agent_prompt_${Date.now()}.txt`);
    try {
        await fs.writeFile(promptPath, prompt, 'utf8');
        // Use shell redirection for robust input
        const { exec } = await import('node:child_process');
        const execAsync = promisify(exec);
        const { stdout } = await execAsync(`ollama run ${model} < "${promptPath}"`, { timeout: 120000 });
        return stdout;
    } finally {
        try { await fs.unlink(promptPath); } catch { }
    }
}

async function main() {
    const projectId = readArg('--project-id');
    const model = readArg('--model', 'llama3.2:3b');
    const goal = readArg('--goal', 'Make the video more concise and professional.');

    if (!projectId) {
        console.error("Missing --project-id");
        process.exit(1);
    }

    const projectDir = path.resolve('desktop', 'data', projectId);
    const transcriptPath = path.join(projectDir, 'transcript.json');
    const cutPlanPath = path.join(projectDir, 'cut-plan.json');
    const agentStatePath = path.join(projectDir, 'agent_state.json');

    console.log(`[Agent] Starting loop for project ${projectId} with goal: "${goal}"`);

    // 1. Load State
    let transcript, cutPlan;
    try {
        transcript = JSON.parse(await fs.readFile(transcriptPath, 'utf8'));
        cutPlan = JSON.parse(await fs.readFile(cutPlanPath, 'utf8'));
    } catch (e) {
        console.error("Failed to load project files:", e.message);
        process.exit(1);
    }

    // 2. Simplification for Context
    // We can't feed the whole transcript sometimes.
    const transcriptSnippet = transcript.segments.slice(0, 50).map(s => `[${s.startUs}-${s.endUs}] ${s.text}`).join('\n');
    const currentCuts = cutPlan.removeRanges.length;

    // 3. Construct Prompt (Planning Phase)
    const systemPrompt = `You are an AI Video Editor Agent. Your goal is: "${goal}".
  
  Current State:
  - Video Duration: ${transcript.source.durationUs} us
  - Word Count: ${transcript.wordCount}
  - Current Cuts: ${currentCuts} ranges defined.
  
  Action Space:
  - "review_cuts": Analyze specific cut ranges for errors.
  - "suggest_b_roll": Suggest image inserts for visual interest. PARAMETERS: "imageQuery" (string), "startUs" (int), "endUs" (int).
  - "finish": If the goal is met.
  
  Output JSON format:
  {
    "thought": "Reasoning...",
    "action": "suggest_b_roll",
    "parameters": { "imageQuery": "city skyline", "startUs": 1000000, "endUs": 5000000 }
  }
  
  IMPORTANT: Output raw JSON only. Do not wrap in markdown code blocks.`;

    const userPrompt = `Snippet of Transcript:\n${transcriptSnippet}\n\nDecide next step.`;

    // 4. Run Agent
    try {
        console.log(`[Agent] Thinking with ${model}...`);
        const response = await runOllama(model, systemPrompt + "\n\n" + userPrompt);

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const plan = JSON.parse(jsonMatch[0]);
            console.log("[Agent] Plan:", plan);

            if (plan.action === 'suggest_b_roll') {
                console.log("[Agent] Executing B-Roll suggestion...");
                const { imageQuery, startUs } = plan.parameters;
                if (imageQuery) {
                    const safeQuery = imageQuery.replace(/[^a-z0-9 ]/gi, '_');
                    const filename = `b_roll_${startUs || 0}_${safeQuery}.png`;
                    const assetsDir = path.join(projectDir, 'assets');
                    await fs.mkdir(assetsDir, { recursive: true });
                    const outputPath = path.join(assetsDir, filename);

                    console.log(`[Agent] Generating image for query: "${imageQuery}" -> ${outputPath}`);

                    // Execute generate_image.mjs
                    // We use process.execPath to ensure we use the same node binary
                    const { stdout, stderr } = await execFile(process.execPath, ['scripts/generate_image.mjs', imageQuery, outputPath]);
                    console.log(stdout);
                    if (stderr) console.error(stderr);

                    // Record result
                    plan.result = `Generated image at ${outputPath}`;
                }
            } else if (plan.action === 'finish') {
                console.log("[Agent] Task completed.");
            }

            // Update State
            await fs.writeFile(agentStatePath, JSON.stringify({
                lastPlan: plan,
                timestamp: new Date().toISOString()
            }, null, 2));

        } else {
            console.error("[Agent] No valid JSON plan found.");
            console.error("[Agent] Raw Output:", response);
        }

    } catch (e) {
        console.error("[Agent] Loop failed:", e);
    }
}

main();
