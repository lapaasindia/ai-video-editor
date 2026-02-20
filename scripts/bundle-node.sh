#!/usr/bin/env bash
# bundle-node.sh — Copy the system Node.js binary into src-tauri/binaries/
# so Tauri can bundle it as a sidecar inside the .app.
#
# Run before: cargo tauri build
# Usage: bash scripts/bundle-node.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BINARIES_DIR="$ROOT/src-tauri/binaries"

mkdir -p "$BINARIES_DIR"

NODE_BIN="$(which node 2>/dev/null || true)"
if [ -z "$NODE_BIN" ]; then
    echo "❌ node not found in PATH. Install Node.js first." >&2
    exit 1
fi

# Resolve symlinks to get the real binary
NODE_REAL="$(realpath "$NODE_BIN")"

# Detect target triple
ARCH="$(uname -m)"
OS="$(uname -s)"
case "$OS-$ARCH" in
    Darwin-arm64)  TRIPLE="aarch64-apple-darwin" ;;
    Darwin-x86_64) TRIPLE="x86_64-apple-darwin" ;;
    Linux-x86_64)  TRIPLE="x86_64-unknown-linux-gnu" ;;
    Linux-aarch64) TRIPLE="aarch64-unknown-linux-gnu" ;;
    *)
        echo "❌ Unsupported platform: $OS-$ARCH" >&2
        exit 1
        ;;
esac

DEST="$BINARIES_DIR/node-$TRIPLE"
echo "📦 Copying Node.js $(node --version) → $DEST"
cp "$NODE_REAL" "$DEST"
chmod +x "$DEST"
echo "✅ Done ($(du -sh "$DEST" | cut -f1))"
