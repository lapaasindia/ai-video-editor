# How to Use the Professional Video Editor

## Quick Start Guide

### 1. **Start the Backend**
The backend must be running for import/edit functionality:

```bash
npm run desktop:backend
```

You'll see: `Lapaas desktop backend listening on http://127.0.0.1:43123`

### 2. **Open the App**

**Option A: Browser (Development)**
```bash
# Start web server (if not running)
python3 -m http.server 8080 --directory desktop/app

# Open in browser
http://localhost:8080/
```

**Option B: Desktop App**
```bash
open "src-tauri/target/release/bundle/macos/Lapaas AI Editor.app"
```

### 3. **Create a Project**

Click **"New Project"** in the menu bar:
- Enter project name (e.g., "My Video")
- Enter frame rate (default: 30)
- Project will be created automatically

### 4. **Import Video**

Click **"Import Video"** button (in menu or project panel):
- File picker will open
- Select your video file (MP4, MOV, AVI, MKV, WEBM)
- Video will be imported and processed

### 5. **Run AI Editing**

Go to **AI tab** (right panel) and click:

**Option A: Full AI Workflow**
- Click **"Start AI Editing"** button
- AI will transcribe, create rough cut, and suggest templates

**Option B: Step-by-Step**
- **Transcription**: Click "Run" to transcribe audio
- **Template Placement**: Click "Run" to add AI-suggested templates
- **Stock Media**: Coming soon

### 6. **View Timeline**

After AI editing:
- Timeline will show video clips, audio, and templates
- Use timeline tools: Selection (V), Razor (C), Hand (H)
- Zoom in/out with toolbar buttons

### 7. **Edit Clips**

- Click clips to select them
- Properties panel shows clip settings
- Adjust position, scale, rotation, opacity
- Delete clips with Delete/Backspace key

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `V` | Selection Tool |
| `C` | Razor Tool |
| `H` | Hand Tool |
| `←` / `→` | Frame navigation |
| `I` | Mark In |
| `O` | Mark Out |
| `Delete` | Delete selected clip |

## Current Workflow

### Complete Video Editing Flow:

1. **Start Backend** → `npm run desktop:backend`
2. **Create Project** → Menu: "New Project"
3. **Import Video** → Menu: "Import Video" or Project panel button
4. **AI Processing** → AI tab: "Start AI Editing"
5. **Review Timeline** → Check generated clips and templates
6. **Manual Edits** → Select/move/trim clips as needed
7. **Render** → (Coming soon - use Remotion Studio for now)

## What's Working

✅ **Project Creation**
- Create projects with custom names and FPS
- Projects stored in backend

✅ **Media Import**
- File picker dialog (Tauri) or file input (browser)
- Video import with proxy and waveform generation
- Status updates during import

✅ **AI Editing**
- Full AI workflow: transcription + rough cut + templates
- Step-by-step: individual AI operations
- Timeline rendering with clips

✅ **Timeline Interaction**
- Multi-track view (Video, Audio, Templates)
- Tool selection (Selection, Razor, Hand)
- Zoom and snap controls
- Playback controls

✅ **Template Library**
- 24 mock templates for development
- Real templates loaded from backend (when available)
- Template click to add to timeline

✅ **UI Interactions**
- Panel tab switching
- Keyboard shortcuts
- Playback controls
- Status indicators

## Troubleshooting

### "Please create a project first"
- Click "New Project" in menu bar
- Enter project details

### "Please import a video first"
- Click "Import Video" in menu
- Select a video file

### Backend not connecting
- Check backend is running: `npm run desktop:backend`
- Backend should be on port 43123
- In browser: CORS may cause issues (use desktop app instead)

### Import button does nothing
- In browser: File picker may not work (use desktop app)
- In desktop app: Tauri dialog should open

### Templates not loading
- Backend must be running
- Mock templates will show as fallback
- Check console for errors

## File Locations

- **Desktop App**: `src-tauri/target/release/bundle/macos/Lapaas AI Editor.app`
- **DMG Installer**: `src-tauri/target/release/bundle/dmg/Lapaas AI Editor_0.1.0_aarch64.dmg`
- **Web UI**: `desktop/app/index.html`
- **Backend**: `desktop/backend/server.mjs`

## Tips

1. **Always start backend first** for full functionality
2. **Use desktop app** for file import (browser has limitations)
3. **Create project before importing** to avoid errors
4. **Check status indicator** (top right) for system state
5. **Use keyboard shortcuts** for faster editing

## Next Steps

After successful AI editing:
1. Review the generated timeline
2. Manually adjust clip timing
3. Add/remove templates as needed
4. Export video (coming soon)

For now, you can:
- Use Remotion Studio to preview compositions
- Export timeline data for external rendering
- Continue editing in the professional UI

## Support

If something isn't working:
1. Check backend is running
2. Check browser console for errors
3. Try desktop app instead of browser
4. Restart backend if needed
5. Check `docs/` for more information
