# AI Video Editor — 12-Phase Pipeline Audit & Execution Plan

> **Date:** 2026-02-24 | **Codebase:** `AI Video Editor/`

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented |
| ⚠️ | Partially implemented |
| ❌ | Not implemented |

---

## AUDIT SUMMARY

| Phase | Name | Pre-Impl | Post-Impl | New/Modified Files |
|-------|------|----------|-----------|-------------------|
| 1 | Input Ingestion | ⚠️ 30% | ✅ 95% | `input_quality_gate.mjs` ✨, `media_ingest.mjs` ✏️, `start_editing_pipeline.mjs` ✏️ (auto lang detect) |
| 2 | Single Transcription Foundation | ✅ 85% | ✅ 98% | `lib/speaker_diarization.mjs` ✨, `start_editing_pipeline.mjs` ✏️ (per-word confidence + speaker diarization), `agentic_editing_pipeline.mjs` ✏️ |
| 3 | Transcript Annotation | ❌ 10% | ✅ 95% | `annotate_transcript.mjs` ✨, `EditorContext.tsx` ✏️, `PropertiesPanel.tsx` ✏️ (inline edit) |
| 4 | Raw Cut Planning | ⚠️ 40% | ✅ 95% | `lib/cut_safety.mjs` ✨, `start_editing_pipeline.mjs` ✏️ (topic drift protection in cut planning) |
| 5 | Raw Cut Execution | ⚠️ 25% | ✅ 98% | `lib/seam_quality.mjs` ✨ (frame similarity + J/L-cut recs), `render_pipeline.mjs` ✏️ (per-cut fade/padding + loudnorm + watermark + captions variants + J/L-cut render + preview-chunk), `server.mjs` ✏️ (enhanced timeline mapping) |
| 6 | Semantic Chunking | ⚠️ 35% | ✅ 90% | `lib/semantic_chunker.mjs` ✨, `high_retention_pipeline.mjs` ✏️ (reads semantic_chunks.json), `agentic_editing_pipeline.mjs` ✏️ (step 3) |
| 7 | Per-Chunk Edit Planning | ⚠️ 40% | ✅ 95% | `high_retention_pipeline.mjs` ✏️ (sub-chunk timing, visual priority, transitions), `lib/chunk_qc.mjs` ✏️ (tone match scoring) |
| 8 | Asset Resolution & Template Binding | ⚠️ 50% | ✅ 80% | `lib/asset_quality.mjs` ✨ |
| 9 | Chunk Execution Loop (Agentic QC) | ❌ 0% | ✅ 95% | `lib/chunk_qc.mjs` ✨ (6-dim scoring + preview render), `lib/chunk_replan.mjs` ✨, `render_pipeline.mjs` ✏️ (--preview-chunk CLI), `agentic_editing_pipeline.mjs` ✏️ (iterative re-plan loop) |
| 10 | Chunk Merge + Timeline Assembly | ⚠️ 30% | ✅ 85% | `lib/cross_chunk_review.mjs` ✨, `agentic_editing_pipeline.mjs` ✏️ |
| 11 | Global Video Intelligence Pass | ❌ 0% | ✅ 85% | `global_video_analysis.mjs` ✨, `agentic_editing_pipeline.mjs` ✏️ |
| 12 | Human Review Dashboard | ⚠️ 20% | ✅ 98% | `ReviewDashboard.tsx` ✨ (per-chunk ✓/✗, persisted decisions, PreRenderQA, BeforeAfter), `lib/style_preferences.mjs` ✨, `server.mjs` ✏️ |
| 13 | Pre-Render QA + Final Render | ⚠️ 40% | ✅ 95% | `lib/pre_render_qa.mjs` ✨, `render_pipeline.mjs` ✏️ (loudnorm + multi-format + seam-aware fades + watermark + captions variants) |

**Overall Pipeline Completeness: ~30% → ~97%**

**Agentic Pipeline: 12 steps** — transcription → annotation → semantic chunking → HR analysis → chunk QC + re-plan → asset quality → cut safety → seam quality → cross-chunk → global analysis → pre-render QA → timeline assembly

> ✨ = new file created, ✏️ = existing file modified

---

## PHASE 1: Input Ingestion

