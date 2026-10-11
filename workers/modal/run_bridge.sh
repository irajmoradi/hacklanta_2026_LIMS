#!/usr/bin/env bash
# Avatar job bridge for a box WITHOUT a GPU (e.g. the Vultr VM): Postgres avatar_jobs -> Modal GPU -> data/assets.
# Must run on the SAME host as the API (it writes into the API's ASSET_DIR and talks to its DATABASE_URL).
#   bash workers/modal/run_bridge.sh            (needs: uv; repo-root .env with DATABASE_URL, GPU_FALLBACK_URL,
#                                                 GPU_FALLBACK_KEY or data/run/gpu_fallback.key, GOOGLE_API_KEY for stylize)
set -euo pipefail
cd "$(dirname "$0")/../.."
export GPU_WORKER_URL="${GPU_WORKER_URL-}"   # empty = Modal-only: never probe a local GPU
UV=$(command -v uv || echo "python3 -m uv")
exec $UV run --with "psycopg[binary]" --with httpx --with python-dotenv --with pillow \
  python workers/gpu/bridge.py "$@"
