# Lapaas AI Editor - Task List

Last updated: 2026-02-14
Source PRD: `docs/agentic-video-editor-prd.md`

## Status Legend
- `[ ]` Todo
- `[-]` In Progress
- `[x]` Done
- `[!]` Blocked

## Current Progress
- [x] PRD created and updated for macOS + `.dmg` + Metal + local/API hybrid model support.
- [x] Task tracking file created.
- [x] Desktop shell decision documented: Tauri selected (`docs/adr/0001-desktop-shell-tauri.md`).
- [x] Added initial local runtime/model discovery CLI (`scripts/model_runtime_discovery.mjs`).
- [x] Added initial local model install CLI for Ollama pulls (`scripts/model_runtime_install.mjs`).
- [x] Added local desktop backend scaffold (`desktop/backend/server.mjs`) with model endpoints.
- [x] Added local desktop backend project endpoints (`/projects`, `/projects/create`, `/projects/:id/settings`).
- [x] Added Tauri scaffold with native commands (`src-tauri/src/main.rs`).
- [x] Added minimal desktop shell UI (`desktop/app/index.html`).
- [x] Added native project setup persistence commands (`create_project`, `list_projects`, `update_project_settings`).
- [x] Added `Start Editing` command flow (UI + Tauri + backend + script orchestration).
- [x] Added baseline rough-cut auto-generation after `Start Editing`.
- [x] Added `Edit Now` command flow (UI + Tauri + backend + script orchestration).
- [x] Added enriched timeline generation with template + asset clips.
- [x] Added render command flow (UI + Tauri + backend + script orchestration).
- [x] Added baseline final MP4 render pipeline from timeline source clips.
- [x] Added overlay compositing in final render for template and asset clips with local overlay sources.
- [x] Improved desktop shell UI hierarchy, spacing, and padding for better readability.
- [x] Added macOS CI workflow scaffold for desktop `.app` + `.dmg` build artifacts.
- [x] Added external media fetch adapters and local stock-cache integration for `Edit Now`.
- [x] Added render history tracking and retrieval endpoint/command.
- [x] Added manual clip edit/delete controls in timeline review UI.
- [x] Added open-in-Finder action for rendered output paths.
- [x] Added timeline split/ripple-delete/undo/redo and precise clip timing inspection tools.
- [x] Added template placement constraint enforcement (overlap/bounds/text length) in `Edit Now`.
- [x] Added AI decisions and validation warnings review panel in desktop UI.
- [x] Added template clip headline/subline editing controls in timeline review.
- [x] Added project-level per-task model assignment + fallback policy wiring into `Start Editing` and `Edit Now`.
- [x] Added hardware diagnostics flow for Metal + ffmpeg acceleration readiness in desktop shell.
- [x] Added pipeline stage telemetry capture and project telemetry viewer in desktop shell.
- [x] Added retry/failure-recovery flow for render and enrichment jobs with status fallback updates.
- [x] Added strict schema validation for cut planning and template planning artifacts.
- [x] Added automated unit/integration/e2e workflow tests for timeline math and full pipeline runs.
- [x] Added macOS notarization + stapling automation script and CI workflow wiring.
- [x] Upgraded project setup into a 4-step wizard with clearer hierarchy and summary preview.
- [x] Upgraded model discovery UI with runtime compatibility cards, recommended model statuses, and install progress feedback.
- [x] Bound template discovery in `Edit Now` to the active template registry imports (`src/Root.tsx` + `src/templates/registry.ts`).
- [x] Added project resume selector to reload saved project settings into all workflow forms.
- [x] Added first-run checks flow (support tier, binaries, writable paths, runtime readiness) in desktop shell.
- [x] Added launch-time first-run checks with topbar support/readiness badges and release-preflight CLI checks.
- [x] Added runtime health diagnostics (`models:health`) with desktop shell panel and Tauri/backend wiring.
- [x] Added timeline keyboard shortcuts (playhead navigation, split, trim-to-playhead, delete/ripple delete, snap toggle, undo/redo, save) with in-UI shortcut legend.
- [x] Added template quality audit CLI (`templates:audit`) for typography hierarchy, spacing, and alignment risk scanning across all templates.
- [x] Added template registration integrity CLI (`templates:check`) to verify all template files are imported in `src/Root.tsx` and call `registerTemplate`.
- [x] Added template registration guard into default test flow (`npm test`) so missing template wiring fails CI locally.
- [x] Added dedicated GitHub quality CI workflow (`.github/workflows/quality-ci.yml`) for push/PR checks on lint, template audit, and full tests.
- [x] Hardened macOS build workflow with pre-build lint + template audit checks.
- [x] Added release-readiness command bundles (`verify`, `release:verify`) and standardized package metadata for release tooling compatibility.
- [x] Added release documentation set (`CHANGELOG.md`, `docs/release-checklist.md`) and linked it in docs index/readme.
- [x] Added template audit baseline report with prioritized cleanup list (`docs/template-audit-baseline.md`).
- [x] Completed template quality remediation wave 1 (ArticleHighlight01, MoneyRain01, CaseStudyProblemSolution01, CutoutHook01) and improved audit baseline counts.
- [x] Completed template quality remediation wave 2 (CaseStudyHero01, CaseStudyQuote01, CaseStudyROI01) and reduced audit queue further.
- [x] Completed template quality remediation wave 3 (LogoRevealGlitch01, AutoWhoosh01, BilingualOutro01) and reduced audit queue further.
- [x] Completed template quality remediation wave 4 (CensorStickers01, CollagePiP01, HeadlineCard01) and reduced audit queue further.
- [x] Completed template quality remediation wave 5 (LightLeakSmash01, PhoneCameo01, ProofTiles01) and reduced audit queue further.
- [x] Completed template quality remediation wave 6 (SplitCompare01, StampVerdict01, TimelineSteps01, startup-showcase set, text-animation set) and cleared the queue (`ok=59`, `needs_review=0`).
- [x] Completed template quality remediation wave 7 (CaseStudyProblemSolution01, CaseStudyStats01, CaseStudyTimeline01, ArticleHighlight01, CutoutHook01, ZoomReveal01) and cleared all remaining low-risk audit items (`low=0`).
- [x] Added workspace hygiene pass: cleanup CLI, stronger `.gitignore`, and desktop data retention docs.
- [x] Kickoff implementation planning from PRD into engineering work packages.

