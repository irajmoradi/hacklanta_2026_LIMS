#!/usr/bin/env bash
# LAM OpenAvatarChat export deps: portable Blender 4.0.2 (no sudo) + FBX SDK python wheel (cp310) into vcv-lam.
set -eo pipefail
source "$(dirname "$0")/env.sh"
mkdir -p $VCV_ROOT/software && cd $VCV_ROOT/software
if [ ! -x blender-4.0.2-linux-x64/blender ]; then
  wget -q https://download.blender.org/release/Blender4.0/blender-4.0.2-linux-x64.tar.xz
  tar -xf blender-4.0.2-linux-x64.tar.xz && rm blender-4.0.2-linux-x64.tar.xz
fi
echo "missing libs for blender:"; ldd blender-4.0.2-linux-x64/blender | grep "not found" || echo none
blender-4.0.2-linux-x64/blender --background --version 2>&1 | head -3
if [ "$1" != "blender-only" ]; then
  conda activate vcv-lam
  python -c "import fbx" 2>/dev/null || { [ -f fbx-2020.3.4-cp310-cp310-manylinux1_x86_64.whl ] || wget -q https://virutalbuy-public.oss-cn-hangzhou.aliyuncs.com/share/aigc3d/data/LAM/fbx-2020.3.4-cp310-cp310-manylinux1_x86_64.whl; pip install fbx-2020.3.4-cp310-cp310-manylinux1_x86_64.whl patool; }
  python -c "import fbx; print('fbx ok')"
fi
