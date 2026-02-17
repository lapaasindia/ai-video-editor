# Release Checklist

Use this checklist before shipping a macOS `.dmg` for Lapaas AI Editor.

## 1. Preflight

- Ensure Node 22+ and Rust toolchain are installed.
- Ensure `cargo tauri --version` works.
- Ensure Apple signing/notarization credentials are available:
  - Signing: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`
  - Notarization: `NOTARYTOOL_KEYCHAIN_PROFILE` or (`APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD`)
- Run:
  - `npm run release:check`
  - `npm run release:verify`

## 2. Build

- Build desktop artifacts:
  - `npm run desktop:tauri:build`
- Confirm outputs exist:
  - `src-tauri/target/release/bundle/dmg/*.dmg`
  - `src-tauri/target/release/bundle/macos/*.app`

## 3. Notarize and Staple

- Run:
  - `./scripts/macos_notarize_and_staple.sh /path/to/Lapaas_AI_Editor.dmg /path/to/Lapaas\ AI\ Editor.app`
- Confirm both DMG and app are stapled successfully.

## 4. Verify Artifact Quality

- Open `.dmg` on a clean macOS machine.
- Install and launch app.
- Validate first-run checks panel shows expected readiness.
- Execute smoke flow:
  1. Create project.
  2. Ingest a sample video.
  3. Run `Start Editing`.
  4. Run `Edit Now`.
  5. Render output and open in Finder.

## 5. Final Packaging Metadata

- Update `package.json` version.
- Update `CHANGELOG.md` release section.
- Ensure `docs/task-list.md` progress reflects release status.

## 6. Publish

- Upload artifacts (`.dmg`, zipped `.app`, checksums).
- Tag release in Git with matching version.
- Attach release notes from `CHANGELOG.md`.
