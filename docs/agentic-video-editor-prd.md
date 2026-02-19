# Lapaas AI Editor PRD

## 1. Document Control
- `Document`: Product Requirements Document (PRD)
- `Product`: Lapaas AI Editor
- `Version`: v1.0
- `Date`: 2026-02-14
- `Owner`: Product + Engineering
- `Status`: Draft for implementation planning

## 1.1 Product Decisions (Locked on February 14, 2026)
- Supported local model runtimes for v1:
  - `Ollama` for local planner/reasoning tasks.
  - `whisper.cpp`, `faster-whisper`, and `MLX` paths for local transcription.
- Intel Mac support at launch:
  - `Supported with limits` (secondary tier).
  - Primary optimized path remains Apple Silicon + Metal.

## 2. Product Vision
Build an end-to-end AI-assisted editor where a user can upload a raw video, receive AI transcription and cut recommendations, review and adjust cuts in a timeline editor, automatically generate template/image/video overlays via AI, then render a final production-ready export. Product is macOS-first with native desktop distribution (`.dmg`) and Apple Silicon Metal acceleration.

## 3. Goals and Success Criteria

### 3.1 Primary Goals
- Reduce manual rough-cut time from hours to minutes.
- Produce a reviewable first cut with high-quality subtitles and clip segmentation.
- Automatically convert transcript + context into template-driven visual storytelling.
- Keep full human control via timeline editing before final render.
- Ship as a polished macOS desktop app (`.dmg`) under the product name `Lapaas AI Editor`.
- Optimize inference and media processing for Apple Silicon + Metal.
- Support hybrid AI runtime: local models first, API optional per task.

### 3.2 Business/UX Outcomes
- User can complete first publishable version in one session.
- User trusts AI suggestions but can override every decision.
- Result looks like professional short-form content (captions, B-roll, templates, motion).

### 3.3 Success Metrics
- Time to first cut (`TTFC`) < 3 min for 10-min source on standard hardware/API mode.
- Subtitle timestamp quality: >95% words aligned within 80ms.
- AI cut acceptance: >60% suggested cuts retained after user review.
- AI template plan acceptance: >50% placements kept with minor edits.
- End-to-end crash-free sessions >99%.
- Cold app startup on M-series Mac < 5s.
- Local model discovery success on supported runtimes > 99%.
- Metal-accelerated local transcription at >= 0.7x realtime on baseline M1.

## 4. Non-Goals (Phase 1)
- Multi-user real-time collaboration.
- Advanced VFX/compositing suite parity with pro NLEs.
- Full audio mastering (de-noise, EQ, LUFS normalization) beyond basic controls.
- Mobile-native editor app.

## 5. Target Users
- Content creators (YouTube Shorts, Reels, TikTok).
- Marketing teams creating promo/editorial videos.
- Founders/operators creating rapid social edits from long-form recordings.
- macOS creators who prefer offline/private local AI workflows.

## 6. Core User Journey (Requested Flow)
1. User creates a project.
2. User sets project settings (including AI mode: local/API/hybrid).
3. App scans locally installed models and shows compatible options.
4. User can install missing local models if needed.
5. User uploads source video.
6. User clicks `Start Editing`.
7. System transcribes video with AI and generates microsecond-level subtitle timestamps.
8. AI analyzes transcript/audio/visual flow and proposes cut ranges with timestamps.
9. System applies suggested cuts and opens timeline editor with generated clips.
10. User reviews, drag-drops, trims, and adjusts clips.
11. User clicks `Edit Now`.
12. System sends current transcript + available templates + timeline context to AI.
13. AI returns template placements + text content + media instructions.
14. System fetches external image/video assets (free providers), applies motion/zoom.
15. System builds enriched final timeline with clips/templates/assets.
16. User reviews and edits content/placements.
17. User clicks `Render`.
18. System renders and returns final output.

## 7. Scope and Requirements

## 7.1 Project Setup Module
### Functional Requirements
- Create project with:
  - name
  - aspect ratio (`16:9`, `9:16`)
  - fps
  - resolution preset (`1080p`, `4K`)
  - language
  - AI mode (`Local`, `API`, `Hybrid`)
  - per-task model selection (`transcription`, `cut-planner`, `template-planner`)
  - transcription mode (`Local`, `API`) with fallback strategy
  - target style (`news`, `case-study`, `social-hook`, etc.)
