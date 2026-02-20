# Lapaas AI Editor — Setup Guide

Complete setup instructions for getting the app running on a new Mac.

---

## Prerequisites

### 1. Node.js v22+
```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc

# Install and use Node.js v22
nvm install 22
nvm use 22
nvm alias default 22
```

### 2. Rust + Cargo (for Tauri builds only)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### 3. ffmpeg (required for video processing)
```bash
brew install ffmpeg
```

### 4. Ollama (optional — for local AI models)
```bash
brew install ollama
ollama serve  # run in background
```

---

## Installation

```bash
# Clone the repo
git clone https://github.com/lapaasindia/ai-video-editor.git
cd "ai-video-editor"

# Install dependencies
npm install
```

---

## API Keys

Open the app → **Settings → 🔑 API Keys** and enter your keys:

| Service | Key Name | Where to get it |
|---------|----------|-----------------|
| OpenAI | `OPENAI_API_KEY` | platform.openai.com |
| Google Gemini | `GOOGLE_API_KEY` | aistudio.google.com |
| Anthropic | `ANTHROPIC_API_KEY` | console.anthropic.com |
| Sarvam AI | `SARVAM_API_KEY` | dashboard.sarvam.ai |
| Pexels (stock images) | `PEXELS_API_KEY` | pexels.com/api (free) |
| Pixabay (stock videos) | `PIXABAY_API_KEY` | pixabay.com/api/docs (free) |

Keys are saved to `desktop/data/ai_config.json` locally and never sent externally.

Alternatively, create a `.env` file in the project root (see `.env.example`):
```bash
cp .env.example .env
# Edit .env and fill in your keys
```

---

## Running the App (Development)

### Option A — Full dev mode (recommended)

**Terminal 1 — Backend server:**
```bash
npm run desktop:backend
```

**Terminal 2 — Frontend UI:**
```bash
npm run dev:app
```

Open http://localhost:1420 in your browser.

### Option B — Auto-start backend as a macOS service (stays running across reboots)

Run this once on each machine:
```bash
bash scripts/install-backend-service.sh
```

Then just run the frontend:
```bash
npm run dev:app
```

The backend will start automatically on login and restart if it crashes.

**Service management:**
```bash
# Stop the service
launchctl unload ~/Library/LaunchAgents/com.lapaas.editor.backend.plist

# Start the service
launchctl load ~/Library/LaunchAgents/com.lapaas.editor.backend.plist

# View logs
tail -f /tmp/lapaas-backend.log
```

---

## Building the Distributable .app

```bash
# Bundles Node.js + builds UI + packages .app + .dmg
npm run tauri:build
```

Output: `src-tauri/target/release/bundle/dmg/Lapaas AI Editor_*.dmg`

The `.app` includes a bundled Node.js runtime — **no Node.js installation required** on the end user's machine.

---

## Architecture Overview

```
User opens app
    ↓
Tauri (.app shell — Rust)
├── Auto-starts: desktop/backend/server.mjs  (HTTP API on port 43123)
├── Calls Node scripts directly for: transcription, AI editing, rendering
└── Shows: React + Remotion UI (bundled inside .app)
```

### Key directories

| Path | Purpose |
|------|---------|
| `src/` | React + Remotion frontend UI |
| `src/templates/` | Remotion video templates |
| `scripts/` | AI pipeline Node.js scripts |
| `desktop/backend/server.mjs` | HTTP backend (port 43123) |
| `desktop/data/` | Runtime data: projects, timelines, renders |
| `src-tauri/` | Tauri Rust shell + build config |
| `src-tauri/binaries/node` | Bundled Node.js binary (gitignored, copied by bundle-node.sh) |

### Pipeline flow

```
Import video
    → media_ingest.mjs (proxy + waveform)
    → start_editing_pipeline.mjs (transcription via mlx-whisper or Sarvam)
    → high_retention_pipeline.mjs (AI chunk analysis, template selection, B-roll)
    → fetch_free_assets.mjs (Pexels images, Pixabay videos)
    → render_pipeline.mjs (ffmpeg + Remotion, Metal GPU on Apple Silicon)
```

---

## macOS Service Setup (manual)

If `scripts/install-backend-service.sh` doesn't exist yet, create the launchd plist manually:

```bash
NODE_BIN=$(which node)
PROJECT_DIR=$(pwd)

cat > ~/Library/LaunchAgents/com.lapaas.editor.backend.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.lapaas.editor.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${PROJECT_DIR}/desktop/backend/server.mjs</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/lapaas-backend.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/lapaas-backend.log</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.lapaas.editor.backend.plist
echo "Backend service installed and started."
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No Backend" in UI | Run `npm run desktop:backend` or install the launchd service |
| Backend won't start | Check `tail -f /tmp/lapaas-backend.log` |
| ffmpeg not found | `brew install ffmpeg` |
| mlx-whisper not found | `pip install mlx-whisper` (Apple Silicon only) |
| Transcription fails | Set `SARVAM_API_KEY` in Settings as fallback |
| Pexels/Pixabay not downloading | Set API keys in Settings → 🔑 API Keys |
| Tauri build fails | Run `bash scripts/bundle-node.sh` first |
