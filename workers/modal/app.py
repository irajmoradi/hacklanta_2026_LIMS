"""Village GPU worker on Modal: scale-to-zero L4 fallback for when the home RTX 5090 is off (MODAL-001 / R-100).

Same HTTP surface as workers/gpu/server.py for the stages the API/bridge need when the PC is off, in **transport mode**:
requests upload input bytes (photo / audio / face crop) as multipart, responses return the artifacts base64-encoded,
and the caller writes them into its own data/assets exactly where the local worker would. Shared-secret header X-GPU-Key.

  deploy:   bash workers/modal/wsl_modal.sh deploy workers/modal/app.py      (from the repo root, WSL)
  stop:     bash workers/modal/wsl_modal.sh app stop village-gpu
  weights:  Modal Volume "village-weights" (uploaded from local caches, see workers/modal/README.md)
  secret:   Modal Secret "village-gpu-key" with GPU_KEY=<random>; the API/bridge send it as X-GPU-Key.

GPU: L4 (24 GB) - our peaks are SAM 3 5.5 GB, LAM 4.7 GB, Audio2Expression 0.55 GB, Hunyuan3D 4.4 GB.
Cost guards: min_containers=0, scaledown_window=120 s, max_containers=1 per GPU class, timeout 600 s per call.
"""


import base64
import os
import time
from pathlib import Path

import modal

APP = "village-gpu"
WEIGHTS = "/weights"
L4_USD_PER_S = 0.80 / 3600          # Modal L4 list price ~$0.80/h (estimate; CPU/RAM of the GPU container adds ~10%)
CPU_USD_PER_S = 0.0000131 * 0.25    # gateway: 0.25 core (memory negligible)
WORKER_SRC = Path(__file__).resolve().parents[1] / "gpu"

app = modal.App(APP)
vol = modal.Volume.from_name("village-weights")
key_secret = modal.Secret.from_name("village-gpu-key")
GPU_KW = dict(gpu="L4", volumes={WEIGHTS: vol}, timeout=600, scaledown_window=120, min_containers=0, max_containers=1)

_worker_ignore = ["__pycache__", "tests", "render", "demo", "*.md", "scripts"]

# ---------------------------------------------------------------- images (pins = workers/gpu WSL envs)
sam_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git", "libgl1", "libglib2.0-0")
    .pip_install("torch==2.8.0", "torchvision==0.23.0", index_url="https://download.pytorch.org/whl/cu128")
    .run_commands("git clone https://github.com/facebookresearch/sam3.git /opt/sam3 && cd /opt/sam3 && "
                  "git checkout 0570b3a5be9c4e694f23d85232fb55f4a6f1f7fc && pip install -e .")
    .pip_install("setuptools<81", "numpy==1.26.4", "pillow==12.0.0", "einops==0.8.2", "pycocotools==2.0.11",
                 "huggingface_hub==0.36.0", "psutil==7.1.3", "timm==1.0.30", "iopath==0.1.10", "ftfy==6.1.1",
                 "regex==2025.11.3", "decord==0.6.0")
    .env({"HF_HOME": f"{WEIGHTS}/hf", "HF_HUB_OFFLINE": "1", "PYTHONPATH": "/opt/worker"})
    .add_local_dir(str(WORKER_SRC), "/opt/worker", ignore=_worker_ignore)
)

_LAM_PIP = ["pymcubes==0.1.6", "omegaconf==2.3.0", "moviepy==1.0.3", "pandas==2.2.3", "transformers==4.41.2",
            "numpy==1.23.0", "trimesh==4.4.9", "opencv-python-headless==4.11.0.86", "tensorflow==2.12.0",
            "face-detection-tflite==0.6.0", "scikit-image==0.20.0", "jax==0.4.30", "jaxlib==0.4.30",
            "huggingface_hub==0.23.2", "Cython==3.3.0", "accelerate==1.15.0", "tyro==1.0.16", "einops==0.8.2",
            "diffusers==0.32.2", "plyfile==1.1.3", "jaxtyping==0.3.7", "typeguard==4.6.0", "loguru==0.7.3",
            "ninja==1.13.2", "scipy==1.13.1", "safetensors==0.8.0", "pillow==10.4.0", "imageio==2.38.0",
            "imageio-ffmpeg==0.6.0",
            # Audio2Expression (same torch/py3.10; uses only Wav2Vec2 from transformers, fine with 4.41.2)
            "librosa==0.11.0", "addict==2.4.0", "yapf==0.40.1", "termcolor==3.3.0", "soundfile==0.13.1"]
