#!/usr/bin/env bash
# usage: run_head.sh <face_512.png> <out_dir> [extra head.py args]
set -eo pipefail
source "$(dirname "$0")/env.sh"
conda activate vcv-lam
export CUDA_HOME=$CONDA_PREFIX TORCH_CUDA_ARCH_LIST=12.0
export CPATH=$CONDA_PREFIX/targets/x86_64-linux/include:$CPATH LIBRARY_PATH=$CONDA_PREFIX/targets/x86_64-linux/lib:$CONDA_PREFIX/lib:$LIBRARY_PATH
F=$(realpath "$1"); O=$(realpath -m "$2"); shift 2
python "$WORKER_DIR/head.py" --face "$F" --out "$O" "$@"
