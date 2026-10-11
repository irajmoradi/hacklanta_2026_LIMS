#!/usr/bin/env bash
# Starts the Village API on PORT (default 8010; 8000 belongs to another project).
# Rolling restart with the existing Vite proxy (no process manager required):
#   PORT=8011 bash ops/run_api.sh & new_pid=$!
#   until curl --fail --silent http://127.0.0.1:8011/api/health >/dev/null; do
#     kill -0 "$new_pid" 2>/dev/null || exit 1
#     sleep 2
#   done
#   Restart Vite with VILLAGE_API_URL=http://127.0.0.1:8011, verify /api/health
#   through Vite, then stop the OLD API process using its known PID.
# Repeat using 8010 next time. Both servers must share DB/assets/env settings.
# The fixed proxy target requires a Vite restart; this is not zero-downtime routing.
set -euo pipefail
cd "$(dirname "$0")/../apps/api"
export VILLAGE_ENV_FILE="${VILLAGE_ENV_FILE:-$(cd ../.. && pwd)/.env}" UVICORN_LOOP=app.runtime:selector_loop
export ASSET_DIR="${ASSET_DIR:-$(cd ../.. && pwd)/data/assets}"
python -m uv sync --python 3.12 -q
python -m uv run python scripts/migrate.py
python -m uv run python scripts/seed.py
python -m uv run python scripts/sync_catalog.py
exec python -m uv run uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8010}" --no-proxy-headers