## Phase 1 - Foundation (Desktop + Core)

### 1. Desktop App and Packaging
- [x] Decide desktop shell framework (Electron/Tauri/native wrapper) and document decision.
- [x] Create macOS app shell (`Lapaas AI Editor`) with local project storage path setup.
- [x] Add release pipeline for signed `.app` and `.dmg`.
- [x] Add notarization + stapling automation for release builds.

### 2. Core Project Setup
- [x] Implement project creation flow (name, aspect ratio, fps, resolution, language).
- [x] Implement AI mode selection (`Local` / `API` / `Hybrid`).
- [x] Persist project settings and resume support.

### 3. Local Model Discovery + Management
- [x] Add model runtime discovery service (`Ollama`, `whisper.cpp`, `faster-whisper`, `MLX`).
- [x] Build model list UI with status (`Installed`, `Not Installed`, `Incompatible`, `Needs Update`).
- [x] Add model install action and progress tracking.
- [x] Add per-task model assignment (`transcription`, `cut-planner`, `template-planner`).
- [x] Add fallback policy: local-first with API fallback.

### 4. Media Ingest
- [x] Implement upload/import pipeline for local video files.
- [x] Add ffprobe metadata extraction.
- [x] Generate proxy + waveform for timeline performance.
- [x] Save source/proxy metadata in project state.

## Phase 2 - Rough Cut AI

### 5. Transcription Pipeline
- [x] Implement transcription job orchestration (`Start Editing`).
- [x] Add local transcription adapters (with Metal preference on Apple Silicon).
- [x] Add API transcription adapter.
- [x] Normalize transcript into canonical microsecond timeline schema.
- [x] Export subtitle formats (`SRT`, `VTT`, `JSON`).

### 6. AI Cut Planner
- [x] Implement cut recommendation prompt + schema validation.
- [x] Add silence/filler/redundancy analysis.
- [x] Generate non-destructive rough cut timeline.
- [x] Show AI rationale + confidence in UI.

### 7. Timeline Editor (Rough Cut Review)
- [x] Build clip tracks + waveform + playhead.
- [x] Implement drag, trim, split, ripple delete, snapping.
- [x] Add undo/redo.
- [x] Add precise time inspector (`hh:mm:ss.ffffff` + frame index).

## Phase 3 - AI Enrichment

### 8. Template Planning (`Edit Now`)
- [x] Expose template catalog from registry to AI planner.
- [x] Implement template placement planning with strict schema validation.
- [x] Enforce overlap and text-length constraints.
- [x] Generate editable template clips in timeline.