- Save project state and support resume.

### UX Requirements
- Wizard style:
  - Step 1: Project details
  - Step 2: Technical settings
  - Step 3: AI/transcription options
  - Step 4: local model selection/install
- Show estimated processing time/cost for local vs API.
- Show compatibility status for each selected local model/runtime.

## 7.2 Media Ingest Module
### Functional Requirements
- Upload local video files (MP4/MOV/WebM).
- Validate codec/container and max duration.
- Generate proxy preview and waveform.
- Extract basic metadata:
  - duration
  - width/height
  - fps
  - audio channels/sample rate

### Technical Notes
- Use ffmpeg/ffprobe for ingest validation.
- Persist source + proxy paths in project metadata.

## 7.3 AI Transcription Module
### Functional Requirements
- Triggered by `Start Editing`.
- Outputs:
  - full transcript
  - segment-level timestamps
  - word-level timestamps
  - subtitle chunks (SRT/VTT/JSON)
- Timestamp precision storage in microseconds (`int64`).

### Precision Requirement Clarification
- Internal canonical time unit: microseconds (`us`).
- Practical speech model accuracy is usually millisecond-level, not true acoustic microsecond accuracy.
- System stores microseconds for deterministic math and frame mapping; confidence metadata must expose actual model precision.

### Supported Modes
- `Local` mode:
  - faster-whisper / whisper.cpp / WhisperX alignment pipeline.
  - Metal-enabled backends preferred on Apple Silicon.
  - optional VAD for cleaner segmentation.
- `API` mode:
  - OpenAI/other STT provider.
  - normalized into common transcript schema.
- `Hybrid` mode:
  - attempt local model first
  - auto-fallback to API if model missing/unhealthy/user-disabled
  - explicit user override per pipeline stage

### Output Schema (Transcript)
- `transcript_id`
- `project_id`
- `language`
- `segments[]`:
  - `start_us`
  - `end_us`
  - `text`
  - `confidence`
  - `words[]`:
    - `text`
    - `start_us`
    - `end_us`
    - `confidence`

## 7.4 AI Cut Recommendation Module
### Objective
Suggest rough cut points that remove silence/redundancy/filler and improve pacing.

### Inputs
- transcript (segments + words)
- audio features (silence, energy)
- visual shot changes (optional)
- user target duration/style

### Outputs
- ordered cut actions:
  - `keep_range` or `remove_range`
  - `start_us`, `end_us`
  - rationale (`filler`, `pause`, `repetition`, `topic_shift`)
  - confidence

### Requirements
- Non-destructive editing: keep original media intact.
- Produce `AI Rough Cut v1` timeline automatically.
- Display rationale to build trust.

## 7.5 Timeline Editor Module (Post-Cut Review)
### Functional Requirements
- NLE-style tracks and clips view.
- Show:
  - source video track
  - caption track
  - future overlay tracks
  - audio waveform
- Supported operations:
  - drag clip
  - trim in/out
  - split clip
  - ripple delete
  - snap to playhead/clip edges
  - zoom timeline scale
  - undo/redo

### UX Requirements
- Side panel: `AI Decisions` list with jump-to-time.
- Clip inspector: precise start/end in `hh:mm:ss.ffffff`.
- Keyboard shortcuts for trim/split/playhead navigation.

## 7.6 Agentic Enrichment Module (`Edit Now`)
### Objective
Generate final visual storytelling plan using existing template library + external assets.

### Inputs
- current edited timeline (not initial raw timeline)
- current transcript
- template catalog from `src/templates/registry.ts`
- user style settings (tone/platform/brand colors)

### Outputs
- template placements:
  - template id
  - start/end timestamps
  - populated props/content
- asset placements:
  - external video/image query and selected asset IDs/URLs
  - track/layer placement
  - motion params (zoom/pan)
- subtitle styling directives where needed

### Rules
- AI must choose from real template IDs only.
- Placements cannot overlap illegally on protected tracks.
- Text length must respect per-template safe limits.
- If asset fetch fails, fallback to template-only layout.

