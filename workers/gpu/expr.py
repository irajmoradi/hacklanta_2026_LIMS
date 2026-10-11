"""Stage 3 — LAM Audio2Expression: 16 kHz WAV -> per-frame ARKit-52 blendshape JSON (30 fps).

Output JSON is LAM_Audio2Expression's own export format (export_blendshape_animation), which is what
LAM_WebRender / OpenAvatarChat consume: {"names": [52 ARKit names], "frames": [{"weights": [...], "time": t, ...}], ...}
plus we write <out>.meta.json with timings/VRAM.

Run in `vcv-a2e` env (WSL). The A2E code uses repo-relative paths, so we chdir into its repo.
  python workers/gpu/expr.py --wav line.wav --out data/assets/avatars/<id>/voice/<line_id>/line_expr.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
from pathlib import Path

A2E_ROOT = Path(os.environ.get("A2E_ROOT", Path.home() / "village-cv/repos/LAM_Audio2Expression"))
CONFIG = "configs/lam_audio2exp_config_streaming.py"
WEIGHT = "pretrained_models/lam_audio2exp_streaming.tar"


class ExprModel:
    def __init__(self):
        os.chdir(A2E_ROOT)
        sys.path.insert(0, str(A2E_ROOT))
        import torch
        from engines.defaults import default_config_parser, default_setup
        from engines.infer import INFER

        self.torch = torch
        t0 = time.time()
        save_path = tempfile.mkdtemp(prefix="a2e_")
        cfg = default_config_parser(CONFIG, {"save_path": save_path, "weight": WEIGHT,
                                             "ex_vol": False,  # spleeter not installed; ElevenLabs TTS is clean speech
                                             "movement_smooth": True, "brow_movement": True})
        cfg = default_setup(cfg)
        self.cfg = cfg
        self.infer = INFER.build(dict(type=cfg.infer.type, cfg=cfg))
        self.infer.model.eval()
        self.load_s = round(time.time() - t0, 2)

    def run(self, wav: str | Path, out_json: str | Path) -> dict:
        import librosa
        torch = self.torch
        out_json = Path(out_json).resolve()
        out_json.parent.mkdir(parents=True, exist_ok=True)
        torch.cuda.reset_peak_memory_stats()
        t0 = time.time()
        self.infer.cfg.audio_input = str(Path(wav).resolve())
        self.infer.cfg.save_json_path = str(out_json)
        self.infer.infer()
        torch.cuda.synchronize()
        dur = librosa.get_duration(path=str(wav))
        data = json.loads(out_json.read_text())
        n_frames = len(data.get("frames", [])) if isinstance(data, dict) else None
        meta = {"schema_version": 1, "wav": str(wav), "expr_json": str(out_json), "audio_s": round(dur, 3),
                "fps": float(self.cfg.fps), "n_frames": n_frames, "format": "arkit52_a2e",
                "timing_s": {"model_load": self.load_s, "infer": round(time.time() - t0, 3)},
                "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1e9, 2)}
        out_json.with_suffix(".meta.json").write_text(json.dumps(meta, indent=2))
        return meta


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wav", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--repeat", type=int, default=1)
    a = ap.parse_args()
    wav, out = os.path.abspath(a.wav), os.path.abspath(a.out)
    m = ExprModel()
    for _ in range(a.repeat):
        meta = m.run(wav, out)
    print(json.dumps(meta))
    return 0


if __name__ == "__main__":
    sys.exit(main())