lam_image = (
    modal.Image.from_registry("nvidia/cuda:12.8.1-cudnn-devel-ubuntu22.04", add_python="3.10")
    .apt_install("git", "ffmpeg", "libgl1", "libglib2.0-0", "libegl1", "build-essential", "wget")
    .env({"TORCH_CUDA_ARCH_LIST": "8.6;8.9", "FORCE_CUDA": "1", "MAX_JOBS": "8", "CUDA_HOME": "/usr/local/cuda",
          "TORCH_EXTENSIONS_DIR": "/opt/torch_ext",
          # Modal's add_python interpreter was built with clang; there is no clang in this image -> use GCC to link
          "CC": "gcc", "CXX": "g++", "LDSHARED": "g++ -pthread -shared"})
    .pip_install("torch==2.7.1", "torchvision==0.22.1", "torchaudio==2.7.1",
                 index_url="https://download.pytorch.org/whl/cu128")
    .run_commands(
        "git clone https://github.com/aigc3d/LAM.git /opt/LAM && cd /opt/LAM && git checkout 339573649dd93df4cba8093a964e85a80d1b61f3",
        "git clone https://github.com/aigc3d/LAM_Audio2Expression.git /opt/A2E && cd /opt/A2E && "
        "git checkout 02a703c3ea7d8e360eb43098eca85ee98a083529")
    .pip_install(*_LAM_PIP)
    .run_commands(
        "pip install --no-build-isolation chumpy==0.70",
        "git clone https://github.com/facebookresearch/pytorch3d.git /opt/ext/pytorch3d && cd /opt/ext/pytorch3d && "
        "git checkout 88e182f989c80836f4bd744e0d9cb1852762ce01 && pip install --no-build-isolation .",
        "git clone --recursive https://github.com/ashawkey/diff-gaussian-rasterization /opt/ext/dgr && cd /opt/ext/dgr && "
        "git checkout 8829d14f814fccdaf840b7b0f3021a616583c0a1 && "
        "sed -i '0,/#include/s//#include <cstdint>\\n#include/' cuda_rasterizer/rasterizer_impl.h && "
        "pip install --no-build-isolation .",
        "git clone https://github.com/camenduru/simple-knn /opt/ext/simple-knn && cd /opt/ext/simple-knn && "
        "git checkout 60f461f4a56b7967e5d8045bf92f8c33f36976d0 && "
        "(grep -q '<float.h>' simple_knn.cu || sed -i '0,/#include/s//#include <float.h>\\n#include/' simple_knn.cu) && "
        "pip install --no-build-isolation .",
        "pip install --no-build-isolation 'nvdiffrast@git+https://github.com/ShenhanQian/nvdiffrast@22718580f24a313c429ba2c304794c264351f108'",
        # pre-compile nvdiffrast's JIT plugin into the image so cold starts don't pay for it
        "python -c \"import nvdiffrast.torch as dr; dr._get_plugin()\" || true",
        "cd /opt/LAM/external/landmark_detection/FaceBoxesV2/utils && python build.py build_ext --inplace",
    )
    # runtime imports that the local env got transitively (via gradio); separate layer keeps the compiled exts cached
    .pip_install("matplotlib==3.10.9", "pyyaml==6.0.2", "patool==4.0.1")
    # MODAL-002: LAM head bake exports the OpenAvatarChat zip via the FBX SDK + headless Blender 4.0.2
    .apt_install("libxi6", "libxxf86vm1", "libxfixes3", "libxrender1", "libxkbcommon0", "libsm6", "libx11-6", "zip",
                 "xz-utils")
    .run_commands(
        "wget -q https://download.blender.org/release/Blender4.0/blender-4.0.2-linux-x64.tar.xz -O /tmp/b.tar.xz && "
        "tar -xf /tmp/b.tar.xz -C /opt && mv /opt/blender-4.0.2-linux-x64 /opt/blender && rm /tmp/b.tar.xz && "
        "/opt/blender/blender --background --version | head -1",
        "wget -q https://virutalbuy-public.oss-cn-hangzhou.aliyuncs.com/share/aigc3d/data/LAM/fbx-2020.3.4-cp310-cp310-manylinux1_x86_64.whl "
        "-O /tmp/fbx-2020.3.4-cp310-cp310-manylinux1_x86_64.whl && pip install /tmp/fbx-2020.3.4-cp310-cp310-manylinux1_x86_64.whl && "
        "python -c 'import fbx'")
    .env({"LAM_ROOT": "/opt/LAM", "A2E_ROOT": "/opt/A2E", "TORCH_HOME": f"{WEIGHTS}/torch", "BLENDER": "/opt/blender/blender",
          "TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD": "1", "PYTHONPATH": "/opt/worker", "NUMBA_THREADING_LAYER": "omp"})
    .add_local_dir(str(WORKER_SRC), "/opt/worker", ignore=_worker_ignore)
)
hy_image = (  # MODAL-002: Hunyuan3D-2mini shape + Paint-Turbo texture (pins = WSL env vcv-hy3d)
    modal.Image.from_registry("nvidia/cuda:12.8.1-cudnn-devel-ubuntu22.04", add_python="3.10")
    .apt_install("git", "libgl1", "libglib2.0-0", "libegl1", "build-essential")
    .env({"TORCH_CUDA_ARCH_LIST": "8.6;8.9", "FORCE_CUDA": "1", "MAX_JOBS": "8", "CUDA_HOME": "/usr/local/cuda",
          "CC": "gcc", "CXX": "g++", "LDSHARED": "g++ -pthread -shared"})
    .pip_install("torch==2.7.1", "torchvision==0.22.1", index_url="https://download.pytorch.org/whl/cu128")
    .pip_install("numpy==2.2.6", "transformers==4.51.3", "diffusers==0.33.1", "huggingface_hub==0.36.2",
                 "accelerate==1.15.0", "safetensors==0.8.0", "einops==0.8.2", "omegaconf==2.4.0", "tqdm==4.70.1",
                 "trimesh==5.1.1", "pygltflib==1.16.5", "xatlas==0.0.11", "opencv-python-headless==4.11.0.86",
                 "rembg==2.0.69", "onnxruntime==1.23.2", "pooch==1.9.0", "scikit-image==0.25.2", "scipy==1.15.3",
                 "fast_simplification==0.2.0", "pybind11==3.1.0", "ninja==1.13.2", "pillow==12.3.0", "httpx==0.28.1")
    .pip_install("wheel==0.45.1", "setuptools<81")  # --no-build-isolation needs bdist_wheel
    .run_commands(
        "git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git /opt/Hunyuan3D-2 && cd /opt/Hunyuan3D-2 && "
        "git checkout f8db63096c8282cb27354314d896feba5ba6ff8a && pip install --no-deps -e .",
        "cd /opt/Hunyuan3D-2/hy3dgen/texgen/custom_rasterizer && pip install --no-build-isolation .",
        "cd /opt/Hunyuan3D-2/hy3dgen/texgen/differentiable_renderer && python setup.py build_ext --inplace")
    # hy3dgen.shapegen imports pymeshlab at module load (we don't use its ply post-processors, see headmesh.py)
    .apt_install("libgomp1", "libglu1-mesa")
    .pip_install("pymeshlab==2025.7.post1")
    .env({"HY3D_ROOT": "/opt/Hunyuan3D-2", "HF_HOME": f"{WEIGHTS}/hf", "HF_HUB_OFFLINE": "1",
          "U2NET_HOME": f"{WEIGHTS}/u2net", "PYTHONPATH": "/opt/worker"})
    .add_local_dir(str(WORKER_SRC), "/opt/worker", ignore=_worker_ignore)
)
gw_image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi[standard]==0.115.6", "python-multipart==0.0.20")