## 7.7 External Asset Fetching Module
### Providers (Phase 1)
- Pexels (images/videos)
- Pixabay (images/videos)
- Unsplash (images)

### Functional Requirements
- Query by AI prompt + user override.
- Filter by orientation, duration, resolution, license metadata.
- Cache assets locally per project.
- Show attribution/license metadata in UI.

### Motion Requirements
- Every inserted image/video should support optional cinematic motion:
  - scale in/out
  - ken burns pan
  - subtle rotation (optional)
- Default effect intensity bounded to avoid motion sickness.

## 7.8 Final Review + Render Module
### Functional Requirements
- User can edit generated template content before render.
- Show pre-render validation:
  - missing assets
  - overflow text risk
  - timeline gap/overlap warnings
- Render queue with progress and retry.
- Export options:
  - resolution
  - codec
  - quality preset
  - burned-in subtitles on/off

### Technical
- Use Remotion render pipeline for final composition.
- Optional ffmpeg post-pass for packaging/thumbnail generation.

## 7.9 Local Model Discovery and Management Module
### Functional Requirements
- On app startup and settings page, discover locally installed model runtimes.
- Enumerate models and capabilities by task:
  - speech-to-text
  - reasoning/planning
  - template-content generation
- Allow user to:
  - select default model per task
  - install model
  - update model
  - remove model
  - test model health/latency

### Supported Runtime Targets (Phase 1)
- `Ollama` (local LLM runtime)
- `whisper.cpp` / `faster-whisper` for transcription
- `MLX` compatible models on Apple Silicon

### UX Requirements
- Show model status badges: `Installed`, `Not Installed`, `Incompatible`, `Needs Update`.
- Show disk size and estimated install time before installation.
- One-click fallback toggle: `Use API when local model unavailable`.

### Reliability Requirements
- If selected local model fails, workflow must continue via configured fallback.
- Persist failure reason and show clear remediation actions.

## 7.10 macOS Distribution and Packaging Module
### Functional Requirements
- Build distributable signed `.app` and `.dmg` for macOS.
- Support Apple Silicon as primary target.
- Optional Intel support as secondary target (product decision).

### Release Requirements
- Developer ID code signing.
- Apple notarization.
- Stapled notarization ticket on final `.dmg`.
- Versioned release artifacts and checksum generation.

### Installer Requirements
- First-run checks:
  - model runtime availability
  - ffmpeg availability (bundled or sidecar)
  - writable project/cache directories
- Guided install for required local runtimes/models.

## 8. System Architecture

## 8.1 High-Level Components
- `macOS Desktop App (Lapaas AI Editor)`:
  - project setup wizard
  - timeline editor UI
  - AI action panels
  - local model manager
- `Local Orchestrator`:
  - project management
  - AI workflow state machine
  - template/media planning
  - local/API routing logic per task
- `Processing Workers (local sidecars/background jobs)`:
  - transcription
  - cut analysis
  - asset fetching
  - render jobs
- `Storage`:
  - project metadata (JSON/DB)
  - media files
  - transcripts
  - generated timelines

## 8.2 Suggested Repo-Level Additions
- `src/desktop/`:
  - macOS app bootstrap, updater hooks, OS integration
- `src/agent/`:
  - orchestration logic, prompt builders, validators
- `src/editor/`:
  - timeline domain models + state reducers
- `src/models/`:
  - runtime discovery, install manager, health checks
- `src/server/` or separate service:
  - optional cloud endpoints (API mode)
- `docs/`:
  - architecture and operational docs

## 8.3 Orchestration State Machine
- `PROJECT_CREATED`
- `SETTINGS_SAVED`
- `MEDIA_UPLOADED`
- `TRANSCRIPTION_IN_PROGRESS`
- `TRANSCRIPTION_READY`
- `CUT_ANALYSIS_IN_PROGRESS`
- `ROUGH_CUT_READY`
- `USER_REVIEWING_CUTS`
- `ENRICHMENT_IN_PROGRESS`
- `ENRICHMENT_READY`
- `USER_FINAL_REVIEW`
- `RENDER_QUEUED`
- `RENDERING`
- `RENDER_DONE`
- `RENDER_FAILED`

