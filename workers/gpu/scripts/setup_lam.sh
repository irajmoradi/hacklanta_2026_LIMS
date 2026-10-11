#!/usr/bin/env bash
# LAM env: conda "vcv-lam" py3.10, torch 2.7.1+cu128, conda cuda-toolkit 12.8 (no sudo), CUDA exts built for sm_120.
set -eo pipefail
source ~/miniconda3/etc/profile.d/conda.sh
ROOT=~/village-cv; LAM=$ROOT/repos/LAM; EXT=$ROOT/repos/ext; mkdir -p $EXT
step(){ echo; echo "=== [$(date +%T)] $*"; }
step env
conda env list | grep -q '^vcv-lam ' || conda create -y -n vcv-lam python=3.10
conda activate vcv-lam
if ! command -v nvcc >/dev/null; then
  step cuda-toolkit
  conda install -y -c nvidia/label/cuda-12.8.1 cuda-toolkit
fi
export CUDA_HOME=$CONDA_PREFIX
export CPATH=$CONDA_PREFIX/targets/x86_64-linux/include:${CPATH:-}
export LIBRARY_PATH=$CONDA_PREFIX/targets/x86_64-linux/lib:$CONDA_PREFIX/lib:${LIBRARY_PATH:-}
export TORCH_CUDA_ARCH_LIST="12.0" MAX_JOBS=16 FORCE_CUDA=1
nvcc --version | tail -2
step torch
python -c "import torch" 2>/dev/null || pip install torch==2.7.1 torchvision==0.22.1 torchaudio==2.7.1 --index-url https://download.pytorch.org/whl/cu128
step requirements
cd $LAM
head -n -4 requirements.txt > /tmp/lam_req.txt
grep -v chumpy /tmp/lam_req.txt > /tmp/lam_req2.txt
pip install -r /tmp/lam_req2.txt
pip install --no-build-isolation chumpy
pip install patool pathlib2 setuptools wheel
step pytorch3d
python -c "import pytorch3d" 2>/dev/null || { [ -d $EXT/pytorch3d ] || git clone --depth 1 https://github.com/facebookresearch/pytorch3d.git $EXT/pytorch3d; pip install --no-build-isolation $EXT/pytorch3d; }
step diff-gaussian-rasterization
if ! python -c "import diff_gaussian_rasterization" 2>/dev/null; then
  [ -d $EXT/diff-gaussian-rasterization ] || git clone --recursive https://github.com/ashawkey/diff-gaussian-rasterization $EXT/diff-gaussian-rasterization
  sed -i '0,/#include/s//#include <cstdint>\n#include/' $EXT/diff-gaussian-rasterization/cuda_rasterizer/rasterizer_impl.h
  pip install --no-build-isolation $EXT/diff-gaussian-rasterization
fi
step simple-knn
if ! python -c "import simple_knn" 2>/dev/null; then
  [ -d $EXT/simple-knn ] || git clone https://github.com/camenduru/simple-knn $EXT/simple-knn
  grep -q '<float.h>' $EXT/simple-knn/simple_knn.cu || sed -i '0,/#include/s//#include <float.h>\n#include/' $EXT/simple-knn/simple_knn.cu
  pip install --no-build-isolation $EXT/simple-knn
fi
step nvdiffrast
python -c "import nvdiffrast" 2>/dev/null || pip install --no-build-isolation "nvdiffrast@git+https://github.com/ShenhanQian/nvdiffrast@backface-culling"
step faceboxes
cd $LAM/external/landmark_detection/FaceBoxesV2/utils/ && python build.py build_ext --inplace && cd $LAM
step verify
python - <<'PY'
import torch, pytorch3d, diff_gaussian_rasterization, simple_knn, nvdiffrast, numpy
print("torch", torch.__version__, torch.version.cuda, torch.cuda.is_available(), torch.cuda.get_device_capability(), "numpy", numpy.__version__)
PY
