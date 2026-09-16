#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_host="${BACKEND_HOST:-127.0.0.1}"
backend_port="${BACKEND_PORT:-8765}"
frontend_host="${FRONTEND_HOST:-127.0.0.1}"
frontend_port="${FRONTEND_PORT:-5173}"

cd "$project_dir"
CHAT_INCLUDE_UI=false uv run uvicorn app.main:app --host "$backend_host" --port "$backend_port" &
backend_pid=$!

sleep 1
if ! kill -0 "$backend_pid" 2>/dev/null; then
  echo "❌ Error: Backend failed to start (e.g. port $backend_port might be in use, or syntax error)."
  exit 1
fi

cleanup() {
  kill -TERM "$backend_pid" 2>/dev/null || true
  wait "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$project_dir/web"
VITE_API_PROXY="http://${backend_host}:${backend_port}" \
  VITE_WATCH_POLLING=true \
  npm run dev -- --host "$frontend_host" --port "$frontend_port"