## 8.4 Apple Silicon and Metal Optimization Strategy
- Prefer Metal-accelerated inference backends for local models.
- Use `whisper.cpp` Metal or MLX-compatible transcription backends when available.
- Use hardware encode/decode path (VideoToolbox via ffmpeg where applicable).
- Use proxy generation pipeline optimized for fast seek/scrub on M-series devices.
- Fallback to CPU path when Metal backend is unavailable, with explicit user notification.

## 9. Data Model (Core Entities)

## 9.1 Project
- `id`
- `name`
- `settings`:
  - `aspect_ratio`
  - `fps`
  - `resolution`
  - `language`
  - `transcription_mode`
  - `style_profile`
- `status`
- `created_at`, `updated_at`

## 9.2 SourceAsset
- `id`
- `project_id`
- `type` (`video`, `image`, `audio`)
- `path`
- `duration_us`
- `fps`
- `width`, `height`
- `metadata`

## 9.3 Transcript
- `id`
- `project_id`
- `engine` (`local_whisperx`, `api_openai`, etc.)
- `language`
- `segments[]`, `words[]`

## 9.4 Timeline
- `id`
- `project_id`
- `version`
- `tracks[]`
- `clips[]` (polymorphic):
  - `source_clip`
  - `template_clip`
  - `caption_clip`
  - `image_clip`
  - `video_overlay_clip`
  - `audio_clip`

## 9.5 Clip Common Fields
- `clip_id`
- `track_id`
- `start_us`
- `end_us`
- `source_ref`
- `transform` (position/scale/rotation)
- `effects` (zoom/pan/fade)
- `locked`

## 9.6 AIArtifacts
- `cut_recommendations`
- `template_plan`
- `asset_plan`
- `decision_explanations`
- `confidence_scores`

## 10. API Contracts (Draft)

## 10.1 Project
- `POST /api/projects`
- `PATCH /api/projects/:id/settings`
- `GET /api/projects/:id`

## 10.2 Media
- `POST /api/projects/:id/upload`
- `GET /api/projects/:id/assets`

## 10.3 AI Workflows
- `POST /api/projects/:id/start-editing`
  - enqueue transcription + cut analysis
- `GET /api/projects/:id/transcript`
- `GET /api/projects/:id/cut-plan`
- `POST /api/projects/:id/edit-now`
  - enqueue enrichment plan
- `GET /api/projects/:id/enrichment-plan`

## 10.4 Timeline
- `GET /api/projects/:id/timeline`
- `PATCH /api/projects/:id/timeline`
- `POST /api/projects/:id/timeline/validate`

## 10.5 Render
- `POST /api/projects/:id/render`
- `GET /api/projects/:id/render/:jobId/status`
- `GET /api/projects/:id/render/:jobId/output`

## 10.6 Model Management
- `GET /api/models/discover`
- `GET /api/models`
- `POST /api/models/install`
- `POST /api/models/uninstall`
- `POST /api/models/health-check`

## 11. AI Design and Guardrails

## 11.1 Prompting Strategy
- Structured JSON outputs only.
- Use schema validation for every AI response.
- Include hard constraints:
  - valid template IDs
  - valid timestamp ranges
  - max text lengths
  - non-overlap rules

## 11.2 Fallback Behavior
- If AI response invalid:
  - auto-repair attempt with validator feedback
  - fallback to safe defaults
  - preserve user’s existing timeline unchanged

## 11.3 Explainability
- Surface reasoning tags for each cut/template decision.
- Show confidence and allow one-click disable per suggestion.

## 12. Timeline Time Math and Precision
- Canonical timeline unit: microseconds (`int64`).
- Rendering unit: frames.
- Conversion:
  - `frame = round((time_us / 1_000_000) * fps)`
  - `time_us = round((frame / fps) * 1_000_000)`
- UI displays both:
  - frame index
  - `hh:mm:ss.ffffff`
- Prevent cumulative drift via canonical microseconds storage.

## 13. UX Specification

