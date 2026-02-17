# Professional Video Editor UI - User Guide

## Overview

The new professional video editor interface is inspired by industry-standard tools like Adobe Premiere Pro and Remotion Studio, providing a modern, efficient workspace for AI-powered video editing.

## Interface Layout

### 1. **Menu Bar** (Top)
- **File**: Project management, import/export
- **Edit**: Undo, redo, cut, copy, paste
- **View**: Panel visibility, zoom controls
- **Project**: Project settings, preferences
- **Help**: Documentation, keyboard shortcuts

**Status Indicators:**
- Green: System ready
- Orange: Processing
- Red: Error state

### 2. **Left Panel - Project & Assets** (280px)

#### **Project Tab**
- Project information (resolution, frame rate, duration)
- Media library with thumbnail grid
- Import media button

#### **Templates Tab**
- Search bar for quick template discovery
- Category filters (All, Case Study, News, Social, Data Viz)
- Template grid with thumbnails
- 59 professional templates across 11 categories

#### **Assets Tab**
- Stock media providers (Pexels, Unsplash, Pixabay)
- Search functionality for stock footage
- Asset preview and import

### 3. **Center Area - Preview & Timeline**

#### **Preview Panel** (Top)
- **Video Canvas**: Real-time preview of your composition
- **Zoom Controls**: Fit, 50%, 75%, 100%, 150%, 200%
- **Playback Controls**:
  - Play/Pause button
  - Timecode display (HH:MM:SS:FF format)
  - Scrubber for precise navigation
  - Loop, volume, and fullscreen controls

#### **Timeline Panel** (Bottom, 320px height)
- **Toolbar**:
  - Selection Tool (V)
  - Razor Tool (C)
  - Hand Tool (H)
  - Snap toggle
  - Zoom in/out/fit controls

- **Timeline Ruler**: Time markers with frame-accurate display
- **Multiple Tracks**:
  - Video Track 1: Main video clips
  - Audio Track 1: Audio waveform visualization
  - Template Track: AI-generated template overlays
  
- **Track Controls**:
  - Visibility toggle (eye icon)
  - Lock toggle (lock icon)
  - Track label

### 4. **Right Panel - Properties & Effects** (320px)

#### **Properties Tab**
- **Transform Controls**:
  - Position X/Y
  - Scale (0-200%)
  - Rotation (-180° to 180°)
- **Opacity**: 0-100%
- **Duration**: In/Out timecodes

#### **Effects Tab**
- Video effects library (Blur, Color Correction, Sharpen)
- Transitions (Cross Dissolve, Fade, Wipe)
- Drag-and-drop application

#### **AI Tab**
- **Start AI Editing**: One-click AI workflow
- **Transcription**: Generate transcript and rough cut
- **Template Placement**: AI-powered suggestions
- **Stock Media**: Find relevant footage
- **AI Status**: Model and backend connection status

## Keyboard Shortcuts

### Playback
- `Space` - Play/Pause
- `←` / `→` - Navigate frame by frame
- `I` - Mark In point
- `O` - Mark Out point
- `Home` - Go to start
- `End` - Go to end

### Tools
- `V` - Selection Tool
- `C` - Razor Tool
- `H` - Hand Tool

### Editing
- `Cmd/Ctrl + Z` - Undo
- `Cmd/Ctrl + Shift + Z` - Redo
- `Cmd/Ctrl + X` - Cut
- `Cmd/Ctrl + C` - Copy
- `Cmd/Ctrl + V` - Paste
- `Delete` / `Backspace` - Delete selected clip

### Timeline
- `+` / `-` - Zoom in/out
- `Cmd/Ctrl + 0` - Fit timeline to window
- `Cmd/Ctrl + Scroll` - Horizontal zoom

## Workflow

### 1. **Project Setup**
1. Click "File" → "New Project"
2. Set resolution (3840×2160 or 2160×3840)
3. Set frame rate (30 fps recommended)
4. Name your project

### 2. **Import Media**
1. Go to Project tab in left panel
2. Click "Import Video" button
3. Select your video file
4. Media appears in media grid

### 3. **AI-Powered Editing**
1. Switch to AI tab in right panel
2. Click "Start AI Editing"
3. System will:
   - Transcribe audio
   - Generate rough cut
   - Suggest template placements
   - Find relevant stock media

### 4. **Manual Editing**
1. Drag clips from Project panel to Timeline
2. Use Selection Tool (V) to move clips
3. Use Razor Tool (C) to split clips
4. Adjust clip properties in Properties panel
5. Add effects from Effects panel

### 5. **Template Integration**
1. Go to Templates tab in left panel
2. Browse or search templates
3. Click template to add to timeline
4. Adjust template properties (text, colors, timing)

### 6. **Preview & Refine**
1. Use playback controls to review
2. Scrub timeline for precise editing
3. Adjust clip timing and transitions
4. Preview in real-time

### 7. **Export**
1. Click "File" → "Export"
2. Choose quality preset (Draft, Balanced, Quality)
3. Enable subtitle burn-in if needed
4. Click "Render Now"

## Color Coding

- **Blue clips**: Video content
- **Purple clips**: Audio content
- **Green clips**: Template overlays
- **Orange clips**: Stock media assets

## Tips & Best Practices

### Performance
- Use Draft quality for preview
- Enable proxy mode for 4K footage
- Close unused panels to maximize preview size

### Organization
- Name your clips descriptively
- Use track labels effectively
- Group related clips on same track

### AI Features
- Run transcription first for best results
- Review AI suggestions before applying
- Manually adjust template timing for perfect sync

### Timeline Navigation
- Use keyboard shortcuts for speed
- Enable snap for precise alignment
- Zoom in for frame-accurate editing

## Troubleshooting

### Preview Not Showing
- Check if media is imported correctly
- Verify video codec compatibility
- Try refreshing the preview panel

### Playback Stuttering
- Switch to Draft quality
- Close other applications
- Check system resources

### Templates Not Loading
- Ensure backend is running (port 43123)
- Check network connection
- Refresh template library

### Export Issues
- Verify output path is writable
- Check disk space
- Review render settings

## Technical Details

### Supported Formats
- **Video**: MP4, MOV, AVI, MKV
- **Audio**: MP3, WAV, AAC
- **Images**: PNG, JPG, SVG

### Resolution Support
- **Landscape**: 3840×2160 (4K)
- **Portrait**: 2160×3840 (4K)
- Templates auto-scale to target resolution

### Frame Rates
- 24 fps (Film)
- 25 fps (PAL)
- 30 fps (Standard, recommended)
- 60 fps (High frame rate)

## Comparison with Old UI

| Feature | Old UI | New Professional UI |
|---------|--------|---------------------|
| Layout | Single column, sequential | Multi-panel, simultaneous |
| Preview | Text placeholder | Real-time video canvas |
| Timeline | Basic track view | Professional multi-track |
| Tools | Limited | Full toolset (selection, razor, hand) |
| Properties | Form-based | Real-time panel |
| Templates | List view | Visual grid with search |
| Keyboard Shortcuts | Basic | Industry-standard |
| Workflow | Step-by-step wizard | Non-linear editing |
| Visual Design | Functional | Professional dark theme |

## Future Enhancements

- Real-time collaboration
- Cloud project sync
- Advanced color grading
- Motion graphics editor
- Audio mixing panel
- Multi-cam editing
- 360° video support
- VR preview mode

## Support

For issues or questions:
- Check documentation: `docs/`
- Review task list: `docs/task-list.md`
- Check release notes: `CHANGELOG.md`
