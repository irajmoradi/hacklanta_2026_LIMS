"""CV-003 stage: head mesh — stylized_head.png -> low-poly textured head GLB fitted to villager_base's Head bone.

Generator: Hunyuan3D-2mini-Turbo (shape, 0.6B, FlashVDM) + Hunyuan3D-Paint-v2-0-Turbo (texture).
(TRELLIS.2 was the first choice but its image conditioner facebook/dinov3-vitl16-pretrain-lvd1689m is gated
behind manual approval and our HF token gets 403; see README.)

One heavy model on the GPU at a time: shape pipeline is moved back to CPU before texturing, and the paint
pipeline runs with diffusers model-CPU-offload (only the active sub-model is on the GPU).

Output space = villager_base.glb `Head` joint local space (joint at model (0, 1.13, 0), no rotation):
the preset head+hair occupies x ±0.32, y -0.03..0.73, z -0.27..0.35 in that space, face toward +Z.
We scale the generated head to HEAD_HEIGHT, put its bottom at HEAD_BOTTOM, center x/z, face +Z.
Web: hide preset nodes head/hair_cap/eye/eye.001/nose and add head.glb as a child of bone `Head`.

  python workers/gpu/headmesh.py --image .../stylized_head.png --out .../body/head.glb [--faces 5000]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

HY3D_ROOT = Path(os.environ.get("HY3D_ROOT", Path.home() / "village-cv/repos/Hunyuan3D-2"))
HEAD_HEIGHT = 0.76
HEAD_BOTTOM = -0.03
HEAD_CENTER_Z = 0.02
MAX_FACES = 5000
SEED = 1234
TEXTURE_PX = 1024  # paint bakes 2048^2; 1024 keeps head.glb ~0.6 MB for the village (5+ villagers on screen)


class HeadMesher:
    def __init__(self, texture: bool = True):
        sys.path.insert(0, str(HY3D_ROOT))
        import torch
        from hy3dgen.rembg import BackgroundRemover
        from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

        self.torch = torch
        t0 = time.time()
        self.rembg = BackgroundRemover()
        self.shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            "tencent/Hunyuan3D-2mini", subfolder="hunyuan3d-dit-v2-mini-turbo", use_safetensors=False, device="cuda")
        self.shape.enable_flashvdm(topk_mode="merge")
        self.shape.to("cpu")
        self.paint = None
        if texture:
            from hy3dgen.texgen import Hunyuan3DPaintPipeline
            self.paint = Hunyuan3DPaintPipeline.from_pretrained("tencent/Hunyuan3D-2",
                                                               subfolder="hunyuan3d-paint-v2-0-turbo")
            self.paint.enable_model_cpu_offload()
        torch.cuda.empty_cache()
        self.load_s = round(time.time() - t0, 2)

    def run(self, image_path: str | Path, out_glb: str | Path, max_faces: int = MAX_FACES,
            mode: str = "head", rgba_name: str = "stylized_head_rgba.png") -> dict:
        import numpy as np
        import trimesh
        from PIL import Image

        torch = self.torch
        out_glb = Path(out_glb)
        out_glb.parent.mkdir(parents=True, exist_ok=True)
        timings = {"model_load": self.load_s}
        peaks = {}
        t0 = time.time()

        img = Image.open(image_path).convert("RGB")
        img = self.rembg(img)  # RGBA cut-out
        img.save(out_glb.with_name(rgba_name))
        timings["rembg"] = round(time.time() - t0, 2)

        # --- shape (GPU) ---
        t1 = time.time()
        torch.cuda.reset_peak_memory_stats()
        self.shape.to("cuda")
        mesh = self.shape(image=img, num_inference_steps=5, octree_resolution=256, num_chunks=20000,
                          generator=torch.manual_seed(SEED), output_type="trimesh")[0]
        self.shape.to("cpu")
        torch.cuda.synchronize()
        peaks["shape"] = round(torch.cuda.max_memory_allocated() / 1e9, 2)
        torch.cuda.empty_cache()
        timings["shape"] = round(time.time() - t1, 2)
        raw_faces = int(len(mesh.faces))

        t2 = time.time()
        mesh = clean_and_decimate(mesh, max_faces)
        timings["decimate"] = round(time.time() - t2, 2)

        # --- texture (GPU, offloaded) ---
        textured = False
        if self.paint is not None:
            t3 = time.time()
            torch.cuda.reset_peak_memory_stats()
            mesh = self.paint(mesh, image=img)
            torch.cuda.synchronize()
            peaks["paint"] = round(torch.cuda.max_memory_allocated() / 1e9, 2)
            torch.cuda.empty_cache()
            timings["paint"] = round(time.time() - t3, 2)
            textured = True

        # --- normalize into Head-bone space ---
        mesh = normalize_head(mesh) if mode == "head" else normalize_object(mesh)
        shrink_texture(mesh, TEXTURE_PX)
        fix_material(mesh, out_glb.with_name(rgba_name))
        mesh.export(out_glb)
        timings["total"] = round(time.time() - t0, 2)
        info = {"schema_version": 1, "input": str(image_path), "glb": str(out_glb), "textured": textured,
                "faces": int(len(mesh.faces)), "raw_faces": raw_faces, "bounds": mesh.bounds.round(4).tolist(),
                "space": "villager_base Head joint local (+Y up, face +Z)" if mode == "head"
                         else f"decoration: fits a {OBJECT_SIZE} m cube, origin at base center, +Y up, front +Z",
                "generator": "Hunyuan3D-2mini-Turbo + Hunyuan3D-Paint-v2-0-Turbo",
                "timing_s": timings, "peak_vram_gb": peaks}
        out_glb.with_suffix(".json").write_text(json.dumps(info, indent=2))
        return info


def clean_and_decimate(mesh, max_faces: int):
    """Largest connected component + quadric decimation (trimesh/fast_simplification; hy3dgen's pymeshlab
    post-processors fail here with 'Unknown format for load: ply')."""
    import trimesh
    parts = mesh.split(only_watertight=False)
    if len(parts) > 1:
        mesh = max(parts, key=lambda m: len(m.faces))
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.remove_unreferenced_vertices()
    if len(mesh.faces) > max_faces:
        mesh = mesh.simplify_quadric_decimation(face_count=max_faces)
    return trimesh.Trimesh(mesh.vertices, mesh.faces, process=True)


def shrink_texture(mesh, px: int):
    from PIL import Image
    mat = getattr(getattr(mesh, "visual", None), "material", None)
    if mat is None:
        return mesh
    for attr in ("baseColorTexture", "image"):
        img = getattr(mat, attr, None)
        if isinstance(img, Image.Image) and max(img.size) > px:
            setattr(mat, attr, img.resize((px, px), Image.LANCZOS))
    return mesh


def fix_material(mesh, ref_rgba=None, max_gain: float = 1.35):
    """Exported PBR material has no metallicFactor (glTF default = 1.0 -> renders near-black without an env map).
    Make it a matte dielectric, and lift the (de-lit, darker) baked texture toward the stylized image's mean color."""
    import numpy as np
    from PIL import Image
    mat = getattr(getattr(mesh, "visual", None), "material", None)
    if mat is None or not hasattr(mat, "baseColorTexture"):
        return {}
    mat.metallicFactor = 0.0
    mat.roughnessFactor = 0.9
    gain = [1.0, 1.0, 1.0]
    tex = mat.baseColorTexture
    if tex is not None and ref_rgba is not None and Path(ref_rgba).is_file():
        t = np.asarray(tex.convert("RGB")).astype(np.float32)
        valid = t.reshape(-1, 3)[t.reshape(-1, 3).sum(1) > 15]
        r = np.asarray(Image.open(ref_rgba).convert("RGBA")).reshape(-1, 4).astype(np.float32)
        r = r[r[:, 3] > 200][:, :3]
        if len(valid) and len(r):
            gain = np.clip(r.mean(0) / np.maximum(valid.mean(0), 1), 1.0, max_gain)
            mode = tex.mode
            out = np.clip(t * gain, 0, 255).astype(np.uint8)
            img = Image.fromarray(out, "RGB")
            if mode == "RGBA":
                img.putalpha(tex.getchannel("A"))
            mat.baseColorTexture = img
            gain = [round(float(g), 3) for g in gain]
    return {"metallic": 0.0, "roughness": 0.9, "gain": gain}


