#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
export HUIYAN_PROJECT_ROOT="${HUIYAN_PROJECT_ROOT:-$ROOT}"
export MMPOSE_ROOT="${MMPOSE_ROOT:-$(dirname "$ROOT")/mmpose}"
exec python -m uvicorn backend.api_server:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