def _b64_tree(root: Path) -> dict[str, str]:
    return {p.relative_to(root).as_posix(): base64.b64encode(p.read_bytes()).decode()
            for p in sorted(root.rglob("*")) if p.is_file()}


# ---------------------------------------------------------------- GPU classes
@app.cls(image=sam_image, **GPU_KW)
class SamWorker:
    @modal.enter()
    def load(self):
        import sys
        sys.path.insert(0, "/opt/worker")
        self.t_start = time.time()
        from segment import Segmenter
        self.seg = Segmenter()
        self.load_s = round(time.time() - self.t_start, 2)
        self.calls = 0

    @modal.method()
    def run(self, op: str, image: bytes, filename: str, params: dict) -> dict:
        import tempfile
        import items
        t0 = time.time()
        self.calls += 1
        work = Path(tempfile.mkdtemp())
        src = work / ("in" + (Path(filename).suffix or ".jpg"))
        src.write_bytes(image)
        out = work / "out"
        out.mkdir()
        if op == "segment":
            res = self.seg.run(str(src), str(out))
        elif op == "outfit":
            res = items.outfit(self.seg, str(src), str(out), params.get("slot") or "torso", params.get("prompt"))
        elif op == "object_cutout":
            res = items.object_cutout(self.seg, str(src), str(out), params.get("prompt"))
        else:
            raise ValueError(f"op {op} not supported on Modal")
        files = _b64_tree(out)
        res = _relativize(res, out)
        gpu_s = time.time() - t0 + (self.load_s if self.calls == 1 else 0)
        return {"result": res, "files": files, "cold": self.calls == 1, "model_load_s": self.load_s,
                "gpu_seconds": round(gpu_s, 2), "est_usd": round(gpu_s * L4_USD_PER_S, 4)}


