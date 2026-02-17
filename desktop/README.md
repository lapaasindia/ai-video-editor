# Lapaas Desktop Shell (Tauri Track)

This directory contains desktop-specific implementation for the macOS app shell.

## Current State
- Desktop framework decision: **Tauri** (see `docs/adr/0001-desktop-shell-tauri.md`).
- Local backend scaffold available at `desktop/backend/server.mjs`.
- Tauri shell scaffold available at `src-tauri/`.
- Minimal desktop UI bootstrap available at `desktop/app/`.

## Backend Endpoints (Localhost)
- `GET /health`
- `GET /models/discover`
- `POST /models/install`
- `POST /media/ingest`
- `POST /start-editing`
- `POST /edit-now`
- `POST /render`
- `GET /render/:projectId/history`
- `POST /open-path`
- `GET /projects`
- `POST /projects/create`
- `PATCH /projects/:id/settings`
- `POST /timeline/rough-cut`
- `GET /timeline/:projectId`
- `PATCH /timeline/save`

Default bind:
- `127.0.0.1:43123`

## Run
```bash
npm run desktop:backend
```

### Tauri (when `cargo-tauri` is installed)
```bash
npm run desktop:tauri:dev
```

```bash
npm run desktop:tauri:build
```

## Notes
- This backend is intentionally local-only and designed to be invoked by the future desktop shell.
- Runtime detection and install logic is delegated to scripts in `/scripts`.
- `POST /start-editing` writes transcription/cut-plan/subtitle artifacts under `desktop/data/<projectId>/` and returns rough-cut timeline payload.
- `POST /edit-now` writes template plan artifacts and updates `timeline.json` with template/media clips.
- `POST /edit-now` can fetch external media from provider APIs (`fetchExternal=true`) and caches assets under `desktop/data/<projectId>/stock-cache/`.
- `POST /render` writes output MP4 under `desktop/data/<projectId>/renders/` and updates `render-job.json`.
- `GET /render/:projectId/history` returns recent render history records from `renders/history.json`.
- `POST /open-path` reveals a local output path in Finder (`open -R`).
- Render composites timeline source clips plus overlay clips (`template_clip`, `asset_clip`) when clip `sourceRef` points to local media.
- Subtitle burn-in depends on ffmpeg subtitle-filter support; when unavailable, render falls back to non-burned output with warning.
- Desktop UI now includes manual clip range edit/delete controls for rough-cut review before saving timeline.
- Supported env vars for external media fetching:
  - `PEXELS_API_KEY` or `LAPAAS_PEXELS_API_KEY`
  - `PIXABAY_API_KEY` or `LAPAAS_PIXABAY_API_KEY`
  - `UNSPLASH_ACCESS_KEY` or `LAPAAS_UNSPLASH_ACCESS_KEY`
- Tauri commands currently exposed:
  - `discover_models`
  - `install_model`
  - `ingest_media`
  - `start_editing`
  - `edit_now`
  - `render_video`
  - `get_render_history`
  - `open_path`
  - `create_rough_cut_timeline`
  - `get_timeline`
  - `save_timeline`
  - `list_projects`
  - `create_project`
  - `update_project_settings`
  - `app_metadata`