## 13.1 Main Screens
- Project Setup
- Upload + Preprocess
- Rough Cut Review (timeline)
- AI Enrichment Review
- Final Review + Render

## 13.2 Panels and Controls
- Left panel:
  - media bin
  - templates list
  - AI recommendations
- Center:
  - preview player
  - timeline
- Right panel:
  - inspector (clip/template/content/effects)

## 13.3 Buttons and Actions
- `Start Editing`:
  - transcription + cut generation
- `Edit Now`:
  - template and media enrichment
- `Render`:
  - final export

## 14. Performance Requirements
- Timeline should remain interactive for:
  - up to 60 minutes source
  - at least 500 clips/overlays
- Playhead scrub latency target:
  - <120ms perceived lag on standard dev machine
- Background processing should not block UI.
- On Apple Silicon baseline (M1, 16GB):
  - local transcription should complete 10-min clip in <= 15 min (non-realtime worst case)
  - rough-cut analysis should complete in <= 2 min after transcript ready
- Prefer Metal + hardware video acceleration whenever available.

## 15. Reliability and Observability
- Job queue with retries and dead-letter handling.
- Structured logs with `project_id` and `job_id`.
- Track per-stage timings:
  - transcription duration
  - cut analysis duration
  - enrichment duration
  - render duration
- Error dashboards and user-friendly failure messaging.

## 16. Security and Compliance
- Signed upload URLs or authenticated upload endpoint.
- Validate and sanitize external URLs.
- Respect provider license requirements and attribution.
- Encrypt API keys and secrets via env/secret manager.
- Optional data retention policy per project.
- macOS distribution security:
  - Developer ID signing
  - notarization and ticket stapling for `.dmg`
  - hardened runtime for shipped app binaries

## 17. Testing Strategy

## 17.1 Unit Tests
- timestamp conversion and frame mapping
- clip overlap/validation rules
- schema validators for AI JSON outputs

## 17.2 Integration Tests
- `Start Editing` full pipeline with fixture video.
- `Edit Now` plan generation using mocked AI outputs.
- asset fetch + timeline insertion.

## 17.3 End-to-End Tests
- create project -> upload -> start editing -> adjust timeline -> edit now -> render.
- verify exported output exists and timeline decisions applied.

## 18. Rollout Plan

## Phase 1: Foundation (Week 1-2)
- Desktop app shell for macOS and `.dmg` packaging pipeline.
- Project setup screens and persistence.
- Upload pipeline and media metadata extraction.
- Basic timeline engine and clip model.
- Local model discovery service and settings UI.

## Phase 2: Rough Cut AI (Week 3-4)
- Transcription module (local + API adapter).
- AI cut planner and rough cut generation.
- Review UI for cut accept/reject.
- Local model installer and health checks.

## Phase 3: Enrichment AI (Week 5-6)
- Template planner integrated with template registry.
- External asset fetchers (Pexels/Pixabay/Unsplash).
- Auto motion (zoom/pan) effects.

## Phase 4: Finalization (Week 7-8)
- Final review editor for generated content.
- Render orchestration + job status UI.
- QA hardening and performance tuning.
- Code signing, notarization, release `.dmg` automation.

## 19. Acceptance Criteria
- User can complete full workflow without leaving app.
- System always produces editable timeline after `Start Editing`.
- `Edit Now` produces a valid enriched timeline using real templates.
- User can manually override any AI-generated cut/template/content.
- `Render` exports a playable final video with expected overlays and motion.

## 20. Risks and Mitigations
- `Risk`: poor transcript alignment on noisy audio.
  - `Mitigation`: VAD + alignment model + confidence-based review flags.
- `Risk`: AI invalid timeline plans.
  - `Mitigation`: strict schema validation + repair loop + safe fallback.
- `Risk`: external provider latency/quotas.
  - `Mitigation`: caching + multi-provider fallback + user manual selection.
- `Risk`: timeline complexity hurts performance.
  - `Mitigation`: proxies, virtualization, memoized rendering.

