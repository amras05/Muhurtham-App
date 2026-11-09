#!/usr/bin/env bash
# ----------------------------------------------------------
# Muhurtham — dev server launcher (localhost, port 8555)
# Production runs the same app via Dockerfile / uvicorn.
# Usage:  ./start_dev.sh            (foreground)
#         ./start_dev.sh --reload   (restart by itself when Python code changes)
#         ./start_dev.sh --stop     (kill running instance)
# ----------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

if [[ "${1:-}" == "--stop" ]]; then
  pkill -f "uvicorn app.main:app --host 127.0.0.1 --port 8555" || true
  echo "dev server stopped"
  exit 0
fi

source .venv/bin/activate
cd backend
RELOAD=()
if [[ "${1:-}" == "--reload" ]]; then
  RELOAD=(--reload --reload-dir app)    # pages, CSS and JS need no restart (served fresh)
fi
exec uvicorn app.main:app --host 127.0.0.1 --port 8555 "${RELOAD[@]+"${RELOAD[@]}"}"
