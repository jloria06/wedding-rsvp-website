#!/usr/bin/env bash

set -euo pipefail

echo "Applying database migrations..."
python -m alembic upgrade head

echo "Starting Wedding RSVP API..."
exec python -m uvicorn app.main:app \
  --host "${HOST:-0.0.0.0}" \
  --port "${PORT:-8000}"
