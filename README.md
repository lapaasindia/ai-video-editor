# Lapaas AI Editor

AI agentic video editor for macOS with:
- local-first AI pipelines (with optional API fallback),
- microsecond transcript + rough-cut planning,
- template/media enrichment flow,
- timeline review/editing,
- final render pipeline.

Built with Remotion + Tauri for efficient desktop performance on Apple Silicon (Metal-optimized path).

## Project Structure

```text
desktop/      Desktop shell UI, backend bridge, runtime data
docs/         PRD, ADRs, audit reports, task tracker
scripts/      CLI pipelines (start-editing, edit-now, render, diagnostics, cleanup)
src/          Remotion compositions, templates, shared UI/lib code
src-tauri/    Native Tauri wrapper commands/config
tests/        Unit, integration, and e2e workflow tests
```

## Quick Start

```bash
npm install
npm run dev
```

## Core Commands

### Quality and Tests

```bash
npm run verify
npm run templates:check
npm run templates:audit
npm test
```

### AI/Desktop Pipeline CLIs

```bash
npm run models:discover
npm run models:health
npm run start:editing -- --project-id proj-123 --input /path/to/video.mp4 --mode hybrid --language en --fps 30 --source-ref source-video
npm run edit:now -- --project-id proj-123 --fps 30 --source-ref source-video
npm run render:video -- --project-id proj-123 --output-name final-export.mp4 --burn-subtitles true --quality balanced
```

### Desktop Runtime

```bash
npm run desktop:backend
npm run desktop:tauri:dev
npm run desktop:tauri:build
```

### Diagnostics and Release Checks

```bash
npm run diagnostics:hardware
npm run checks:first-run
npm run release:check
npm run release:verify
```

### Workspace Cleanup

```bash
npm run clean:workspace
npm run clean:workspace -- --dry-run
npm run clean:workspace -- --all-project-data
```

## macOS Packaging

Notarization + stapling helper:

```bash
./scripts/macos_notarize_and_staple.sh /path/to/Lapaas_AI_Editor.dmg /path/to/Lapaas\ AI\ Editor.app
```

Credential options:
- `NOTARYTOOL_KEYCHAIN_PROFILE` (recommended), or
- `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD`.

## Documentation

- `CHANGELOG.md`
- `docs/README.md`
- `docs/agentic-video-editor-prd.md`
- `docs/task-list.md`
- `docs/template-audit-baseline.md`
- `docs/release-checklist.md`

## Platform Support (v1)

- Primary: macOS Apple Silicon (`darwin/arm64`) with Metal acceleration.
- Secondary: macOS Intel (`darwin/x64`) with reduced performance.
- Unsupported: non-macOS desktop distribution targets.
