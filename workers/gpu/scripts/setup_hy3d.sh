#!/usr/bin/env bash
# Hunyuan3D-2 env "vcv-hy3d" (py3.10, torch 2.7.1+cu128). CUDA exts (custom_rasterizer, mesh_processor) are built
# with the conda CUDA 12.8 toolkit that already lives in the vcv-lam env (no sudo, no second toolkit).
set -eo pipefail
source "$(dirname "$0")/env.sh"
TK=$HOME/miniconda3/envs/vcv-lam
conda env list | grep -q '^vcv-hy3d ' || conda create -y -n vcv-hy3d python=3.10
conda activate vcv-hy3d
python -c "import torch" 2>/dev/null || pip install torch==2.7.1 torchvision==0.22.1 --index-url https://download.pytorch.org/whl/cu128
cd $VCV_ROOT/repos/Hunyuan3D-2
pip install -r requirements.txt fastapi uvicorn httpx python-multipart pybind11
pip install -e .
# hy3dgen needs transformers>=4.48; >=~4.56 renamed Dinov2 attention keys (ckpt load fails). Pin a known-good set:
pip install "transformers==4.51.3" "diffusers==0.33.1" "huggingface_hub<1.0" fast_simplification
export CUDA_HOME=$TK PATH=$PATH:$TK/bin TORCH_CUDA_ARCH_LIST=12.0 MAX_JOBS=16
export CPATH=$TK/targets/x86_64-linux/include:$CPATH LIBRARY_PATH=$TK/targets/x86_64-linux/lib:$TK/lib:$LIBRARY_PATH
python -c "import custom_rasterizer" 2>/dev/null || (cd hy3dgen/texgen/custom_rasterizer && pip install --no-build-isolation .)
(cd hy3dgen/texgen/differentiable_renderer && python setup.py build_ext --inplace 2>&1 | tail -3 || true)
python - <<'PY'
import torch, custom_rasterizer, hy3dgen
print("torch", torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_capability())
try:
    from hy3dgen.texgen.differentiable_renderer import mesh_processor; print("mesh_processor ok")
except Exception as e: print("mesh_processor missing (python fallback used):", e)
PY
