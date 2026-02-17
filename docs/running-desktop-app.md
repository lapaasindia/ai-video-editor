# Running the Desktop Application

## Prerequisites

1. **Install cargo-tauri** (one-time setup):
```bash
cargo install tauri-cli
```

2. **Ensure backend is running**:
```bash
npm run desktop:backend
```
This starts the backend server on port 43123.

## Running in Development Mode

```bash
cargo tauri dev --manifest-path src-tauri/Cargo.toml
```

Or use the npm script:
```bash
npm run desktop:tauri:dev
```

This will:
- Compile the Rust Tauri wrapper
- Load the frontend from `desktop/app/` (includes sequential workflow)
- Open the native macOS window

## Building for Production

```bash
cargo tauri build --manifest-path src-tauri/Cargo.toml
```

Or use the npm script:
```bash
npm run desktop:tauri:build
```

This creates:
- `.app` bundle in `src-tauri/target/release/bundle/macos/`
- `.dmg` installer in `src-tauri/target/release/bundle/dmg/`

## What's Included

The Tauri app automatically includes:
- ✅ Sequential 8-step workflow (workflow.js)
- ✅ Auto-advancement between steps
- ✅ Smart data propagation
- ✅ All desktop features (project setup, model discovery, transcription, timeline editor, render)
- ✅ Native Tauri commands for file system operations

## Frontend Files Location

All frontend files are in `desktop/app/`:
- `index.html` - Main UI with workflow steps
- `workflow.js` - Workflow manager
- `main.js` - Application logic
- `styles.css` - Styling including workflow CSS
- `lib/timeline_utils.mjs` - Timeline utilities

## Troubleshooting

### cargo-tauri not found
```bash
cargo install tauri-cli
```

### Backend not responding
Make sure the backend is running on port 43123:
```bash
npm run desktop:backend
```

### Port conflicts
If port 43123 is in use, update `desktop/backend/server.mjs` to use a different port.

## Browser Preview (for testing without Tauri)

For quick testing without building Tauri:
```bash
# Terminal 1: Start backend
npm run desktop:backend

# Terminal 2: Serve frontend
python3 -m http.server 8080 --directory desktop/app
```

Then open http://localhost:8080 in your browser.

**Note:** Some Tauri-specific features (like native file dialogs, system commands) won't work in browser mode.
