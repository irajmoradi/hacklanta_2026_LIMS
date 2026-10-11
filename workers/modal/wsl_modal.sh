#!/usr/bin/env bash
# Run the Modal CLI inside WSL (weights live in WSL home). Uses the Windows token file in place: nothing is copied.
#   bash workers/modal/wsl_modal.sh <modal args...>
set -eo pipefail
source ~/miniconda3/etc/profile.d/conda.sh
conda env list | grep -q '^vcv-modal ' || conda create -y -q -n vcv-modal python=3.11 >/dev/null
conda activate vcv-modal
python -c "import modal" 2>/dev/null || pip install -q "modal==1.6.1"
export MODAL_CONFIG_PATH=${MODAL_CONFIG_PATH:-/mnt/c/Users/mourn/.modal.toml} MODAL_PROFILE=${MODAL_PROFILE:-irajjmoradi}
exec modal "$@"
