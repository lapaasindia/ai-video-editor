# ADR-0001: Desktop Shell Selection

## Status
Accepted

## Date
2026-02-14

## Context
Lapaas AI Editor is a macOS-first AI video editor that needs:
- low memory footprint
- strong performance on Apple Silicon
- ability to run local AI/model tooling and media pipelines
- `.dmg` distribution with signing/notarization
- reuse of existing React/TypeScript frontend work

We considered:
- Electron
- Tauri
- Fully native wrapper (SwiftUI + custom web/native integration)

## Decision
Use **Tauri** as the desktop shell.

## Rationale
- Tauri has substantially lower idle memory overhead than Electron in typical desktop app workloads.
- It fits a hybrid architecture: web UI + native/Rust process execution for heavy jobs.
- It aligns with macOS-first distribution via signed/notarized `.app` and `.dmg`.
- It allows us to keep the current React codebase while delegating heavy operations to native sidecars/services.

## Consequences
### Positive
- Better efficiency and battery/thermal behavior than Electron.
- Strong native integration path for local model management and system-level workflows.
- Good long-term foundation for Metal-optimized processing orchestration.

### Tradeoffs
- Some web features can behave differently on WebKit vs Chromium.
- We should keep render/transcription workloads in dedicated processes (not UI thread).
- Tauri app scaffolding and release automation must be set up explicitly.

## Implementation Notes
- UI remains React/TypeScript.
- Heavy tasks (transcription, model ops, rendering) run through background services/commands.
- Introduce runtime detection scripts and later wire them into desktop IPC APIs.