@app.cls(image=lam_image, **GPU_KW)
class LamWorker:
    @modal.enter()
    def load(self):
        import sys
        sys.path.insert(0, "/opt/worker")
        t0 = time.time()
        # weights live on the Volume; LAM/A2E expect them inside their repos
        links = {"/opt/LAM/model_zoo": f"{WEIGHTS}/lam/model_zoo",
                 "/opt/LAM/assets/sample_motion/export/Look_In_My_Eyes": f"{WEIGHTS}/lam/assets/sample_motion/export/Look_In_My_Eyes",
                 "/opt/LAM/assets/sample_oac": f"{WEIGHTS}/lam/assets/sample_oac",
                 "/opt/A2E/pretrained_models": f"{WEIGHTS}/a2e/pretrained_models"}
        for dst, src in links.items():
            Path(dst).parent.mkdir(parents=True, exist_ok=True)
            if not os.path.lexists(dst):
                os.symlink(src, dst)
        from head import HeadBuilder
        from talk import TalkRenderer
        self.hb = HeadBuilder()
        self.talk = TalkRenderer(self.hb)
        from expr import ExprModel
        self.expr = ExprModel()
        self.load_s = round(time.time() - t0, 2)
        self.calls = 0

    @modal.method()
    def talk_video(self, face_png: bytes, audio: bytes, audio_name: str, max_seconds: float,
                   prep: bytes | None = None) -> dict:
        import subprocess
        import tempfile
        t0 = time.time()
        self.calls += 1
        work = Path(tempfile.mkdtemp())
        udir = work / "user"
        (udir / "head").mkdir(parents=True)
        face = udir / "face_512.png"
        face.write_bytes(face_png)
        if prep:
            (udir / "head" / "talk_prep.pt").write_bytes(prep)
        src = work / ("audio" + (Path(audio_name).suffix or ".mp3"))
        src.write_bytes(audio)
        wav = work / "a16k.wav"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-t", str(max_seconds), "-ac", "1",
                        "-ar", "16000", str(wav)], check=True)
        ej = work / "expr.json"
        t_e = time.time()
        self.expr.run(str(wav), str(ej))
        t_expr = round(time.time() - t_e, 2)
        out = work / "out.mp4"
        res = self.talk.run(str(face), str(ej), str(src), str(out), max_seconds)
        res["timing_s"] = {"expr": t_expr, **res.get("timing_s", {})}
        prep_out = udir / "head" / "talk_prep.pt"
        gpu_s = time.time() - t0 + (self.load_s if self.calls == 1 else 0)
        res.pop("video_path", None)
        return {"result": res, "video_b64": base64.b64encode(out.read_bytes()).decode(),
                "prep_b64": base64.b64encode(prep_out.read_bytes()).decode() if prep_out.is_file() else None,
                "cold": self.calls == 1, "model_load_s": self.load_s,
                "gpu_seconds": round(gpu_s, 2), "est_usd": round(gpu_s * L4_USD_PER_S, 4)}

    @modal.method()
    def head_bake(self, face_png: bytes) -> dict:
        """LAM-20K Gaussian head bake + OpenAvatarChat export (FBX SDK + headless Blender) -> head/ tree."""
        import tempfile
        t0 = time.time()
        self.calls += 1
        work = Path(tempfile.mkdtemp())
        face = work / "face_512.png"
        face.write_bytes(face_png)
        out = work / "head"
        res = self.hb.run(str(face), str(out), export=True)
        res.get("export", {}).pop("trace", None)
        gpu_s = time.time() - t0 + (self.load_s if self.calls == 1 else 0)
        return {"result": _relativize(res, out), "files": _b64_tree(out), "cold": self.calls == 1,
                "model_load_s": self.load_s, "gpu_seconds": round(gpu_s, 2), "est_usd": round(gpu_s * L4_USD_PER_S, 4)}