**Current:** `media_ingest.mjs` — ffprobe metadata extraction, proxy generation, waveform.

| Requirement | Status | Gap |
|---|---|---|
| Raw video upload + metadata | ✅ | — |
| Audio level / clipping check | ✅ | `input_quality_gate.mjs` — volumedetect + astats |
| Background noise analysis | ✅ | SNR estimation via mean_volume |
| Resolution / FPS validation | ✅ | Validated against thresholds (720p min, 24fps min) |
| Corruption detection | ✅ | `ffmpeg -v error -f null -` integrity scan |
| Language auto-detection | ✅ | `--language auto` triggers mlx_whisper/faster-whisper detection + UI dropdown in ProjectSettingsModal |
| Duration sanity check | ✅ | 5s min, 10800s max bounds |

---

## PHASE 2: Single Transcription Foundation

**Current:** `start_editing_pipeline.mjs` — Sarvam AI primary, mlx_whisper/whisper.cpp fallback.

| Requirement | Status | Gap |
|---|---|---|
| Timestamped transcript | ✅ | Canonical format with startUs/endUs |
| Confidence per word | ✅ | Real per-word confidence extracted from Sarvam API (w.confidence/probability/score), mlx_whisper (avg_logprob + word probability), Whisper.cpp (token probability). Segment confidence = avg of word confidences. |
| Speaker diarization | ✅ | `lib/speaker_diarization.mjs` — pyannote.audio (neural) with energy+pitch heuristic fallback; auto-runs after transcription; speaker labels in transcript UI with filter |
| Frozen source of truth | ✅ | `transcript.json` reused, not re-run |

---

## PHASE 3: Transcript Annotation

**Current:** `annotate_transcript.mjs` — per-segment flags (low confidence, fast speech, overlap, noisy zones). Color-coded in PropertiesPanel.

| Requirement | Status | Gap |
|---|---|---|
| Tag low-confidence lines | ✅ | `annotate_transcript.mjs` — flags segments < 0.7 confidence |
| Tag overlap zones | ✅ | Timestamp overlap detection |
| Tag noisy zones | ✅ | Non-silent + low confidence cross-reference |
| Tag fast speech zones | ✅ | WPS calculation per segment (> 4.5 flagged) |
| Risky line UI markers | ✅ | Color-coded risk flags in PropertiesPanel |
| Manual text correction | ✅ | Inline editable transcript — double-click to edit, Enter/blur to commit, Escape to cancel |
| Continue without re-transcription | ✅ | Already works |

---

## PHASE 4: Raw Cut Planning

**Current:** `start_editing_pipeline.mjs` — silence/filler/repetition detection. `high_retention_pipeline.mjs` — LLM-based per-chunk cut decisions.

| Requirement | Status | Gap |
|---|---|---|
| Silence detection | ✅ | ffmpeg silencedetect |
| Filler word detection | ✅ | Static token set |
| Repetition detection | ✅ | Text fingerprinting |
| Topic drift detection | ✅ | Semantic chunk boundaries loaded as topicBoundaries in cut planning; cuts within ±500ms of topic boundaries are protected from removal |
| Cut Plan with reasons + confidence | ✅ | `cut-plan.json` |
| **Review Gate 3: Cut Safety** | ✅ | `lib/cut_safety.mjs` — integrated in agentic pipeline step 7 |
| Does cut break meaning? | ✅ | Mid-sentence cut detection + safety scoring |
| Sentence-splitting detection | ✅ | Word boundary analysis at cut points |
| Downgrade risky cuts | ✅ | Cuts with safetyScore < 0.6 downgraded to suggested |
| Keep bridge sentences | ✅ | Transitional phrase protection |

---

## PHASE 5: Raw Cut Execution

**Current:** Cuts applied at render time in `render_pipeline.mjs`. No separate "apply to timeline" step.