### 9. External Media Fetching
- [x] Integrate Pexels API adapter.
- [x] Integrate Pixabay API adapter.
- [x] Integrate Unsplash API adapter.
- [x] Add cache + attribution/license metadata.
- [x] Add default zoom/pan effects for inserted assets.

### 10. Enriched Timeline Review
- [x] Build side panel for AI-generated template/media decisions.
- [x] Enable editing generated template props/content.
- [x] Add validation warnings (missing assets, overflow, conflicts).

## Phase 4 - Finalization and Render

### 11. Render Pipeline
- [x] Implement render queue/job tracking.
- [x] Add output presets and subtitle burn-in toggle.
- [x] Add output file delivery and open-in-folder action.

### 12. Performance and Reliability
- [x] Add Metal/hardware acceleration diagnostics panel.
- [x] Add job retry + failure recovery paths.
- [x] Add telemetry for stage timings and failures.

### 13. Quality
- [x] Add unit tests for timeline time math and validators.
- [x] Add integration tests for `Start Editing` and `Edit Now`.
- [x] Add end-to-end test for full workflow.

## Blockers / Decisions Needed
- [x] Confirmed supported local model runtimes for v1 (`Ollama`, `whisper.cpp`, `faster-whisper`, `MLX`).
- [x] Confirmed Intel Mac launch support as secondary tier (`supported_with_limits`).

## Environment Notes
- Local runtime probe (2026-02-14):
  - `ollama`: not installed
  - `whisper.cpp`: not installed
  - `faster-whisper`: python available, package missing
  - `mlx`: not installed
- Build environment note:
  - `cargo check` for `src-tauri` requires crates.io network access and is currently blocked in this sandbox.
  - `cargo-tauri` is not installed yet on this machine (`cargo tauri` unavailable).
  - Current `ffmpeg` build in this environment lacks subtitle filter support (`subtitles` filter unavailable), so render falls back to non-burned output with warning.
  - External provider adapters require API keys (`PEXELS_API_KEY`, `PIXABAY_API_KEY`, `UNSPLASH_ACCESS_KEY`) for live downloads.