@app.cls(image=lam_image, **GPU_KW)
class ExprWorker:
    """Audio2Expression only (voice_expr jobs): ~0.5 GB VRAM, fast cold start (no LAM/TF/FLAME tracker)."""
    @modal.enter()
    def load(self):
        import sys
        sys.path.insert(0, "/opt/worker")
        t0 = time.time()
        if not os.path.lexists("/opt/A2E/pretrained_models"):
            os.symlink(f"{WEIGHTS}/a2e/pretrained_models", "/opt/A2E/pretrained_models")
        from expr import ExprModel
        self.expr = ExprModel()
        self.load_s = round(time.time() - t0, 2)
        self.calls = 0

    @modal.method()
    def expr_track(self, audio: bytes, audio_name: str) -> dict:
        import subprocess
        import tempfile
        t0 = time.time()
        self.calls += 1
        work = Path(tempfile.mkdtemp())
        src = work / ("audio" + (Path(audio_name).suffix or ".mp3"))
        src.write_bytes(audio)
        wav = work / "a16k.wav"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "16000", str(wav)],
                       check=True)
        out = work / "out"
        out.mkdir()
        meta = self.expr.run(str(wav), str(out / "line_expr.json"))
        gpu_s = time.time() - t0 + (self.load_s if self.calls == 1 else 0)
        return {"result": _relativize(meta, out), "files": _b64_tree(out), "cold": self.calls == 1,
                "model_load_s": self.load_s, "gpu_seconds": round(gpu_s, 2), "est_usd": round(gpu_s * L4_USD_PER_S, 4)}


