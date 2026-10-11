#!/usr/bin/env bash
# Creates conda env "vcv-sam3" (py3.12, torch cu128 for Blackwell) and installs facebookresearch/sam3.
set -eo pipefail
source ~/miniconda3/etc/profile.d/conda.sh
ROOT=~/village-cv; mkdir -p $ROOT/repos $ROOT/checkpoints
cd $ROOT/repos
[ -d sam3 ] || git clone --depth 1 https://github.com/facebookresearch/sam3.git
conda env list | grep -q '^vcv-sam3 ' || conda create -y -n vcv-sam3 python=3.12
conda activate vcv-sam3
pip install --upgrade pip
pip install torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu128
pip install -e ./sam3
pip install "setuptools<81" fastapi uvicorn python-multipart pillow numpy huggingface_hub einops pycocotools decord psutil
python -c "import torch;print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_capability())"