OBJECT_SIZE = 0.6


def normalize_object(mesh, size: float = OBJECT_SIZE):
    """Decoration space: largest dimension = size (fits a size-m cube), centered on x/z, bottom at y=0."""
    import numpy as np
    lo, hi = mesh.bounds
    scale = size / float((hi - lo).max())
    center = (lo + hi) / 2
    T = np.eye(4)
    T[:3, :3] *= scale
    T[:3, 3] = [-center[0] * scale, -lo[1] * scale, -center[2] * scale]
    mesh.apply_transform(T)
    return mesh


def normalize_head(mesh):
    """Hunyuan3D output is +Y up, roughly unit-cube centered, front toward +Z (verified on renders)."""
    import numpy as np
    lo, hi = mesh.bounds
    scale = HEAD_HEIGHT / float(hi[1] - lo[1])
    center = (lo + hi) / 2
    T = np.eye(4)
    T[:3, :3] *= scale
    T[:3, 3] = [-center[0] * scale, HEAD_BOTTOM - lo[1] * scale, HEAD_CENTER_Z - center[2] * scale]
    mesh.apply_transform(T)
    return mesh


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", nargs="+", required=True)
    ap.add_argument("--out", nargs="+", required=True)
    ap.add_argument("--faces", type=int, default=MAX_FACES)
    ap.add_argument("--no-texture", action="store_true")
    ap.add_argument("--shrink-only", action="store_true", help="just cap textures of existing --out GLBs")
    ap.add_argument("--fix-only", action="store_true", help="just fix material/brightness of existing --out GLBs")
    a = ap.parse_args()
    if a.fix_only:
        import trimesh
        for out in a.out:
            m = trimesh.load(out, force="mesh")
            info = fix_material(m, Path(out).with_name("stylized_head_rgba.png"))
            m.export(out)
            print(out, info)
        return 0
    if a.shrink_only:
        import trimesh
        for out in a.out:
            m = trimesh.load(out, force="mesh")
            shrink_texture(m, TEXTURE_PX)
            m.export(out)
            print(out, Path(out).stat().st_size)
        return 0
    m = HeadMesher(texture=not a.no_texture)
    for img, out in zip(a.image, a.out):
        info = m.run(img, out, a.faces)
        print(json.dumps({k: info[k] for k in ("glb", "faces", "raw_faces", "textured", "timing_s", "peak_vram_gb")}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
