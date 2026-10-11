#!/usr/bin/env bash
# Audio2Expression env: conda "vcv-a2e" py3.10, torch 2.7.1+cu128 (no CUDA extensions needed) + weights.
set -eo pipefail
source "$(dirname "$0")/env.sh"
conda env list | grep -q '^vcv-a2e ' || conda create -y -n vcv-a2e python=3.10
conda activate vcv-a2e
python -c "import torch" 2>/dev/null || pip install torch==2.7.1 torchvision==0.22.1 torchaudio==2.7.1 --index-url https://download.pytorch.org/whl/cu128
cd $VCV_ROOT/repos/LAM_Audio2Expression
grep -v gradio requirements.txt > /tmp/a2e_req.txt
pip install -r /tmp/a2e_req.txt fastapi uvicorn python-multipart soundfile
if [ ! -d pretrained_models ]; then
  python "$WORKER_DIR/scripts/hf_dl.py" 3DAIGC/LAM_audio2exp ./
  tar -xzf LAM_audio2exp_assets.tar && rm -f LAM_audio2exp_assets.tar
  tar -xzf LAM_audio2exp_streaming.tar && rm -f LAM_audio2exp_streaming.tar
fi
ls . pretrained_models assets 2>/dev/null
python -c "import torch;print(torch.__version__, torch.cuda.is_available())"
