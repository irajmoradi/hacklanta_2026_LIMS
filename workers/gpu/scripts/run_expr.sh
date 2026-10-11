#!/usr/bin/env bash
# usage: run_expr.sh <audio (any format)> <out_json> [repeat]   — converts to 16 kHz mono WAV first
set -eo pipefail
source "$(dirname "$0")/env.sh"
conda activate vcv-a2e
TMPW=$(mktemp --suffix=.wav); ffmpeg -loglevel error -y -i "$1" -ac 1 -ar 16000 "$TMPW"
python "$WORKER_DIR/expr.py" --wav "$TMPW" --out "$2" --repeat "${3:-1}"
rm -f "$TMPW"
