#!/usr/bin/env bash
set -euo pipefail
exec /opt/village/prod-current/apps/api/.venv/bin/python "$(dirname "$0")/verify_prod.py" "$@"
