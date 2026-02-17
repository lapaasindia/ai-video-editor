#!/usr/bin/env bash
set -euo pipefail

DMG_PATH="${1:-}"
APP_PATH="${2:-}"

if [[ -z "${DMG_PATH}" ]]; then
  echo "Usage: $0 <dmg-path> [app-path]"
  exit 1
fi

if [[ ! -f "${DMG_PATH}" ]]; then
  echo "DMG file not found: ${DMG_PATH}"
  exit 1
fi

submit_with_apple_id() {
  : "${APPLE_ID:?APPLE_ID is required when NOTARYTOOL_KEYCHAIN_PROFILE is not set}"
  : "${APPLE_TEAM_ID:?APPLE_TEAM_ID is required when NOTARYTOOL_KEYCHAIN_PROFILE is not set}"
  : "${APPLE_APP_PASSWORD:?APPLE_APP_PASSWORD is required when NOTARYTOOL_KEYCHAIN_PROFILE is not set}"

  xcrun notarytool submit "${DMG_PATH}" \
    --apple-id "${APPLE_ID}" \
    --team-id "${APPLE_TEAM_ID}" \
    --password "${APPLE_APP_PASSWORD}" \
    --wait
}

submit_with_keychain_profile() {
  : "${NOTARYTOOL_KEYCHAIN_PROFILE:?NOTARYTOOL_KEYCHAIN_PROFILE is required}"
  xcrun notarytool submit "${DMG_PATH}" \
    --keychain-profile "${NOTARYTOOL_KEYCHAIN_PROFILE}" \
    --wait
}

if [[ -n "${NOTARYTOOL_KEYCHAIN_PROFILE:-}" ]]; then
  echo "Submitting DMG for notarization using keychain profile..."
  submit_with_keychain_profile
else
  echo "Submitting DMG for notarization using Apple ID credentials..."
  submit_with_apple_id
fi

echo "Stapling DMG..."
xcrun stapler staple "${DMG_PATH}"
xcrun stapler validate "${DMG_PATH}" || true

if [[ -n "${APP_PATH}" && -d "${APP_PATH}" ]]; then
  echo "Stapling app bundle..."
  xcrun stapler staple "${APP_PATH}"
  xcrun stapler validate "${APP_PATH}" || true
fi

echo "Notarization and stapling completed."