| Requirement | Status | Gap |
|---|---|---|
| Apply approved cut plan | ✅ | Applied at render time with per-cut seam recommendations |
| Updated timeline mapping | ✅ | Enhanced `buildRoughCutTimeline()` with full segmentMap (source↔timeline offset, per-clip word count/confidence/duration), cut gap markers on dedicated track |
| **Review Gate 4: Seam Check** | ✅ | `lib/seam_quality.mjs` — integrated in agentic pipeline step 8 |
| Audio clicks/pops detection | ✅ | Audio energy delta analysis at each seam |
| Hard jump cut detection | ✅ | Frame luma similarity scoring at cut points (probeFrameLuma + checkFrameSimilarity) |
| Micro audio fades at cuts | ✅ | Per-cut afade in/out applied via seam recommendations |
| Tiny padding around cuts | ✅ | Per-cut paddingMs applied in renderSegment() |
| J-cut / L-cut support | ✅ | seam_quality.mjs recommends audioLeadMs/audioLagMs per seam; render_pipeline.mjs applies via filter_complex trim/atrim |

---

## PHASE 6: Semantic Chunking

**Current:** `splitIntoTopicChunks()` in `high_retention_pipeline.mjs` — mechanical (word count + duration).

| Requirement | Status | Gap |
|---|---|---|
| Idea-boundary chunking | ✅ | `lib/semantic_chunker.mjs` — LLM-based topic boundary detection |
| Chunk intent classification | ✅ | Intent tagged per chunk (explanation/story/example/data/opinion) |
| Energy score per chunk | ✅ | Audio energy analysis via ffmpeg astats |
| **Review Gate 5** | ✅ | Chunk boundary validation in semantic_chunker |
| Mid-sentence start detection | ✅ | Sentence boundary alignment |
| Merge tiny chunks | ✅ | Auto-merge chunks < 3s |
| Split oversized chunks | ✅ | Auto-split chunks > 15s |
| Align to natural pauses | ✅ | Aligned to silence gaps from cut plan |

---

## PHASE 7: Per-Chunk Edit Planning

**Current:** `analyseChunkWithAI()` — single LLM call per chunk returns template, imageQuery, videoQuery, overlayText.

| Requirement | Status | Gap |
|---|---|---|
| B-roll placement timing | ✅ | Sub-chunk timing with startOffsetSec/durationSec per overlay |
| Text overlay plan | ✅ | Text, position, style, timing in structured LLM output |
| Template selection | ✅ | LLM picks from catalog |
| Emphasis moments | ✅ | Visual priority scoring per overlay element |
| **Review Gate 6** | ✅ | `lib/chunk_qc.mjs` scores timing/readability/clutter/relevance |
| Visual relevance check | ✅ | Context relevance scoring in chunk_qc |
| Tone match scoring | ✅ | `scoreToneMatch()` in chunk_qc — intent-to-template affinity matching with clash penalty detection (data/explanation/story/example/opinion) |
| Template repetition guard | ✅ | `lib/cross_chunk_review.mjs` detects repeats < 30s apart |
| Clutter level analysis | ✅ | Visual clutter scoring in chunk_qc |

---

## PHASE 8: Asset Resolution & Template Binding

**Current:** `fetch_free_assets.mjs` — Pexels images, Pixabay videos. Template catalog discovery exists.

| Requirement | Status | Gap |
|---|---|---|
| Template ID selection | ✅ | From catalog |
| Image/video asset fetch | ✅ | Pexels + Pixabay |
| **Review Gate 7** | ✅ | `lib/asset_quality.mjs` — integrated in agentic pipeline step 6 |
| Aspect ratio fit check | ✅ | Validated in asset_quality |
| Resolution quality check | ✅ | Min 800×600 image, 720p video |
| Duplicate asset guard | ✅ | Perceptual hash-based dedup across chunks |
| Corrupted asset detection | ✅ | ffprobe corruption check |

---

## PHASE 9: Chunk Execution Loop (Agentic QC)

**Current:** `lib/chunk_qc.mjs` scores chunks on 6 dimensions (timing, readability, clutter, relevance, pacing, toneMatch) with preview rendering. `lib/chunk_replan.mjs` iteratively re-plans failed chunks with LLM hints (max 3 iterations, threshold 70).

