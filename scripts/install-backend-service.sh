#!/usr/bin/env bash
# install-backend-service.sh
# Installs the Lapaas AI Editor backend as a macOS launchd service.
# It will auto-start on login and restart automatically if it crashes.
#
# Usage: bash scripts/install-backend-service.sh
# Uninstall: launchctl unload ~/Library/LaunchAgents/com.lapaas.editor.backend.plist

set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.lapaas.editor.backend.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

NODE_BIN="$(which node 2>/dev/null || true)"
if [ -z "$NODE_BIN" ]; then
    echo "❌ node not found in PATH. Install Node.js v22+ first." >&2
    exit 1
fi
NODE_BIN="$(cd "$(dirname "$NODE_BIN")" && pwd -P)/$(basename "$NODE_BIN")"

SERVER="$PROJECT_DIR/desktop/backend/server.mjs"
if [ ! -f "$SERVER" ]; then
    echo "❌ Backend script not found: $SERVER" >&2
    exit 1
fi

# Unload existing service if present
if launchctl list | grep -q "com.lapaas.editor.backend" 2>/dev/null; then
    echo "⏹  Stopping existing service..."
    launchctl unload "$PLIST" 2>/dev/null || true
fi

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.lapaas.editor.backend</string>

    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${SERVER}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/tmp/lapaas-backend.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/lapaas-backend.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$(dirname "$NODE_BIN"):/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF

launchctl load "$PLIST"
sleep 2

if curl -sf http://localhost:43123/health > /dev/null 2>&1; then
    echo "✅ Backend service installed and running on http://localhost:43123"
    echo "   Logs: tail -f /tmp/lapaas-backend.log"
    echo "   Stop: launchctl unload $PLIST"
else
    echo "⚠️  Service installed but backend not responding yet. Check logs:"
    echo "   tail -f /tmp/lapaas-backend.log"
fi
