#!/usr/bin/env bash
# usage: run_headmesh.sh <stylized_head.png> <out head.glb> [<png> <glb> ...] — batch reuses loaded models
set -eo pipefail
source "$(dirname "$0")/env.sh"
conda activate vcv-hy3d
IMGS=(); OUTS=()
while [ $# -ge 2 ]; do IMGS+=("$(realpath "$1")"); OUTS+=("$(realpath -m "$2")"); shift 2; done
python "$WORKER_DIR/headmesh.py" --image "${IMGS[@]}" --out "${OUTS[@]}"
