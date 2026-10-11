#!/usr/bin/env bash
# usage: run_segment.sh <image> <sample_id> [repeat]
set -eo pipefail
source "$(dirname "$0")/env.sh"
conda activate vcv-sam3
python "$WORKER_DIR/segment.py" --image "$1" --out "$VILLAGE_DATA_DIR/assets/avatars/$2" --repeat "${3:-1}"
