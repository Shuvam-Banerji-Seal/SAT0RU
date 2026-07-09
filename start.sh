#!/usr/bin/env bash
# ============================================================================
# SAT0RU - Start script
# ============================================================================
# Starts a local HTTP server (required for ES modules + webcam).
# Usage: ./start.sh [port]
# ============================================================================

set -euo pipefail

PORT="${1:-8000}"
DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill any existing process on the requested port.
if command -v fuser &>/dev/null; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
elif command -v lsof &>/dev/null; then
    lsof -ti tcp:"$PORT" | xargs kill -9 2>/dev/null || true
fi

sleep 0.5

# Check for a working HTTP server.
if command -v python3 &>/dev/null; then
    SERVER="python3 -m http.server"
elif command -v python &>/dev/null; then
    SERVER="python -m SimpleHTTPServer"
elif command -v npx &>/dev/null; then
    SERVER="npx serve -l"
    PORT="" # serve handles port via -l flag
else
    echo "Error: No HTTP server found. Install Python 3 or Node.js." >&2
    exit 1
fi

echo "SAT0RU — Cursed Technique Visualizer"
echo "======================================"
echo "Serving from: $DIR"
echo "URL:          http://localhost:${PORT:-8000}"
echo ""
echo "Press Ctrl+C to stop."
echo ""

# Open browser if available.
if command -v xdg-open &>/dev/null; then
    (sleep 1 && xdg-open "http://localhost:${PORT:-8000}") &
elif command -v open &>/dev/null; then
    (sleep 1 && open "http://localhost:${PORT:-8000}") &
fi

cd "$DIR"
if [[ -n "$PORT" ]]; then
    exec $SERVER "$PORT"
else
    exec $SERVER -l "$PORT"
fi