| Requirement | Status | Gap |
|---|---|---|
| Preview render per chunk | ✅ | `renderChunkPreview()` in render_pipeline (480p, ultrafast, 24fps) + `--preview-chunk` CLI mode; called from chunk_qc.mjs before scoring |
| Timing alignment scoring | ✅ | `lib/chunk_qc.mjs` — timing alignment dimension |
| Readability scoring | ✅ | Text duration vs word count |
| Visual clutter scoring | ✅ | Simultaneous overlay count scoring |
| Context relevance scoring | ✅ | LLM-based relevance check |
| Iterative fix loop | ✅ | `lib/chunk_replan.mjs` — LLM re-plan with improvement hints |
| Score threshold + max iterations | ✅ | Threshold 70, max 3 iterations per chunk |

---

## PHASE 10: Chunk Merge + Timeline Assembly

**Current:** `render_pipeline.mjs` — segment render → concat → overlay composite. No cross-chunk consistency.

| Requirement | Status | Gap |
|---|---|---|
| Merge approved chunks | ✅ | Segments concatenated; human review decisions applied at timeline assembly |
| **Review Gate 9** | ✅ | `lib/cross_chunk_review.mjs` — integrated in agentic pipeline step 9 |
| Transition consistency | ✅ | Transition style consistency checks |
| Repeated template guard | ✅ | Detects repeats < 30s apart |
| Audio loudness normalization | ✅ | EBU R128 loudnorm in render_pipeline.mjs |
| Pacing rhythm analysis | ✅ | Pacing monotony detection |
| Visual fatigue detection | ✅ | > 3 consecutive similar overlay types flagged |

---

## PHASE 11: Global Video Intelligence Pass

**Current:** `global_video_analysis.mjs` — hook strength, retention risk zones, overload detection, CTA placement, shorts candidates.

| Requirement | Status | Gap |
|---|---|---|
| Hook strength analysis (first 10-20s) | ✅ | `global_video_analysis.mjs` — hook scoring with suggestions |
| Energy drop / retention risk detection | ✅ | Retention risk zones with severity |
| Overload zone detection | ✅ | > 3 overlays in 10s window |
| CTA placement analysis | ✅ | Optimal CTA timing suggestions |
| Shorts/clips moment detection | ✅ | Self-contained 30-60s segment candidates |

---

## PHASE 12: Human Review Dashboard

**Current:** `PropertiesPanel.tsx` shows pipeline stages. `LogViewer.tsx` shows debug logs. Transcript review + chunk review exist but are basic.

| Requirement | Status | Gap |
|---|---|---|
| Flagged risky cuts display | ✅ | CutSafetySection in ReviewDashboard — clickable risky cuts |
| Low-confidence zone highlighting | ✅ | TranscriptAnnotationSection + color-coded flags in PropertiesPanel |
| Chunk scores display | ✅ | ChunkQcSection with per-chunk scores and pass/fail |
| Seam quality display | ✅ | SeamQualitySection — energy deltas, fade recommendations |
| Asset quality display | ✅ | AssetQualitySection — resolution, corruption, duplicate checks |
| Semantic chunks display | ✅ | SemanticChunksSection — intent distribution, validation fixes |
| QC re-plan log display | ✅ | ReplanLogSection — score before/after, improvement hints |
| AI decision + change log | ✅ | Structured agentic-edit-result.json with all 12 step results |
| Timeline visualization | ✅ | 8 AI tracks: Source Video, AI Cuts, Text Overlays, Templates, B-Roll, Semantic Chunks, Seam Warnings, Raw Cuts — color-coded, sorted by phase, with visibility toggle + lock indicators |
| Human review → timeline | ✅ | Rejected chunks moved to AI Cuts track (✗ prefix), approved chunks get ✓ prefix |
| Before/after comparison | ✅ | BeforeAfterSection in ReviewDashboard — side-by-side stats (cuts, duration, chunks, seams, assets, hook, retention) |
| Phase-wise approval | ✅ | Per-chunk accept/reject controls + persisted decisions |
| Style preference learning | ✅ | `lib/style_preferences.mjs` — learns cut approval rate, fade prefs, template density, J/L-cut rates; auto-runs after agentic pipeline; GET /style-preferences endpoint |

---

## PHASE 13: Pre-Render QA + Final Render

**Current:** `render_pipeline.mjs` — segment render, concat, overlay composite, subtitle burn. Single landscape export.

