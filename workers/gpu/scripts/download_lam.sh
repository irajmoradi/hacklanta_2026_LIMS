#!/usr/bin/env bash
# Downloads LAM assets + LAM-20K weights into the LAM repo (paths are relative in LAM code).
set -eo pipefail
source "$(dirname "$0")/env.sh"
conda activate vcv-sam3   # any env with huggingface_hub
cd $VCV_ROOT/repos/LAM
if [ ! -d model_zoo/flame_tracking_models ]; then
  python "$WORKER_DIR/scripts/hf_dl.py" 3DAIGC/LAM-assets ./tmp
  tar -xf ./tmp/LAM_assets.tar && rm ./tmp/LAM_assets.tar
  tar -xf ./tmp/thirdparty_models.tar && rm -r ./tmp/
fi
python "$WORKER_DIR/scripts/hf_dl.py" 3DAIGC/LAM-20K ./model_zoo/lam_models/releases/lam/lam-20k/step_045500/
# Chatting-avatar export template (FBX template + animation.glb) for the OpenAvatarChat package
if [ ! -d assets/sample_oac ]; then
  wget -q https://virutalbuy-public.oss-cn-hangzhou.aliyuncs.com/share/aigc3d/data/LAM/sample_oac.tar -O /tmp/sample_oac.tar && tar -xf /tmp/sample_oac.tar -C assets/ && rm /tmp/sample_oac.tar
fi
ls model_zoo model_zoo/* assets
sha256sum model_zoo/lam_models/releases/lam/lam-20k/step_045500/model.safetensors