@app.cls(image=hy_image, memory=32768, **GPU_KW)
class HyWorker:
    """Hunyuan3D-2mini-Turbo shape + Paint-Turbo texture. Input = an already-stylized image (the caller does Gemini +
    its cache, so no Gemini key lives on Modal). mode head (<=5k tris, villager_base Head space) | object (<=3k, 0.6 m)."""
    @modal.enter()
    def load(self):
        import sys
        sys.path.insert(0, "/opt/worker")
        t0 = time.time()
        from headmesh import HeadMesher
        self.mesher = HeadMesher(texture=True)
        self.load_s = round(time.time() - t0, 2)
        self.calls = 0

    @modal.method()
    def mesh(self, image: bytes, mode: str, max_faces: int) -> dict:
        import tempfile
        t0 = time.time()
        self.calls += 1
        work = Path(tempfile.mkdtemp())
        src = work / "stylized.png"
        src.write_bytes(image)
        out = work / "out"
        out.mkdir()
        if mode == "head":
            info = self.mesher.run(src, out / "head.glb", max_faces=max_faces or 5000)
        else:
            info = self.mesher.run(src, out / "object.glb", max_faces=max_faces or 3000, mode="object",
                                   rgba_name="stylized_rgba.png")
        gpu_s = time.time() - t0 + (self.load_s if self.calls == 1 else 0)
        return {"result": _relativize(info, out), "files": _b64_tree(out), "cold": self.calls == 1,
                "model_load_s": self.load_s, "gpu_seconds": round(gpu_s, 2), "est_usd": round(gpu_s * L4_USD_PER_S, 4)}


def _relativize(obj, root: Path):
    """Absolute container paths in results -> paths relative to the artifact root (caller re-roots them)."""
    r = str(root)
    if isinstance(obj, dict):
        return {k: _relativize(v, root) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_relativize(v, root) for v in obj]
    if isinstance(obj, str) and obj.startswith(r):
        return obj[len(r):].lstrip("/") or "."
    return obj


# ---------------------------------------------------------------- HTTP gateway (CPU, transport mode)
@app.function(image=gw_image, secrets=[key_secret], timeout=600, scaledown_window=120, min_containers=0,
              max_containers=2, cpu=0.25, memory=512)
