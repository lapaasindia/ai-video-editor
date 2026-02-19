#!/usr/bin/env node

/**
 * Codex CLI — The Command Line Interface for AI Video Editor.
 *
 * Capabilities:
 *  - Manage projects (list, select, create)
 *  - Run pipeline stages (transcribe, cut, overlay, render)
 *  - "Codex Mode": Natural language editing via LLM (Gemini/OpenAI/Ollama)
 *
 * Usage:
 *   node scripts/codex.mjs [command] [args]
 *   node scripts/codex.mjs (starts interactive shell)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config'; // Load .env
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { runLLMPrompt, extractJsonFromLLMOutput, getAvailableModels } from './lib/llm_provider.mjs';

const PROJECT_ROOT = path.resolve('.');
const DATA_DIR = path.join(PROJECT_ROOT, 'desktop', 'data');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');

// ── State ───────────────────────────────────────────────────────────────────

let currentProject = null;
let llmConfig = {
    provider: 'ollama',
    model: 'qwen3:1.7b'
};

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fileExists(p) {
    try { await fs.access(p); return true; } catch { return false; }
}

async function runScript(scriptName, args) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(SCRIPTS_DIR, scriptName);
        console.log(`\n> Running ${scriptName}...\n`);

        const child = spawn('node', [scriptPath, ...args], {
            stdio: 'inherit',
            cwd: PROJECT_ROOT
        });

        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Script exited with code ${code}`));
        });
    });
}

// ── Commands ────────────────────────────────────────────────────────────────

async function listProjects(silent = false) {
    if (!await fileExists(DATA_DIR)) {
        if (!silent) console.log('No projects found (data directory missing).');
        return;
    }
    const projectsFile = path.join(DATA_DIR, 'projects.json');
    if (!await fileExists(projectsFile)) {
        if (!silent) console.log('No projects found.');
        return;
    }

    try {
        const data = JSON.parse(await fs.readFile(projectsFile, 'utf8'));
        if (!silent) {
            console.log('\nAvailable Projects:');
            data.forEach(p => {
                const active = currentProject?.id === p.id ? '*' : ' ';
                console.log(` ${active} [${p.id}] ${p.name || 'Untitled'}`);
            });
            console.log('');
        }
    } catch (e) {
        if (!silent) console.error('Error reading projects:', e.message);
    }
}

async function selectProject(idOrName) {
    const projectsFile = path.join(DATA_DIR, 'projects.json');
    if (!await fileExists(projectsFile)) return;

    const data = JSON.parse(await fs.readFile(projectsFile, 'utf8'));
    const project = data.find(p => p.id === idOrName || p.name === idOrName);

    if (project) {
        currentProject = project;
        console.log(`\nSelected project: ${project.name} (${project.id})\n`);
        // Update LLM config from project if set, otherwise keep defaults
        if (project.llmProvider) llmConfig.provider = project.llmProvider;
        if (project.llmModel) llmConfig.model = project.llmModel;
    } else {
        console.error(`Project "${idOrName}" not found.`);
    }
}

// ── Auto-Detect LLM ─────────────────────────────────────────────────────────

function detectBestLLM() {
    if (process.env.GOOGLE_API_KEY) {
        return { provider: 'google', model: 'gemini-2.0-flash' };
    }
    if (process.env.OPENAI_API_KEY) {
        return { provider: 'openai', model: 'gpt-4o-mini' };
    }
    return { provider: 'ollama', model: 'qwen3:1.7b' }; // Fallback
}

// ── Natural Language Handler ───────────────────────────────────────────────

async function handleNaturalLanguageInput(input) {
    if (!currentProject) {
        console.error('Please select a project first using "select <id>".');
        return;
    }

    const config = detectBestLLM();
    console.log(`\n🤖 Codex (using ${config.provider}/${config.model})...\n`);

    const prompt = `
You are Codex, an AI video editor CLI assistant.
Current Project: ${currentProject.name} (${currentProject.id})
User Instruction: "${input}"

Available Tools:
- transcribe: Transcribe audio to text.
- cut_plan: Analyze transcript and generate a cut list (remove silence).
- overlay_plan: Generate overlay suggestions for chunks.
- fetch_asset(query, kind): Download stock assets.

Map the user's instruction to a list of sequential actions.
Respond ONLY with JSON:
{
  "actions": [
    { "tool": "transcribe", "reason": "User wants to start editing" },
    { "tool": "cut_plan", "reason": "User wants to remove silence" }
  ]
}
`;

    try {
        const response = await runLLMPrompt(config, prompt, 30000);
        const plan = extractJsonFromLLMOutput(response);

        console.log('Plan:', JSON.stringify(plan.actions, null, 2));

        // Execute plan
        for (const action of plan.actions) {
            console.log(`\nExecuting: ${action.tool} (${action.reason})...`);

            if (action.tool === 'transcribe') {
                await runScript('transcribe_only.mjs', ['--project-id', currentProject.id]);
            } else if (action.tool === 'cut_plan') {
                await runScript('cut_plan_only.mjs', ['--project-id', currentProject.id]);
            } else if (action.tool === 'overlay_plan') {
                // For CLI, just do the first chunk or all? Let's do chunk 0 for now as a demo
                await runScript('overlay_plan_chunk.mjs', ['--project-id', currentProject.id, '--chunk-index', '0']);
            } else if (action.tool === 'fetch_asset') {
                await runScript('fetch_free_assets.mjs', ['--project-id', currentProject.id, '--query', action.query || 'background', '--kind', action.kind || 'image']);
            }
        }
        console.log('\nDone.');

    } catch (e) {
        console.error('Codex failed:', e.message);
    }
}

// ── Interactive Loop ────────────────────────────────────────────────────────

// ── Argument Handling & Main Loop ──────────────────────────────────────────

async function main() {
    console.log('Codex CLI v0.1');
    const cliArgs = process.argv.slice(2);

    // Initial project loading
    await listProjects(true); // silent list to populate cache if needed, though listProjects prints.
    // Actually selectProject reads file freshly.

    if (cliArgs.length > 0) {
        // Non-interactive mode

        // 1. Argument parsing for flags
        let cmdArgs = [];
        let overrideProjectId = null;

        for (let i = 0; i < cliArgs.length; i++) {
            const arg = cliArgs[i];
            if (arg === '--project-id' || arg === '-p') {
                overrideProjectId = cliArgs[i + 1];
                i++;
            } else {
                cmdArgs.push(arg);
            }
        }

        // 2. Auto-select project
        if (overrideProjectId) {
            await selectProject(overrideProjectId);
        } else {
            // Try to pick the first one as default
            const projectsFile = path.join(DATA_DIR, 'projects.json');
            if (await fileExists(projectsFile)) {
                try {
                    const data = JSON.parse(await fs.readFile(projectsFile, 'utf8'));
                    if (data.length > 0) {
                        await selectProject(data[0].id);
                        console.log(`(Auto-selected project: ${data[0].name})`);
                    }
                } catch { }
            }
        }

        const cmd = cmdArgs[0];
        const args = cmdArgs.slice(1);

        if (cmd) {
            await processCommand(cmd, args);
        } else {
            // If only flags were passed (e.g. just selecting project?), assume interactive?
            // "npm run codex -- -p 123" -> start interactive with that project
            rl.prompt();
            return;
        }
        process.exit(0);
    }

    // Interactive mode
    await listProjects();
    rl.prompt();
}

async function processCommand(cmd, args) {
    try {
        switch (cmd) {
            case 'exit':
            case 'quit':
                process.exit(0);
                break;
            case 'list':
            case 'ls':
                await listProjects();
                break;
            case 'select':
                if (args[0]) await selectProject(args[0]);
                else console.log('Usage: select <project-id>');
                break;
            case 'transcribe':
                if (!currentProject) { console.log('Select a project first (use "select").'); break; }
                await runScript('transcribe_only.mjs', ['--project-id', currentProject.id]);
                break;
            case 'cut':
                if (!currentProject) { console.log('Select a project first (use "select").'); break; }
                await runScript('cut_plan_only.mjs', ['--project-id', currentProject.id]);
                break;
            case 'help':
                console.log(`
Commands:
  list              List all projects
  select <id>       Select a project
  transcribe        Run transcription
  cut               Run cut planning
  edit "task..."    Describe what you want to do in English
  exit              Exit CLI
`);
                break;
            case 'edit':
                await handleNaturalLanguageInput(args.join(' '));
                break;
            default:
                // Treat unknown commands as natural language if they look like sentences
                if (cmd.split(' ').length > 2 || args.length > 0) {
                    // Reconstruct strict sentence
                    const sentence = [cmd, ...args].join(' ');
                    await handleNaturalLanguageInput(sentence);
                } else {
                    console.log('Unknown command. Type "help" or "edit <instruction>".');
                }
                break;
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'codex> '
});

rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
        rl.prompt();
        return;
    }

    const parts = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(s => s.replace(/^"|"$/g, ''));
    const cmd = parts[0];
    const args = parts.slice(1);

    await processCommand(cmd, args);
    rl.prompt();
});

main();
