#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "EduTrack Mac Startup"
echo "===================="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node.js and retry."
  exit 1
fi

echo "Node: $(node -v)"

if command -v lsof >/dev/null 2>&1; then
  PORT_BACKEND="5000"
  PIDS_BACKEND="$(lsof -ti tcp:${PORT_BACKEND} || true)"
  if [[ -n "$PIDS_BACKEND" ]]; then
    echo "Port ${PORT_BACKEND} is busy. Stopping old process: $PIDS_BACKEND"
    kill -9 $PIDS_BACKEND || true
  fi
else
  echo "lsof not found. Skipping port cleanup and continuing startup."
fi

echo "Starting backend + frontend..."
exec npm run dev