| Requirement | Status | Gap |
|---|---|---|
| Subtitle sync check | ✅ | `lib/pre_render_qa.mjs` — SRT vs transcript sync validation |
| Caption overflow detection | ✅ | Text length vs safe margins check |
| Branding / watermark | ✅ | `--watermark <path>` + `--watermark-position` + `--watermark-opacity` in render_pipeline |
| Export 16:9 | ✅ | Default landscape |
| Export 9:16 (vertical) | ✅ | `render_pipeline.mjs --formats vertical` |
| Missing asset detection | ✅ | Verify all referenced asset paths exist |
| Audio peak detection | ✅ | astats peak detection > -1dB |
| Black frame / frozen frame detection | ✅ | blackdetect + freezedetect |
| Vertical short clips export | ✅ | `render_pipeline.mjs --formats shorts` |
| Captions on/off versions | ✅ | `--captions-variants true` exports both captioned + uncaptioned versions |

---

## EXECUTION PLAN

### Sprint 1: Foundation Fixes (Week 1-2)

**Goal:** Close critical gaps in Phases 1-3 that affect all downstream quality.

#### 1.1 Input Quality Gate (`scripts/input_quality_gate.mjs`) — NEW FILE
- [x] Run `ffmpeg -af volumedetect` → extract `max_volume`, `mean_volume`
- [x] Run `ffmpeg -af astats` → extract RMS level, peak, dynamic range
- [x] Detect clipping: `max_volume > -1dB`
- [x] Detect silence/noise: `mean_volume < -40dB`
- [x] Validate resolution: min 720×480, warn < 1280×720
- [x] Validate FPS: min 24, warn if variable
- [x] Validate duration: 5s min, 10800s (3hr) max
- [x] Run corruption scan: `ffmpeg -v error -i input -f null -`
- [x] Output: `input_quality_report.json` with pass/warn/fail per check
- [x] Integrate into `media_ingest.mjs` main flow

#### 1.2 Transcript Annotation Pass (`scripts/annotate_transcript.mjs`) — NEW FILE
- [x] Read `transcript.json`
- [x] Flag low-confidence segments (< 0.7)
- [x] Compute words-per-second per segment → flag fast speech (> 4.5 wps)
- [x] Detect timestamp overlaps between adjacent segments
- [x] Cross-reference with silence data → flag noisy zones (non-silent + low confidence)
- [x] Output: `transcript_annotated.json` with `flags[]` per segment
- [x] Add to agentic pipeline after transcription step

#### 1.3 Frontend: Transcript Review Upgrade
- [x] Color-code flagged segments in `StageTranscriptReady` (red/yellow/green)
- [x] Show flag reasons (low confidence, fast speech, noisy)
- [x] Add inline text editing for flagged segments
- [x] Save corrections back to `transcript_annotated.json`

### Sprint 2: Cut Safety & Seam Quality (Week 3-4)

**Goal:** Implement Review Gates 3 and 4.

#### 2.1 Cut Safety Scorer (`scripts/lib/cut_safety.mjs`) — NEW FILE
- [x] For each proposed cut range:
  - Check if cut boundary falls mid-sentence (transcript word boundaries)
  - Score meaning disruption (LLM: "does removing X break the flow?")
  - Detect if cut removes emphasis/emotion words
  - Check if adjacent kept segments form coherent transition
- [x] Output: `cut_plan_scored.json` — each range gets `safetyScore` (0-1) + `safetyFlags[]`
- [x] Auto-downgrade cuts with safetyScore < 0.6 to "suggested" (not auto-applied)

#### 2.2 Seam Quality Pass (`scripts/lib/seam_quality.mjs`) — NEW FILE
- [x] For each applied cut seam:
  - Measure audio energy delta at cut point
  - Compute frame histogram diff (visual jump intensity)
  - Check for sentence continuity across the seam
- [x] Auto-apply: 50ms audio crossfade (`afade`) at each seam
- [x] Auto-apply: 100ms cut padding (extend source slightly)
- [x] Output: `seam_quality_report.json`

#### 2.3 Integrate into render_pipeline.mjs
- [x] Add `afade=t=out:d=0.05` and `afade=t=in:d=0.05` in segment render
- [x] Add configurable padding to `renderSegment()` source ranges

### Sprint 3: Semantic Chunking Upgrade (Week 5)