## Progress Log
- 2026-02-14: Created PRD with full architecture and workflow.
- 2026-02-14: Updated PRD for macOS `.dmg`, Metal optimization, and hybrid local/API model strategy.
- 2026-02-14: Initialized task list and marked kickoff as in progress.
- 2026-02-14: Selected Tauri as desktop shell and documented ADR (`docs/adr/0001-desktop-shell-tauri.md`).
- 2026-02-14: Added local runtime discovery script (`scripts/model_runtime_discovery.mjs`) with Ollama/whisper.cpp/faster-whisper/MLX probing.
- 2026-02-14: Added initial model install script (`scripts/model_runtime_install.mjs`) for Ollama model pulls.
- 2026-02-14: Executed runtime discovery on this Mac (arm64 Darwin) and captured current missing runtime state.
- 2026-02-14: Added local backend scaffold (`desktop/backend/server.mjs`) and `desktop:backend` script wiring.
- 2026-02-14: Added Tauri app scaffold (`src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json`).
- 2026-02-14: Added desktop bootstrap UI (`desktop/app/`) invoking `discover_models` and `install_model`.
- 2026-02-14: Ran syntax/format checks; `cargo check` blocked by network (crates.io unavailable in sandbox).
- 2026-02-14: Added project setup commands and UI wiring for create/list project flow.
- 2026-02-14: Extended desktop backend with project creation and settings persistence endpoints.
- 2026-02-14: Verified `cargo-tauri` is not installed yet; desktop Tauri commands require installation.
- 2026-02-14: Added media ingest script (`scripts/media_ingest.mjs`) with ffprobe metadata and optional ffmpeg proxy/waveform generation.
- 2026-02-14: Wired media ingest into Tauri command (`ingest_media`) and desktop backend route (`POST /media/ingest`).
- 2026-02-14: Added timeline domain persistence in Tauri (`create_rough_cut_timeline`, `get_timeline`, `save_timeline`).
- 2026-02-14: Added rough-cut timeline bootstrap UI and backend parity endpoints (`/timeline/*`).
- 2026-02-14: Wired `Start Editing` flow end-to-end in desktop shell (UI form, Tauri command, backend route, orchestration script).
- 2026-02-14: Upgraded start-editing orchestration to emit canonical transcript JSON + subtitle exports (`.srt`, `.vtt`) + cut plan artifacts.
- 2026-02-14: Added adapter selection logic for local/API/hybrid transcription paths with hybrid fallback behavior.
- 2026-02-14: Added `Edit Now` orchestration script (`scripts/edit_now_pipeline.mjs`) with template discovery + placement planning + timeline enrichment.
- 2026-02-14: Wired `Edit Now` into desktop backend (`POST /edit-now`), Tauri command (`edit_now`), and desktop UI.
- 2026-02-14: Added generated asset suggestion placeholders with default zoom effects and attribution metadata.
- 2026-02-14: Added render orchestration script (`scripts/render_pipeline.mjs`) that reads timeline and exports final MP4 to `desktop/data/<projectId>/renders/`.
- 2026-02-14: Wired render flow into desktop backend (`POST /render`), Tauri command (`render_video`), and desktop UI render form.
- 2026-02-14: Added render job tracking file (`render-job.json`) and quality/burn-subtitles options in CLI/API/UI.
- 2026-02-14: Refined desktop UI typography/spacing/padding to improve visual hierarchy and alignment.
- 2026-02-14: Added GitHub Actions macOS build workflow (`.github/workflows/macos-desktop-build.yml`) for `.app` and `.dmg` artifact generation.
- 2026-02-14: Validated end-to-end local flow: `Start Editing` -> `Edit Now` -> `Render` with generated output MP4.
- 2026-02-14: Added generated local overlay artifacts in `Edit Now` (`generated-overlays/*.ppm`) for template and stock placeholder clips.
- 2026-02-14: Upgraded render compositor to apply overlay clips on timeline intervals (`overlayAppliedCount` returned in render result).
- 2026-02-14: Added external media provider adapters (Pexels/Pixabay/Unsplash) with project-local stock cache + attribution metadata fallback handling.
- 2026-02-14: Added `fetchExternal` control across UI/backend/Tauri for `Edit Now` and validated graceful fallback when provider API keys are missing.
- 2026-02-14: Increased backend `Edit Now` orchestration timeout for slower provider fetch/download flows.
- 2026-02-14: Added render history persistence (`renders/history.json`) and retrieval flow in backend/Tauri/UI.
- 2026-02-14: Added timeline clip edit/delete controls in desktop UI for manual rough-cut adjustments before save/render.
- 2026-02-14: Added render output reveal action (`open_path` command + backend `POST /open-path` + desktop UI button).
- 2026-02-14: Added timeline split/ripple-delete operations with undo/redo stack and clip microsecond/frame inspector in desktop shell.
- 2026-02-14: Added `Edit Now` template constraint pass (overlap/bounds/text length) and validation warning generation.
- 2026-02-14: Added desktop AI decisions panel to review cut rationale, template placements, asset assignments, and warnings.
- 2026-02-14: Added timeline form controls to edit template clip content (`headline`/`subline`) before saving/rendering.
- 2026-02-14: Added project settings fields for fallback policy and per-task model assignment; wired those settings through Tauri/backend into `start_editing_pipeline` and `edit_now_pipeline`.
- 2026-02-14: Added hardware diagnostics command/script + desktop UI panel to inspect Metal support and ffmpeg videotoolbox readiness.
- 2026-02-14: Added shared pipeline telemetry tracking (`telemetry/events.jsonl`, `telemetry/summary.json`) across start-editing/edit-now/render flows.
- 2026-02-14: Added render/enrichment retry policies, retry metadata, and failure status propagation (`ROUGH_CUT_FAILED`, `ENRICHMENT_FAILED`, `RENDER_FAILED`) in backend/Tauri.
- 2026-02-14: Added desktop telemetry viewer (`Load Telemetry`) backed by `get_project_telemetry` command and backend parity route.
- 2026-02-14: Added strict schema validation layer (`scripts/lib/pipeline_schema.mjs`) and enforced validation in `start_editing_pipeline` and `edit_now_pipeline`.
- 2026-02-14: Added ffmpeg-backed silence detection and repeated-segment analysis in rough-cut planner to improve cut quality.
- 2026-02-14: Added timeline math/validator utility module for desktop shell and covered it with unit tests.
- 2026-02-14: Added integration and e2e automated tests covering `Start Editing`, `Edit Now`, and final render output.
- 2026-02-14: Expanded macOS release workflow with tests, optional notarization/stapling, and checksum artifact generation.
- 2026-02-14: Converted project setup into a 4-step wizard UI with back/next controls and final settings summary.
- 2026-02-14: Upgraded model discovery output with runtime compatibility metadata, task mapping, and recommended model statuses.
- 2026-02-14: Added install progress feedback in desktop shell and structured install output handling across backend/Tauri.
- 2026-02-14: Switched `Edit Now` template catalog discovery to registry-driven imports from `src/Root.tsx` with `registry.ts` category validation.
- 2026-02-14: Added visual timeline editor lanes with waveform/playhead and direct clip drag/trim with snapping controls.
- 2026-02-14: Added project resume selector and load action to repopulate project + pipeline forms from saved project settings.
- 2026-02-14: Added first-run checks script + desktop panel and documented platform support tiers (Apple Silicon primary, Intel secondary).
- 2026-02-14: Added auto first-run checks on shell launch with topbar status badges and new `npm run release:check` preflight.
- 2026-02-14: Added model runtime health probe script + `Run Health Check` UI action to validate runtime responsiveness before editing.
- 2026-02-14: Added timeline keyboard shortcut engine with safe focus handling and quick actions (nudge, split, trim, delete/ripple, snap toggle, undo/redo, save), plus desktop shortcut legend.
- 2026-02-14: Added `npm run templates:check` (`scripts/check_template_registration.mjs`) to ensure every `src/templates/**/*.tsx` file is imported in `src/Root.tsx` and registers itself.
- 2026-02-14: Integrated `templates:check` into `npm test` to enforce template registration coverage during routine test runs.
- 2026-02-14: Added `.github/workflows/quality-ci.yml` to enforce lint + template audit + test gates on push and pull requests.
- 2026-02-14: Updated `.github/workflows/macos-desktop-build.yml` to run lint and template audit before test/build stages.
- 2026-02-14: Added template quality audit command (`npm run templates:audit`) to scan every template for small-font, weak hierarchy, padding spread, and center-alignment density risks.
- 2026-02-14: Added persisted template audit baseline report (`docs/template-audit-baseline.md`) with top-priority template fixes queue.
- 2026-02-14: Remediated first template quality batch (hierarchy/padding/alignment tuning in 4 templates), reducing audit `needs_review` templates and refreshing baseline queue.
- 2026-02-14: Remediated second template quality batch (hero/quote/roi case-study typography normalization), moving 3 additional templates from `needs_review` to `ok`.
- 2026-02-14: Remediated third template quality batch (logo reveal + whoosh + bilingual outro spacing/hierarchy), bringing audit queue down again.
- 2026-02-14: Remediated fourth template quality batch (sticker/collage/headline hierarchy tuning), bringing audit queue down again.
- 2026-02-14: Remediated fifth template quality batch (light-leak/phone/proof tiles spacing + min-type fixes), bringing audit queue down again.
- 2026-02-14: Remediated sixth template quality batch (remaining social-hooks/startup-showcase/text-animation queue), resulting in full audit pass (`ok=59`, `needs_review=0`).
- 2026-02-14: Refreshed template audit baseline report to show an empty remediation queue and low-risk watchlist only.
- 2026-02-14: Added `npm run clean:workspace` (`scripts/clean_workspace.mjs`) and executed cleanup to remove stale generated test artifacts and render temp folders.
- 2026-02-14: Hardened project hygiene with expanded `.gitignore` and documented `desktop/data/` lifecycle + cleanup flow.
- 2026-02-14: Executed full workspace artifact reset (`npm run clean:workspace -- --all-project-data`), leaving `desktop/data/` with only tracked skeleton files.
- 2026-02-14: Applied lint hardening pass for template registry/background helper components and social-hooks texture styles; project lint now passes cleanly.
- 2026-02-14: Remediated seventh template quality batch (case-study + social-hooks low-risk templates), resulting in full static audit pass with zero issues (`high=0`, `medium=0`, `low=0`).
- 2026-02-14: Refreshed `docs/template-audit-baseline.md` to reflect zero-risk audit status across all 59 templates.
- 2026-02-14: Standardized package metadata for release tooling (`name`, `description`, `engines`) and added `npm run verify` + `npm run release:verify`.
- 2026-02-14: Added release documentation (`CHANGELOG.md`, `docs/release-checklist.md`) and linked it in root/docs indexes.
- 2026-02-14: Expanded `scripts/release_readiness_check.mjs` to validate quality CI workflow presence and release-safe package naming.
