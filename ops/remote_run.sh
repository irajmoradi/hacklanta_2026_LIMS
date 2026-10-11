#!/usr/bin/env bash
set -euo pipefail
exec python "$(dirname "$0")/runner/remote_run.py" "$@"