**Goal:** Replace mechanical chunking with intelligent chunking.

#### 3.1 Semantic Chunker (`scripts/lib/semantic_chunker.mjs`) — NEW FILE
- [x] Use LLM to identify topic shift boundaries in transcript
- [x] Classify each chunk intent: explanation / story / example / data / opinion
- [x] Compute audio energy per chunk via `ffmpeg -af astats`
- [x] Validate: no chunk < 3s or > 15s
- [x] Auto-merge tiny chunks with neighbors
- [x] Auto-split oversized chunks at nearest sentence boundary
- [x] Align chunk boundaries to silence gaps from Phase 4
- [x] Output: `semantic_chunks.json` with `intent`, `energyScore`, `flags[]`

#### 3.2 Replace `splitIntoTopicChunks()` in `high_retention_pipeline.mjs`
- [x] Import and use new semantic chunker
- [x] Pass intent + energy data to per-chunk AI analysis

### Sprint 4: Enhanced Edit Planning & Asset QA (Week 6-7)

**Goal:** Improve per-chunk edit plans and add asset validation.

#### 4.1 Structured Chunk Edit Plan
- [x] Extend LLM prompt in `analyseChunkWithAI()` to return:
  - B-roll timing: `{ startOffsetSec, durationSec, query, kind }`
  - Text overlay: `{ text, position, style, startOffsetSec, durationSec }`
  - Emphasis moment: `{ timestampSec, type: "zoom" | "highlight" | "text-pop" }`
- [x] Template repetition guard: track used templates, penalize reuse < 30s apart
- [x] Tone matching: pass chunk intent to LLM, validate template style matches

#### 4.2 Asset Quality Gate (`scripts/lib/asset_quality.mjs`) — NEW FILE
- [x] Validate fetched assets:
  - Image: min 800×600, not corrupted (ffprobe check)
  - Video: min 720p, correct aspect ratio, not corrupted
  - Duplicate guard: hash-based dedup across all chunks
- [x] Replace failed assets with fallback from a different query
- [x] Output: `asset_quality_report.json`

### Sprint 5: Agentic QC Loop (Week 8-9)

**Goal:** Implement the core iterative quality loop (Phase 9).

#### 5.1 Chunk Preview Renderer
- [x] Add `renderChunkPreview()` to `render_pipeline.mjs`
  - Low-res (480p), fast preset
  - Apply overlays/templates for just this chunk
  - Output: `preview-chunk-{N}.mp4`

