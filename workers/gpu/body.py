"""CV-003 stage `body`: face_512.png (+traits) -> stylized_head.png (Gemini) -> head.glb (Hunyuan3D) for the
preset villager_base body. Runs inside the `vcv-hy3d` env (worker child kind "body").

Outputs in <out_dir> (= data/assets/avatars/<uid>/body/):
  stylized_head.png        Gemini chibi head (cached by face sha256 -> no repeat Gemini call on retries)
  stylized_head_rgba.png   background removed; doubles as the billboard "card" fallback
  head.glb (+ head.json)   <=5k-tri textured head in villager_base Head-bone space
  body.json                manifest-ready summary: {preset_id, head_glb, head_card, colors, timings, fallback?}
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import time
import traceback
from pathlib import Path

from stylize import OBJECT_PROMPT, OBJECT_PROMPT_VERSION, PROMPT_VERSION, stylize


class BodyBuilder:
    def __init__(self):
        self.mesher = None
        self.mesher_error = None
        try:
            from headmesh import HeadMesher
            self.mesher = HeadMesher(texture=True)
        except Exception as e:  # keep serving the card fallback even if the 3D generator can't load
            self.mesher_error = f"{type(e).__name__}: {e}"
            traceback.print_exc()

    def run(self, face: str, out_dir: str, traits: str | None = None) -> dict:
        out = Path(out_dir)
        out.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        timings = {}
        face_sha = hashlib.sha256(Path(face).read_bytes()).hexdigest()
        tr = json.loads(Path(traits).read_text()) if traits and Path(traits).is_file() else None
        styl = out / "stylized_head.png"
        meta_p = out / "stylize.json"
        meta = json.loads(meta_p.read_text()) if meta_p.is_file() else {}
        # global cache: the same face crop (e.g. same photo re-uploaded for another user) never costs a new Gemini call
        cache_dir = Path(os.environ.get("VILLAGE_DATA_DIR", Path(out_dir).parents[3])) / "cache" / "stylize"
        cached = cache_dir / f"{face_sha}-{PROMPT_VERSION}.png"  # prompt changes invalidate the cache
        if styl.is_file() and meta.get("face_sha256") == face_sha and meta.get("prompt_version") == PROMPT_VERSION:
            timings["stylize"] = 0.0
            stylize_info = {**meta, "cached": True}
        elif cached.is_file():
            shutil.copy(cached, styl)
            stylize_info = {"face_sha256": face_sha, "prompt_version": PROMPT_VERSION, "model": "cache", "seconds": 0.0, "cached": True}
            meta_p.write_text(json.dumps(stylize_info, indent=2))
            timings["stylize"] = 0.0
        else:
            s = stylize(face, styl, tr)
            stylize_info = {"face_sha256": face_sha, "prompt_version": PROMPT_VERSION, "model": s["model"], "seconds": s["seconds"], "cached": False}
            meta_p.write_text(json.dumps(stylize_info, indent=2))
            timings["stylize"] = s["seconds"]
            cache_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy(styl, cached)

        result = {"schema_version": 1, "preset_id": "villager_base", "stylized": str(styl),
                  "colors": (tr or {}).get("colors"), "stylize": stylize_info}
        try:
            if self.mesher is None:
                raise RuntimeError(f"3D generator unavailable: {self.mesher_error}")
            info = self.mesher.run(styl, out / "head.glb")
            result.update(head_glb=info["glb"], faces=info["faces"], peak_vram_gb=info["peak_vram_gb"],
                          head_card=str(out / "stylized_head_rgba.png"))
            timings.update({f"mesh_{k}": v for k, v in info["timing_s"].items()})
        except Exception as e:
            # Fallback: billboard card from the stylized image (background removed if possible).
            card = out / "stylized_head_rgba.png"
            if not card.is_file():
                from PIL import Image
                Image.open(styl).convert("RGBA").save(card)
            result.update(head_glb=None, head_card=str(card), fallback=f"card ({type(e).__name__}: {str(e)[:200]})")
        timings["total"] = round(time.time() - t0, 2)
        result["timing_s"] = timings
        (out / "body.json").write_text(json.dumps(result, indent=2))
        return result


    def object(self, cutout_white: str, out_dir: str, max_faces: int = 3000) -> dict:
        """Decoration: cutout (white bg) -> Gemini low-poly prop (cached by input sha) -> Hunyuan3D GLB <=3k tris."""
        out = Path(out_dir)
        out.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        timings = {}
        sha = hashlib.sha256(Path(cutout_white).read_bytes() + OBJECT_PROMPT_VERSION.encode()).hexdigest()
        cache_dir = Path(os.environ.get("VILLAGE_DATA_DIR", Path(out_dir).parents[3])) / "cache" / "stylize_object"
        cached = cache_dir / f"{sha}.png"
        styl = out / "stylized.png"
        if cached.is_file():
            shutil.copy(cached, styl)
            sinfo = {"input_sha256": sha, "model": "cache", "cached": True}
            timings["stylize"] = 0.0
        else:
            s = stylize(cutout_white, styl, None, prompt=OBJECT_PROMPT)
            cache_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy(styl, cached)
            sinfo = {"input_sha256": sha, "model": s["model"], "cached": False}
            timings["stylize"] = s["seconds"]
        if self.mesher is None:
            raise RuntimeError(f"3D generator unavailable: {self.mesher_error}")
        info = self.mesher.run(styl, out / "object.glb", max_faces=max_faces, mode="object", rgba_name="stylized_rgba.png")
        timings.update({f"mesh_{k}": v for k, v in info["timing_s"].items()})
        timings["total"] = round(time.time() - t0, 2)
        res = {"glb": info["glb"], "stylized": str(styl), "stylized_rgba": str(out / "stylized_rgba.png"),
               "faces": info["faces"], "bounds": info["bounds"], "stylize": sinfo,
               "peak_vram_gb": info["peak_vram_gb"], "timing_s": timings}
        (out / "object.json").write_text(json.dumps(res, indent=2))
        return res