## 21. Open Questions — Resolved (February 18, 2026)
- **Local transcription default or API?** → `Hybrid` mode is default. Local attempted first, API fallback if model unavailable.
- **Maximum supported source duration for v1?** → No hard limit enforced yet. Target: 60 min source (PRD §14).
- **Subtitles burned in or separate track?** → Both: optional burn-in flag on render + separate caption track in timeline.
- **Acceptable providers for commercial use?** → Pexels, Pixabay, Unsplash (all implemented in `edit_now_pipeline.mjs`).
- **Template usage priority by platform?** → Not yet implemented. Templates are selected by heuristic matching to transcript segments.
- **Intel Mac support at launch?** → Supported with limits (secondary tier). Primary path: Apple Silicon + Metal (§1.1 decision).
- **Supported local runtimes for v1?** → `Ollama`, `whisper.cpp`, `faster-whisper`, `MLX` (all discovered in `model_runtime_discovery.mjs`).
- **Model binaries bundled or post-install?** → Downloaded post-install. Model Manager UI provides download buttons. First-run checks guide user.

## 22. Immediate Engineering Next Steps (Updated February 18, 2026)
1. ~~Finalize canonical timeline schema (`us` + frame mapping).~~ ✅ Done — microsecond storage with frame conversion.
2. ~~Build `Start Editing` backend pipeline with transcript + cut outputs.~~ ✅ Done — `start_editing_pipeline.mjs` (1067 lines).
3. ~~Build `Edit Now` planner with template registry constraints.~~ ✅ Done — `edit_now_pipeline.mjs` (1404 lines).
4. ~~Integrate free asset provider adapters and motion defaults.~~ ✅ Done — Pexels/Pixabay/Unsplash adapters.
5. ~~Implement local model discovery/selection/install service.~~ ✅ Done — `model_runtime_discovery.mjs` (463 lines).
6. **Build rough-cut timeline UI with drag/trim/split.** 🔴 In Progress — timeline renders clips but lacks trim/split/undo.
7. **Finalize desktop architecture and `.dmg` pipeline.** 🔴 Tauri shell exists, build pipeline not verified.
8. **Add render queue, output delivery, and Metal/video-hardware acceleration.** 🟡 Render pipeline exists, no queue UI or progress streaming.
9. **Implement workflow orchestrator and job states.** 🟡 Pipeline stages exist but no formal state machine with persistence.

## 23. Implementation Status (February 18, 2026 Audit)

| Module | PRD Section | Status | Coverage |
|--------|:-----------:|--------|:--------:|
| Project Setup | §7.1 | Wizard collects settings; `handleSubmit` only sends name+fps (bug) | 🟡 60% |
| Media Ingest | §7.2 | Upload + ffprobe metadata works; no proxy/waveform generation | 🟡 65% |
| AI Transcription | §7.3 | whisper.cpp local adapter + SRT/VTT; API adapter is stub | 🟢 80% |
| AI Cut Recommendation | §7.4 | Silence + filler + repetition detection + Ollama; no per-cut review UI | 🟡 70% |
| Timeline Editor | §7.5 | Clip visualization + click-to-seek; **no trim/split/undo/zoom** | 🔴 25% |
| Agentic Enrichment | §7.6 | Template placement + constraint validation; no LLM integration | 🟡 55% |
| External Asset Fetching | §7.7 | All 3 providers + caching + retry; no UI for manual query override | 🟢 75% |
| Final Review + Render | §7.8 | ffmpeg segment render + overlay compositor; no render queue UI | 🟡 50% |
| Local Model Management | §7.9 | Discovery for 4 runtimes; UI only shows 2 hardcoded models | 🟡 55% |
| macOS Distribution | §7.10 | Tauri shell + notarize script; build pipeline untested | 🔴 20% |

### Key Files
- **Backend**: `desktop/backend/server.mjs` (820 lines)
- **Context/State**: `src/context/EditorContext.tsx` (875 lines)
- **Pipeline Scripts**: `scripts/start_editing_pipeline.mjs`, `edit_now_pipeline.mjs`, `render_pipeline.mjs`
- **Model Discovery**: `scripts/model_runtime_discovery.mjs`, `model_runtime_health.mjs`
- **Templates**: `src/templates/` (11 categories, 50+ templates, `registry.ts`)
- **Tests**: `tests/unit/`, `tests/integration/`, `tests/e2e/`
