#!/usr/bin/env bash
# Start the GPU worker on 0.0.0.0:8100 (foreground). Ctrl-C stops it and its model children.
set -eo pipefail
source "$(dirname "$0")/env.sh"
conda activate vcv-sam3
cd "$WORKER_DIR"
exec python server.py
