"""Stage 2 — LAM-20K Gaussian head from face_512.png (headless version of LAM's app_lam.py core_fn).

Outputs into --out (e.g. data/assets/avatars/<id>/head/):
  offset.ply            canonical Gaussian head (LAM "offset2xyz" ply; what the OAC/WebGL renderer loads)
  ref.png               masked/aligned input LAM actually saw
  preview.mp4 + frames/ LAM-rendered frames driven by a bundled sample FLAME motion (proof the head animates)
  <id>.zip              OpenAvatarChat/LAM_WebRender package (skin.glb, offset.ply, animation.glb,
                        vertex_order.json) — only if Blender + fbx SDK are available (--export)
  head.json             manifest: timings, peak VRAM, paths, export status/error

Run in `vcv-lam` env (WSL). The LAM code uses repo-relative paths, so we chdir into the LAM repo.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
import time
import traceback
from pathlib import Path

LAM_ROOT = Path(os.environ.get("LAM_ROOT", Path.home() / "village-cv/repos/LAM"))
BLENDER = Path(os.environ.get("BLENDER", Path.home() / "village-cv/software/blender-4.0.2-linux-x64/blender"))
MODEL_NAME = "./model_zoo/lam_models/releases/lam/lam-20k/step_045500/"
INFER_CFG = "./configs/inference/lam-20k-8gpu.yaml"
DEFAULT_MOTION = "Look_In_My_Eyes"  # folder under assets/sample_motion/export/


class HeadBuilder:
    def __init__(self):
        os.chdir(LAM_ROOT)
        sys.path.insert(0, str(LAM_ROOT))
        os.environ.setdefault("NUMBA_THREADING_LAYER", "omp")
        # torch>=2.6 defaults torch.load(weights_only=True); LAM's own (HF-downloaded) TorchScript/pickle
        # checkpoints need the old behaviour.
        os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")
        import torch
        from omegaconf import OmegaConf
        from safetensors.torch import load_file
        from lam.models import ModelLAM
        from tools.flame_tracking_single_image import FlameTrackingSingleImage

        self.torch = torch
        t0 = time.time()
        cfg_train = OmegaConf.load(INFER_CFG)
        cfg = OmegaConf.create()
        cfg.source_size = cfg_train.dataset.source_image_res
        cfg.render_size = cfg_train.dataset.render_image.high
        cfg.merge_with(OmegaConf.load(INFER_CFG))
        cfg.model_name = MODEL_NAME
        self.cfg = cfg
        model = ModelLAM(**cfg.model)
        ckpt = load_file(os.path.join(MODEL_NAME, "model.safetensors"), device="cpu")
        sd = model.state_dict()
        n_loaded = 0
        for k, v in ckpt.items():
            if k in sd and sd[k].shape == v.shape:
                sd[k].copy_(v)
                n_loaded += 1
        self.n_loaded, self.n_ckpt = n_loaded, len(ckpt)
        self.lam = model.to("cuda").eval()
        self.tracker_dir = tempfile.mkdtemp(prefix="lam_track_")
        self.flametracking = FlameTrackingSingleImage(
            output_dir=self.tracker_dir,
            alignment_model_path="./model_zoo/flame_tracking_models/68_keypoints_model.pkl",
            vgghead_model_path="./model_zoo/flame_tracking_models/vgghead/vgg_heads_l.trcd",
            human_matting_path="./model_zoo/flame_tracking_models/matting/stylematte_synth.pt",
            facebox_model_path="./model_zoo/flame_tracking_models/FaceBoxesV2.pth",
            detect_iris_landmarks=False,
            args=argparse.Namespace(output_dir=self.tracker_dir, config_name="alignment", blender_path=str(BLENDER)),
        )
        self.load_s = round(time.time() - t0, 2)

    def run(self, face_path: str | Path, out_dir: str | Path, motion: str = DEFAULT_MOTION,
            export: bool = True, max_frames: int = 150) -> dict:
        import numpy as np
        from PIL import Image
        from lam.runners.infer.head_utils import prepare_motion_seqs, preprocess_image

        torch = self.torch
        os.chdir(LAM_ROOT)  # LAM uses repo-relative paths; some of its steps change cwd
        out_dir = Path(out_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        torch.cuda.reset_peak_memory_stats()
        timings = {"model_load": self.load_s}
        t0 = time.time()

        work = Path(tempfile.mkdtemp(prefix="lam_job_"))
        raw = work / "raw.png"
        Image.open(face_path).convert("RGB").save(raw)

        assert self.flametracking.preprocess(str(raw)) == 0, "flametracking preprocess failed (no face?)"
        assert self.flametracking.optimize() == 0, "flametracking optimize failed"
        rc, track_out = self.flametracking.export()
        assert rc == 0, "flametracking export failed"
        timings["flame_tracking"] = round(time.time() - t0, 3)

        image_path = os.path.join(track_out, "images/00000_00.png")
        mask_path = os.path.join(track_out, "fg_masks/00000_00.png")
        image, _, _, shape_param = preprocess_image(
            image_path, mask_path=mask_path, intr=None, pad_ratio=0, bg_color=1.0, max_tgt_size=None,
            aspect_standard=1.0, enlarge_ratio=[1.0, 1.0], render_tgt_size=self.cfg.source_size,
            multiply=14, need_mask=True, get_shape_param=True)
        Image.fromarray((image[0].permute(1, 2, 0).cpu().numpy() * 255).astype(np.uint8)).save(out_dir / "ref.png")

        motion_dir = os.path.join("./assets/sample_motion/export", motion, "flame_param")
        motion_seq = prepare_motion_seqs(
            motion_dir, None, save_root=str(work), fps=30, bg_color=1.0, aspect_standard=1.0,
            enlarge_ratio=[1.0, 1, 0], render_image_res=self.cfg.render_size, multiply=16,
            need_mask=False, vis_motion=False, shape_param=shape_param, test_sample=False,
            cross_id=False, src_driven=["raw", motion])
        n = min(max_frames, motion_seq["render_c2ws"].shape[1])
        motion_seq["flame_params"]["betas"] = shape_param.unsqueeze(0)

        t1 = time.time()
        with torch.no_grad():
            res = self.lam.infer_single_view(
                image.unsqueeze(0).to("cuda", torch.float32), None, None,
                render_c2ws=motion_seq["render_c2ws"][:, :n].cuda(),
                render_intrs=motion_seq["render_intrs"][:, :n].cuda(),
                render_bg_colors=motion_seq["render_bg_colors"][:, :n].cuda(),
                flame_params={k: (v[:, :n] if v.dim() > 2 and k != "betas" else v).cuda()
                              for k, v in motion_seq["flame_params"].items()})
        torch.cuda.synchronize()
        timings["lam_infer_and_render"] = round(time.time() - t1, 3)
        timings["rendered_frames"] = int(n)

        res["cano_gs_lst"][0].save_ply(str(out_dir / "offset.ply"), rgb2sh=False, offset2xyz=True)

        rgb = res["comp_rgb"].detach().cpu().numpy()
        mask = res["comp_mask"].detach().cpu().numpy()
        mask[mask < 0.5] = 0.0
        rgb = (np.clip(rgb * mask + (1 - mask), 0, 1) * 255).astype(np.uint8)
        fdir = out_dir / "frames"
        fdir.mkdir(exist_ok=True)
        for i in range(0, len(rgb), 10):
            Image.fromarray(rgb[i]).save(fdir / f"{i:04d}.png")
        try:
            from lam.utils.ffmpeg_utils import images_to_video
            images_to_video(rgb, output_path=str(out_dir / "preview.mp4"), fps=30, gradio_codec=False, verbose=False)
        except Exception as e:  # preview is nice-to-have
            timings["preview_error"] = repr(e)

        export_info = {"requested": export, "ok": False}
        if export:
            t2 = time.time()
            try:
                export_info.update(self._export_oac(shape_param, res, out_dir))
                export_info["ok"] = True
            except Exception as e:
                export_info["error"] = f"{type(e).__name__}: {e}"
                export_info["trace"] = traceback.format_exc()[-2000:]
            timings["export"] = round(time.time() - t2, 3)

        timings["total"] = round(time.time() - t0, 3)
        result = {
            "schema_version": 1,
            "face_input": str(face_path),
            "motion": motion,
            "files": {"offset_ply": str(out_dir / "offset.ply"), "ref": str(out_dir / "ref.png"),
                      "preview_mp4": str(out_dir / "preview.mp4"), "frames_dir": str(fdir)},
            "export": export_info,
            "timing_s": timings,
            "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1e9, 2),
            "ckpt_params_loaded": f"{self.n_loaded}/{self.n_ckpt}",
        }
        (out_dir / "head.json").write_text(json.dumps(result, indent=2))
        shutil.rmtree(work, ignore_errors=True)
        return result

    def _export_oac(self, shape_param, res, out_dir: Path) -> dict:
        """OpenAvatarChat / LAM_WebRender package, same layout as app_lam.py's enable_oac_file path."""
        import subprocess
        import patoolib
        from tools.generateARKITGLBWithBlender import update_flame_shape, convert_ascii_to_binary

        os.chdir(LAM_ROOT)
        if not BLENDER.exists():
            raise FileNotFoundError(f"Blender not found at {BLENDER}")
        name = "avatar"
        pkg = out_dir / name
        if pkg.exists():
            shutil.rmtree(pkg)
        pkg.mkdir(parents=True)
        tmp = Path(tempfile.mkdtemp(prefix="lam_export_"))
        mesh = Path(self.lam.renderer.flame_model.save_shaped_mesh(shape_param.unsqueeze(0).cuda(), fd=str(tmp)))
        res["cano_gs_lst"][0].save_ply(str(pkg / "offset.ply"), rgb2sh=False, offset2xyz=True)
        # Same steps as tools/generateARKITGLBWithBlender.generate_glb, but with unique temp files and
        # Blender output captured + verified (Blender exits 0 even when the python script fails).
        update_flame_shape(mesh, tmp / "ascii.fbx", LAM_ROOT / "assets/sample_oac/template_file.fbx")
        convert_ascii_to_binary(tmp / "ascii.fbx", tmp / "bin.fbx")
        logs = {}
        for script, args, produced in [
            ("tools/convertFBX2GLB.py", [tmp / "bin.fbx", pkg / "skin.glb"], pkg / "skin.glb"),
            ("tools/generateVertexIndices.py", [mesh, pkg / "vertex_order.json"], pkg / "vertex_order.json"),
        ]:
            p = subprocess.run([str(BLENDER), "--background", "--python", str(LAM_ROOT / script), "--",
                                *map(str, args)], capture_output=True, text=True, cwd=str(LAM_ROOT))
            logs[script] = (p.stdout + p.stderr)[-1500:]
            if p.returncode != 0 or not produced.exists():
                raise RuntimeError(f"blender {script} failed (rc={p.returncode}): {logs[script]}")
        shutil.copy(LAM_ROOT / "assets/sample_oac/animation.glb", pkg / "animation.glb")
        shutil.rmtree(tmp, ignore_errors=True)
        zip_path = out_dir / f"{name}.zip"
        if zip_path.exists():
            zip_path.unlink()
        cwd = os.getcwd()
        os.chdir(out_dir)
        try:
            patoolib.create_archive(archive=str(zip_path), filenames=[name], verbosity=-1, program="zip")
        except Exception:
            shutil.make_archive(str(out_dir / name), "zip", root_dir=out_dir, base_dir=name)
        finally:
            os.chdir(cwd)
        return {"zip": str(zip_path), "dir": str(pkg), "contents": sorted(p.name for p in pkg.iterdir())}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--face", required=True, help="face_512.png from segment.py")
    ap.add_argument("--out", required=True)
    ap.add_argument("--motion", default=DEFAULT_MOTION)
    ap.add_argument("--no-export", action="store_true")
    ap.add_argument("--repeat", type=int, default=1)
    a = ap.parse_args()
    face, out = os.path.abspath(a.face), os.path.abspath(a.out)
    hb = HeadBuilder()
    for _ in range(a.repeat):
        r = hb.run(face, out, motion=a.motion, export=not a.no_export)
    print(json.dumps({k: r[k] for k in ("timing_s", "peak_vram_gb", "ckpt_params_loaded")}))
    print("export:", {k: v for k, v in r["export"].items() if k != "trace"})
    return 0


if __name__ == "__main__":
    sys.exit(main())