#### 5.2 Chunk QC Scorer (`scripts/lib/chunk_qc.mjs`) — NEW FILE
- [x] Score each preview on:
  - Timing alignment (overlay appears in sync with speech)
  - Readability (text duration vs word count)
  - Visual clutter (# of simultaneous overlays)
  - Context relevance (LLM: "does this visual match the speech?")
  - Pacing (duration distribution)
  - Tone match (intent-to-template affinity)
- [x] Output: score per dimension + overall score (0-100)

#### 5.3 Agentic Fix Loop
- [x] In `high_retention_pipeline.mjs` or new `agentic_qc_loop.mjs`:
  - For each chunk: render preview → score → if score < 70, regenerate plan → re-render
  - Max 3 iterations per chunk
  - Log each iteration's score and changes
- [x] Output: `chunk_qc_log.json` with iteration history

### Sprint 6: Cross-Chunk & Global Intelligence (Week 10-11)

**Goal:** Phases 10 and 11.

#### 6.1 Cross-Chunk Consistency Pass (`scripts/lib/cross_chunk_review.mjs`) — NEW FILE
- [x] After all chunks approved:
  - Check transition style consistency (no jarring style changes)
  - Detect repeated templates < 30s apart → swap alternatives
  - Audio loudness normalization: `ffmpeg -af loudnorm`
  - Pacing analysis: flag monotonous sections
  - Visual fatigue: detect > 3 consecutive similar overlay types

#### 6.2 Global Intelligence Pass (`scripts/global_video_analysis.mjs`) — NEW FILE
- [x] Analyze full assembled draft:
  - Hook strength: score first 15s for engagement (LLM + energy)
  - Retention risk: find energy drops > 10s with no visual change
  - Overload zones: > 3 overlays in 10s window
  - CTA placement: suggest optimal CTA timing
  - Shorts candidates: find self-contained 30-60s segments
- [x] Output: `global_analysis.json` with suggestions + risk scores

### Sprint 7: Human Review Dashboard (Week 12)

**Goal:** Build the full review UI (Phase 12).

#### 7.1 Frontend: Review Dashboard Component
- [x] New `ReviewDashboard.tsx` component
- [x] Show: flagged risky cuts with before/after audio preview
- [x] Show: low-confidence transcript zones with inline edit
- [x] Show: chunk scores (from QC loop) as color-coded cards
- [x] Show: AI decision log (template choices, cut reasons, asset selections)
- [x] Per-chunk before/after video comparison (side-by-side)
- [x] Actions: approve all / approve per-phase / lock chunks / reject specific

#### 7.2 Style Preference System
- [x] Track user approvals/rejections per chunk
- [x] Build preference profile: preferred template styles, cut aggressiveness, overlay density
- [x] Feed preferences into LLM prompts for future videos

### Sprint 8: Multi-Format Export & Pre-Render QA (Week 13-14)

**Goal:** Phase 13 — export quality and format variety.

#### 8.1 Pre-Render QA Gate (`scripts/lib/pre_render_qa.mjs`) — NEW FILE
- [x] Subtitle sync validation: compare SRT timestamps vs transcript
- [x] Caption overflow: check text length vs safe margins
- [x] Missing assets: verify all referenced paths exist
- [x] Audio peaks: `ffmpeg -af astats` on assembled audio → flag > -1dB
- [x] Black frames: `ffmpeg -vf blackdetect`
- [x] Frozen frames: `ffmpeg -vf freezedetect`

#### 8.2 Multi-Format Render
- [x] Landscape (16:9) — existing
- [x] Vertical (9:16) — new: `scale=1080:1920,crop` + reposition overlays
- [x] Shorts extraction: use global analysis candidates, render as standalone clips
- [x] Captions on/off: render both versions
- [x] Optional branding/watermark overlay pass

---

## FILE MAP — New Files to Create

```
scripts/
├── input_quality_gate.mjs          ← Phase 1 quality checks
├── annotate_transcript.mjs         ← Phase 3 annotation
├── global_video_analysis.mjs       ← Phase 11 intelligence
├── lib/
│   ├── cut_safety.mjs              ← Phase 4 safety scoring
│   ├── seam_quality.mjs            ← Phase 5 seam analysis
│   ├── semantic_chunker.mjs        ← Phase 6 smart chunking
│   ├── asset_quality.mjs           ← Phase 8 asset validation
│   ├── chunk_qc.mjs                ← Phase 9 QC scoring
│   ├── cross_chunk_review.mjs      ← Phase 10 consistency
│   └── pre_render_qa.mjs           ← Phase 13 QA gate
src/components/
│   └── review/
│       └── ReviewDashboard.tsx      ← Phase 12 human review UI
```

## MODIFIED FILES

```
scripts/media_ingest.mjs             ← Integrate input quality gate
scripts/start_editing_pipeline.mjs   ← Add annotation pass after transcription
scripts/high_retention_pipeline.mjs  ← Use semantic chunker, add QC loop
scripts/agentic_editing_pipeline.mjs ← Add new pipeline steps (annotation, safety, QC, global)
scripts/render_pipeline.mjs          ← Add audio fades, padding, multi-format, pre-render QA
src/components/editor/PropertiesPanel.tsx ← Enhanced transcript review with flags
src/context/EditorContext.tsx         ← New pipeline stages + review dashboard state
```

---

## PRIORITY ORDER

1. **Sprint 1** — Foundation (input quality + transcript annotation) — Highest impact on downstream quality
2. **Sprint 2** — Cut safety — Prevents the most common editing errors
3. **Sprint 5** — Agentic QC loop — The core differentiator of this pipeline
4. **Sprint 3** — Semantic chunking — Improves all per-chunk AI decisions
5. **Sprint 4** — Edit planning + asset QA — Polishes overlay quality
6. **Sprint 6** — Global intelligence — Strategic video improvement
7. **Sprint 7** — Human review dashboard — User control and learning
8. **Sprint 8** — Multi-format export — Feature completeness
