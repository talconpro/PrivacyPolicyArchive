#!/usr/bin/env sh
set -e

echo "[backend] running migrations..."
alembic upgrade head

if [ "${SEED_SAMPLE_DATA:-false}" = "true" ]; then
  echo "[backend] seeding sample data..."
  python scripts/seed_sample_data.py
fi

echo "[backend] starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