@modal.concurrent(max_inputs=4)
@modal.asgi_app()
def web():
    import hmac
    import uuid as _uuid

    from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

    api = FastAPI(title="Village GPU worker (Modal, transport mode)")
    key = os.environ.get("GPU_KEY", "")

    def auth(x_gpu_key: str | None):
        if not key or not x_gpu_key or not hmac.compare_digest(x_gpu_key, key):
            raise HTTPException(401, "bad or missing X-GPU-Key")

    async def job(stage: str, user_id: str, fn):
        """fn() returns an awaitable (Modal .remote.aio) so long GPU calls never block the gateway's event loop."""
        t0 = time.time()
        try:
            out = await fn()
            out["gateway_s"] = round(time.time() - t0, 2)
            out["est_usd_total"] = round(out.get("est_usd", 0) + out["gateway_s"] * CPU_USD_PER_S, 4)
            return {"id": _uuid.uuid4().hex[:12], "stage": stage, "user_id": user_id, "status": "ready",
                    "transport": "inline-b64", **out}
        except Exception as e:  # report like the local worker's failed job (no tracebacks/paths)
            return {"id": _uuid.uuid4().hex[:12], "stage": stage, "user_id": user_id, "status": "failed",
                    "error": f"{type(e).__name__}: {str(e)[:300]}", "result": None}

    @api.get("/health")
    def health():
        return {"ok": True, "build": "modal-001", "mode": "modal", "transport": "inline-b64", "gpu": "L4",
                "stages": ["talk_video", "segment", "segment/group", "item/outfit", "item/object_cutout", "mesh",
                           "avatar/head", "avatar/body", "voice/expr"]}

    @api.post("/avatar/talk_video")
    async def talk_video(user_id: str = Form(...), max_seconds: float = Form(15.0), audio: UploadFile = File(...),
                         face: UploadFile = File(...), prep: UploadFile | None = File(None),
                         x_gpu_key: str | None = Header(None)):
        auth(x_gpu_key)
        a, f = await audio.read(), await face.read()
        p = await prep.read() if prep is not None else None
        ms = max(1.0, min(15.0, float(max_seconds)))
        return await job("talk", user_id, lambda: LamWorker().talk_video.remote.aio(f, a, audio.filename or "a.mp3", ms, p))

    @api.post("/segment")
    async def segment(user_id: str = Form(...), file: UploadFile = File(...), x_gpu_key: str | None = Header(None)):
        auth(x_gpu_key)
        b = await file.read()
        return await job("segment", user_id, lambda: SamWorker().run.remote.aio("segment", b, file.filename or "x.jpg", {}))

    @api.post("/item/outfit")
    async def item_outfit(owner: str = Form(...), item_job_id: str = Form(...), slot: str = Form("torso"),
                          prompt: str | None = Form(None), file: UploadFile = File(...),
                          x_gpu_key: str | None = Header(None)):
        auth(x_gpu_key)
        if slot not in ("torso", "head"):
            raise HTTPException(400, "slot must be torso|head")
        b = await file.read()
        return await job("item", owner, lambda: SamWorker().run.remote.aio("outfit", b, file.filename or "x.jpg",
                                                                  {"slot": slot, "prompt": prompt}))

    @api.post("/segment/group")
    async def segment_group(village_id: str = Form(...), group_job_id: str = Form(...), file: UploadFile = File(...),
                            x_gpu_key: str | None = Header(None)):
        auth(x_gpu_key)
        b = await file.read()
        return await job("segment", f"group:{village_id}", lambda: SamWorker().run.remote.aio("segment", b, file.filename or "x.jpg", {}))

    @api.post("/item/object_cutout")
    async def item_object_cutout(owner: str = Form(...), item_job_id: str = Form(...), prompt: str | None = Form(None),
                                 file: UploadFile = File(...), x_gpu_key: str | None = Header(None)):
        auth(x_gpu_key)
        b = await file.read()
        return await job("item", owner, lambda: SamWorker().run.remote.aio("object_cutout", b, file.filename or "x.jpg",
                                                                  {"prompt": prompt}))

    @api.post("/mesh")
    async def mesh(mode: str = Form(...), max_faces: int = Form(0), file: UploadFile = File(...),
                   x_gpu_key: str | None = Header(None)):
        """Stylized image -> Hunyuan3D GLB. mode=head (villager_base Head space) | object (0.6 m decoration)."""
        auth(x_gpu_key)
        if mode not in ("head", "object"):
            raise HTTPException(400, "mode must be head|object")
        b = await file.read()
        return await job("body" if mode == "head" else "item", mode, lambda: HyWorker().mesh.remote.aio(b, mode, max_faces))

    @api.post("/avatar/body")
    async def avatar_body(user_id: str = Form(...), stylized: UploadFile = File(...), x_gpu_key: str | None = Header(None)):
        """Transport mode: the caller sends the stylized head (Gemini runs on the caller's side, with its cache)."""
        auth(x_gpu_key)
        b = await stylized.read()
        return await job("body", user_id, lambda: HyWorker().mesh.remote.aio(b, "head", 5000))

    @api.post("/avatar/head")
    async def avatar_head(user_id: str = Form(...), file: UploadFile = File(...), x_gpu_key: str | None = Header(None)):
        auth(x_gpu_key)
        b = await file.read()
        return await job("head", user_id, lambda: LamWorker().head_bake.remote.aio(b))

    @api.post("/voice/expr")
    async def voice_expr(user_id: str = Form(...), line_id: str = Form(...), file: UploadFile = File(...),
                         x_gpu_key: str | None = Header(None)):
        auth(x_gpu_key)
        b = await file.read()
        return await job("expr", user_id, lambda: ExprWorker().expr_track.remote.aio(b, file.filename or "a.mp3"))

    return api
