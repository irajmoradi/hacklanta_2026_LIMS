"""Talking-head video: Audio2Expression ARKit-52 frames -> LAM Gaussian head rendered offline -> MP4 (H.264 + AAC).

Runs inside the LAM child (env vcv-lam), reusing HeadBuilder's loaded model + FLAME tracker.
Driving: LAM ships FLAME-topology ARKit blendshapes (flame_assets/flame_arkit_bs.npy, 52 x 5023 x 3, same channel order as
Audio2Expression's `names`). For the duration of a render we swap the renderer's FLAME expression basis (100 FLAME expr
dirs) for those 52 ARKit dirs (upsampled with LAM's own subdivision), feed per-frame ARKit weights as `expr`, and restore
the basis afterwards so normal /avatar/head bakes are unaffected. Head motion: a damped loop of LAM's sample motion
(rotation/neck/eyes), jaw_pose 0 (the jawOpen blendshape does the mouth).
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import time
from contextlib import contextmanager
from pathlib import Path

import numpy as np

FPS = 25
EXPR_FPS_DEFAULT = 30.0
SWAY_MOTION = "Look_In_My_Eyes"
SWAY_DAMP = 0.45                     # fraction of the sample motion's head rotation kept
ZOOM = 0.82                          # focal-length scale (<1 = wider framing)
CHUNK = 100                          # frames per LAM render call (VRAM ~ few GB)
# soft village background: warm cream sky -> sage meadow, with a light halo behind the head
BG_TOP = np.array([0xF4, 0xEF, 0xDF], np.float32)
BG_BOTTOM = np.array([0xC9, 0xDF, 0xB8], np.float32)
HALO = np.array([0xFF, 0xFB, 0xEE], np.float32)


def village_background(h: int, w: int) -> np.ndarray:
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    bg = BG_TOP * (1 - y) + BG_BOTTOM * y
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w / 2) / (w * 0.42)) ** 2 + ((yy - h * 0.42) / (h * 0.42)) ** 2)
    halo = np.clip(1 - r, 0, 1)[..., None] ** 2 * 0.55
    return np.broadcast_to(bg, (h, w, 3)) * (1 - halo) + HALO * halo


def resample_expr(expr: dict, seconds: float, fps: int = FPS) -> np.ndarray:
    """A2E json (names, frames[{weights}], metadata.fps) -> [N, 52] weights at `fps` for `seconds`."""
    src_fps = float((expr.get("metadata") or {}).get("fps") or EXPR_FPS_DEFAULT)
    W = np.array([f["weights"] for f in expr["frames"]], np.float32)
    n = max(1, int(round(seconds * fps)))
    idx = np.minimum((np.arange(n) / fps * src_fps).astype(int), len(W) - 1)
    return np.clip(W[idx], 0.0, 1.0)


class TalkRenderer:
    def __init__(self, hb):
        self.hb = hb
        self._arkit = None

    # ---------------------------------------------------------------- ARKit basis swap
    def _arkit_shapedirs_up(self):
        if self._arkit is None:
            import torch
            fm = self.hb.lam.renderer.flame_model
            bs = np.load("./model_zoo/human_parametric_models/flame_assets/flame_arkit_bs.npy").astype(np.float32)
            bs = torch.from_numpy(bs).permute(1, 2, 0)                     # [5023, 3, 52]
            V = fm.v_template.shape[0]
            if bs.shape[0] < V:                                             # teeth/shoulder verts (if any) don't move
                bs = torch.cat([bs, torch.zeros(V - bs.shape[0], 3, 52)], 0)
            base = fm.shapedirs.detach().cpu()[:, :, :fm.n_shape_params]
            sd = torch.cat([base, bs], 2)                                   # [V, 3, n_shape + 52]
            faces_gpu = fm.faces  # upsample_mesh_cpu builds a CPU LongTensor from self.faces
            try:
                fm.faces = faces_gpu.detach().cpu()
                ret = fm.upsample_mesh_cpu(fm.v_template.detach().cpu().float(), [sd.reshape(V, -1)])
            finally:
                fm.faces = faces_gpu
            sd_up = ret[1].reshape(fm.vertex_num_upsampled, 3, fm.n_shape_params + 52)
            dev = fm.shapedirs_up.device
            # animation_forward uses BOTH: shapedirs (base verts, for joints) and shapedirs_up (Gaussian anchors)
            self._arkit = (sd.contiguous().to(dev), sd_up.contiguous().to(dev))
        return self._arkit

    @contextmanager
    def arkit_basis(self):
        fm = self.hb.lam.renderer.flame_model
        orig = (fm.shapedirs, fm.shapedirs_up, fm.n_expr_params)
        sd, sd_up = self._arkit_shapedirs_up()
        try:
            fm.shapedirs, fm.shapedirs_up = sd, sd_up
            fm.n_expr_params = 52
            yield
        finally:
            fm.shapedirs, fm.shapedirs_up, fm.n_expr_params = orig

    # ---------------------------------------------------------------- per-user prep (cached)
    def prepare(self, face_png: Path, cache: Path):
        import torch
        from PIL import Image
        from lam.runners.infer.head_utils import preprocess_image
        sha = hashlib.sha256(face_png.read_bytes()).hexdigest()
        if cache.is_file():
            c = torch.load(cache, map_location="cpu", weights_only=False)
            if c.get("face_sha256") == sha:
                return c["image"], c["shape_param"], True
        import tempfile
        work = Path(tempfile.mkdtemp(prefix="talk_prep_"))
        raw = work / "raw.png"
        Image.open(face_png).convert("RGB").save(raw)
        ft = self.hb.flametracking
        assert ft.preprocess(str(raw)) == 0, "flametracking preprocess failed (no face?)"
        assert ft.optimize() == 0, "flametracking optimize failed"
        rc, track_out = ft.export()
        assert rc == 0, "flametracking export failed"
        image, _, _, shape_param = preprocess_image(
            os.path.join(track_out, "images/00000_00.png"), mask_path=os.path.join(track_out, "fg_masks/00000_00.png"),
            intr=None, pad_ratio=0, bg_color=1.0, max_tgt_size=None, aspect_standard=1.0, enlarge_ratio=[1.0, 1.0],
            render_tgt_size=self.hb.cfg.source_size, multiply=14, need_mask=True, get_shape_param=True)
        torch.save({"face_sha256": sha, "image": image, "shape_param": shape_param}, cache)
        return image, shape_param, False

    # ---------------------------------------------------------------- render
    def run(self, face: str, expr_json: str, audio: str, out_mp4: str, max_seconds: float = 15.0) -> dict:
        import torch
        from lam.runners.infer.head_utils import prepare_motion_seqs
        hb = self.hb
        from head import LAM_ROOT
        os.chdir(LAM_ROOT)  # LAM uses repo-relative asset paths
        t0 = time.time()
        timings = {}
        face_p = Path(face)
        out = Path(out_mp4)
        out.parent.mkdir(parents=True, exist_ok=True)
        expr = json.loads(Path(expr_json).read_text())
        src_fps = float((expr.get("metadata") or {}).get("fps") or EXPR_FPS_DEFAULT)
        seconds = min(float(max_seconds), len(expr["frames"]) / src_fps)
        W = resample_expr(expr, seconds)                                   # [N, 52]
        N = len(W)

        image, shape_param, cached = self.prepare(face_p, face_p.parent / "head" / "talk_prep.pt")
        timings["lam_prep"] = round(time.time() - t0, 2)
        timings["prep_cached"] = cached

        import tempfile
        work = tempfile.mkdtemp(prefix="talk_motion_")
        ms = prepare_motion_seqs(
            os.path.join("./assets/sample_motion/export", SWAY_MOTION, "flame_param"), None, save_root=work, fps=30,
            bg_color=1.0, aspect_standard=1.0, enlarge_ratio=[1.0, 1, 0], render_image_res=hb.cfg.render_size,
            multiply=16, need_mask=False, vis_motion=False, shape_param=shape_param, test_sample=False,
            cross_id=False, src_driven=["raw", SWAY_MOTION])
        fp = ms["flame_params"]
        M = ms["render_c2ws"].shape[1]
        # ping-pong loop over the sample motion so long clips don't jump at the loop point
        period = np.r_[np.arange(M), np.arange(M - 2, 0, -1)] if M > 2 else np.arange(M)
        idx = torch.from_numpy(period[np.arange(N) % len(period)]).long()

        def take(t):
            return t[:, idx] if t.dim() > 2 else t

        # sway around a NEUTRAL (upright, facing camera) pose: keep only damped deviations from the motion's mean
        rot_m, neck_m = fp["rotation"].mean(1, keepdim=True), fp["neck_pose"].mean(1, keepdim=True)
        params = {
            "betas": shape_param.unsqueeze(0),
            "rotation": SWAY_DAMP * (take(fp["rotation"]) - rot_m),
            "neck_pose": SWAY_DAMP * (take(fp["neck_pose"]) - neck_m),
            "eyes_pose": take(fp["eyes_pose"]) * 0.5,
            "jaw_pose": torch.zeros_like(take(fp["jaw_pose"])),
            "translation": take(fp["translation"]),
            "expr": torch.from_numpy(W).unsqueeze(0),
        }
        for k in fp:  # any other per-frame keys the renderer expects (e.g. static_offset): keep, re-indexed
            if k not in params:
                params[k] = take(fp[k])
        c2ws, intrs, bgs = take(ms["render_c2ws"]), take(ms["render_intrs"]).clone(), take(ms["render_bg_colors"])
        intrs[..., 0, 0] *= ZOOM  # pull the camera back a little: full hair + some shoulders in frame
        intrs[..., 1, 1] *= ZOOM

        H = W_px = int(hb.cfg.render_size)
        bg = village_background(H, W_px)
        enc = subprocess.Popen(
            ["ffmpeg", "-loglevel", "error", "-y",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W_px}x{H}", "-r", str(FPS), "-i", "-",
             "-i", audio, "-t", f"{seconds:.3f}",
             "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
             "-movflags", "+faststart", "-shortest", str(out)],
            stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        torch.cuda.reset_peak_memory_stats()
        t1 = time.time()
        with torch.no_grad(), self.arkit_basis():
            img = image.unsqueeze(0).to("cuda", torch.float32)
            for s in range(0, N, CHUNK):
                sl = slice(s, min(N, s + CHUNK))
                res = hb.lam.infer_single_view(
                    img, None, None,
                    render_c2ws=c2ws[:, sl].cuda(), render_intrs=intrs[:, sl].cuda(),
                    render_bg_colors=bgs[:, sl].cuda(),
                    flame_params={k: (v[:, sl] if (v.dim() > 2 and k != "betas") else v).cuda() for k, v in params.items()})
                rgb = res["comp_rgb"].float().cpu().numpy()
                a = np.clip(res["comp_mask"].float().cpu().numpy(), 0, 1)
                if a.shape[-1] != 3:
                    a = a[..., :1]
                frames = np.clip(rgb * 255 * a + bg[None] * (1 - a), 0, 255).astype(np.uint8)
                enc.stdin.write(frames.tobytes())
        torch.cuda.synchronize()
        timings["render"] = round(time.time() - t1, 2)
        t2 = time.time()
        enc.stdin.close()
        err = enc.stderr.read().decode(errors="ignore")
        if enc.wait() != 0:
            raise RuntimeError(f"ffmpeg failed: {err[-400:]}")
        timings["encode_tail"] = round(time.time() - t2, 2)
        timings["total"] = round(time.time() - t0, 2)
        return {"video_path": str(out), "seconds": round(seconds, 3), "frames": int(N), "fps": FPS,
                "size": [W_px, H], "bytes": out.stat().st_size, "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1e9, 2),
                "timing_s": timings}
