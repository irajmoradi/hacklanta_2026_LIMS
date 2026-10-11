# Source me (inside WSL). Sets paths + loads HF_TOKEN from repo-root .env without printing it.
source ~/miniconda3/etc/profile.d/conda.sh
export VCV_ROOT=${VCV_ROOT:-$HOME/village-cv}
export VILLAGE_REPO=${VILLAGE_REPO:-/mnt/c/Users/mourn/Downloads/hacklanta}
export VILLAGE_DATA_DIR=${VILLAGE_DATA_DIR:-$VILLAGE_REPO/data}
export HF_HOME=${HF_HOME:-$VCV_ROOT/hf_cache}
WORKER_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export WORKER_DIR
if [ -z "$HF_TOKEN" ] && [ -f "$VILLAGE_REPO/.env" ]; then
  HF_TOKEN=$(grep -E '^HF_TOKEN=' "$VILLAGE_REPO/.env" | head -1 | cut -d= -f2- | tr -d '\r"'"'"); export HF_TOKEN
fi
