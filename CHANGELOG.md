# Changelog

All notable changes to Lapaas AI Editor are documented here.

## [Unreleased]

### Added
- End-to-end desktop agentic pipeline: project setup, ingest, transcription, rough cut, enrichment, and render.
- Local model discovery/install/health tooling with local/API/hybrid execution paths.
- Timeline editing features: drag/trim/split/ripple-delete, undo/redo, keyboard shortcuts, and microsecond inspector.
- Template quality tooling:
  - `templates:check` for registration coverage,
  - `templates:audit` for typography/spacing/alignment scanning.
- CI hardening:
  - quality CI workflow (`lint`, template audit, tests),
  - strengthened macOS build workflow with lint + audit checks.
- Workspace hygiene tooling:
  - `clean:workspace` cleanup command,
  - documented desktop runtime data lifecycle.
- Release automation support:
  - notarization/stapling helper script,
  - release readiness diagnostics command.

### Changed
- Remediated all template quality audit findings across all 59 templates.
- Improved project organization and docs structure (`README`, `docs/README`, baseline/reporting docs).
- Updated package metadata and introduced `verify` / `release:verify` command flows.
