"""Stage 1 — SAM 3 segmentation.

photo -> person instances (score > 0.5, area > 2% of image) -> per person:
  full_body.png  (person composited on white, bbox + 10% pad)
  face_512.png   (face box expanded 1.6x, square, from the ORIGINAL photo, 512x512; LAM input)
  traits.json    (median #rrggbb for hair/shirt/pants/shoes/skin + per-part scores/areas)
  masks/{person,face,hair,shirt,pants,shoes}.png
and a top-level segment.json listing all crops (+ timings, peak VRAM).

Run inside the `vcv-sam3` conda env (WSL):
  python workers/gpu/segment.py --image /path/photo.jpg --out /path/to/data/assets/avatars/<sample_id>
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

PARTS = ["face", "hair", "shirt", "pants", "shoes"]
# Text prompts tried per part; the best-scoring mask wins. Tight selfies often show a hoodie/jacket/coat that the
# plain "shirt" prompt misses (-> default color), so the torso garment falls back through common garment nouns.
PART_PROMPTS = {"shirt": ["shirt", "hoodie", "jacket", "sweater", "coat", "top"]}
MIN_PART_PIXELS = 20
PERSON_SCORE = 0.5
PERSON_MIN_AREA = 0.02
PART_SCORE = 0.3  # parts are smaller/harder; keep anything >0.3 and union them (e.g. two shoes)
# Hex used when a part is not found, matches a neutral preset look.
DEFAULT_COLORS = {"hair": "#3b2a20", "shirt": "#4a6fa5", "pants": "#2f3640", "shoes": "#222222", "skin": "#c68e6a"}


def _hex(rgb) -> str:
    r, g, b = (int(round(float(x))) for x in rgb)
    return f"#{r:02x}{g:02x}{b:02x}"


def pick_part_mask(candidates, person_mask: np.ndarray, single: bool = False):
    """Pick the best mask for one body part from several text prompts.

    candidates: iterable of (prompt, masks[N,H,W] bool, boxes[N,4], scores[N]).
    For each prompt: single=True takes the top instance (faces), else the union of all instances (two shoes).
    The union is restricted to person_mask; prompts whose restricted mask is < MIN_PART_PIXELS are ignored.
    Returns (mask, score, box_or_None, prompt) of the highest-scoring prompt, or None if nothing qualifies.
    """
    best = None
    for prompt, masks, boxes, scores in candidates:
        if len(scores) == 0:
            continue
        if single:
            j = int(np.argmax(scores))
            mask, score, box = masks[j], float(scores[j]), boxes[j]
        else:
            mask, score, box = masks.any(0), float(np.max(scores)), None
        mask = mask & person_mask
        if mask.sum() < MIN_PART_PIXELS:
            continue
        if best is None or score > best[1]:
            best = (mask, score, box, prompt)
    return best


def _save_mask(mask: np.ndarray, path: Path) -> None:
    Image.fromarray((mask.astype(np.uint8) * 255)).save(path)


class Segmenter:
    """Holds the SAM 3 image model on GPU. Construct once, call .run() many times."""

    def __init__(self, device: str = "cuda"):
        import torch
        from sam3.model_builder import build_sam3_image_model
        from sam3.model.sam3_image_processor import Sam3Processor

        self.torch = torch
        t0 = time.time()
        self.model = build_sam3_image_model(device=device)
        self.processor = Sam3Processor(self.model, device=device, confidence_threshold=PART_SCORE)
        self.load_s = round(time.time() - t0, 2)

    def _query(self, image: Image.Image, prompt: str, state=None):
        """Returns (masks[N,H,W] bool np, boxes[N,4] np xyxy, scores[N] np)."""
        if state is None:
            state = self.processor.set_image(image)
        out = self.processor.set_text_prompt(state=state, prompt=prompt)
        masks = out["masks"].squeeze(1).cpu().numpy().astype(bool)
        boxes = out["boxes"].float().cpu().numpy()
        scores = out["scores"].float().cpu().numpy()
        return masks, boxes, scores, state

    def run(self, image_path: str | Path, out_dir: str | Path) -> dict:
        torch = self.torch
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        torch.cuda.reset_peak_memory_stats()
        t0 = time.time()
        img = Image.open(image_path).convert("RGB")
        W, H = img.size
        arr = np.asarray(img)

        with torch.autocast("cuda", dtype=torch.bfloat16):
            masks, boxes, scores, _ = self._query(img, "person")
        t_person = time.time() - t0

        keep = []
        for m, b, s in zip(masks, boxes, scores):
            area = m.mean()
            if s > PERSON_SCORE and area > PERSON_MIN_AREA:
                keep.append((m, b, float(s), float(area)))
        keep.sort(key=lambda k: k[1][0])  # left-to-right, stable crop ids for a group photo

        crops = []
        for i, (pmask, box, score, area) in enumerate(keep):
            pdir = out_dir / f"person_{i}"
            (pdir / "masks").mkdir(parents=True, exist_ok=True)
            x0, y0, x1, y1 = box
            pw, ph = (x1 - x0) * 0.10, (y1 - y0) * 0.10
            cx0, cy0 = int(max(0, x0 - pw)), int(max(0, y0 - ph))
            cx1, cy1 = int(min(W, x1 + pw)), int(min(H, y1 + ph))
            crop = arr[cy0:cy1, cx0:cx1]
            cmask = pmask[cy0:cy1, cx0:cx1]
            white = np.where(cmask[..., None], crop, 255).astype(np.uint8)
            Image.fromarray(white).save(pdir / "full_body.png")
            _save_mask(cmask, pdir / "masks" / "person.png")

            # Part segmentation on the (un-whitened) crop so SAM sees context; restrict to this person.
            crop_img = Image.fromarray(crop)
            state = None
            parts = {}
            for part in PARTS:
                cands = []
                for prompt in PART_PROMPTS.get(part, [part]):
                    with torch.autocast("cuda", dtype=torch.bfloat16):
                        pm, pb, ps, state = self._query(crop_img, prompt, state)
                    cands.append((prompt, pm, pb, ps))
                picked = pick_part_mask(cands, cmask, single=(part == "face"))
                if picked is None:
                    parts[part] = None
                    continue
                union, best, fbox, used = picked
                _save_mask(union, pdir / "masks" / f"{part}.png")
                med = np.median(crop[union], axis=0)
                parts[part] = {"color": _hex(med), "score": round(best, 3),
                               "area_frac": round(float(union.mean()), 4), "prompt": used}
                if fbox is not None:
                    parts[part]["box_xyxy"] = [float(fbox[0] + cx0), float(fbox[1] + cy0),
                                               float(fbox[2] + cx0), float(fbox[3] + cy0)]

            # Face crop for LAM: face box expanded 1.6x, square, from original photo.
            if parts.get("face") and parts["face"].get("box_xyxy"):
                fx0, fy0, fx1, fy1 = parts["face"]["box_xyxy"]
                face_src = "sam3_face"
            else:  # fallback: top ~22% of the person box, centered
                bw, bh = x1 - x0, y1 - y0
                side = min(bw, bh * 0.22)
                fcx = (x0 + x1) / 2
                fx0, fx1 = fcx - side / 2, fcx + side / 2
                fy0, fy1 = y0, y0 + side
                face_src = "person_top_fallback"
            fcx, fcy = (fx0 + fx1) / 2, (fy0 + fy1) / 2
            side = max(fx1 - fx0, fy1 - fy0) * 1.6
            fcy -= side * 0.05  # nudge up a bit to include hair
            box_sq = (int(fcx - side / 2), int(fcy - side / 2), int(fcx + side / 2), int(fcy + side / 2))
            face = Image.new("RGB", (box_sq[2] - box_sq[0], box_sq[3] - box_sq[1]), (255, 255, 255))
            src = img.crop((max(0, box_sq[0]), max(0, box_sq[1]), min(W, box_sq[2]), min(H, box_sq[3])))
            face.paste(src, (max(0, -box_sq[0]), max(0, -box_sq[1])))
            face_native = face.size[0]
            face.resize((512, 512), Image.LANCZOS).save(pdir / "face_512.png")

            colors = {k: (parts[k]["color"] if parts.get(k) else DEFAULT_COLORS[k])
                      for k in ["hair", "shirt", "pants", "shoes"]}
            colors["skin"] = parts["face"]["color"] if parts.get("face") else DEFAULT_COLORS["skin"]
            traits = {
                "schema_version": 1,
                "colors": colors,
                "parts": parts,
                "person": {"score": round(score, 3), "area_frac": round(area, 4),
                           "box_xyxy": [float(v) for v in box]},
                "face_crop": {"source": face_src, "native_px": face_native, "box_xyxy": list(box_sq)},
                "source_image": str(image_path),
            }
            (pdir / "traits.json").write_text(json.dumps(traits, indent=2))
            crops.append({"crop_id": f"person_{i}", "dir": str(pdir), "score": round(score, 3),
                          "area_frac": round(area, 4), "colors": colors,
                          "box_xyxy": [round(float(v), 1) for v in box],
                          "face_found": face_src == "sam3_face"})

        result = {
            "schema_version": 1,
            "image": str(image_path),
            "image_size": [W, H],
            "n_person_candidates": int(len(scores)),
            "crops": crops,
            "timing_s": {"model_load": self.load_s, "person": round(t_person, 3),
                         "total": round(time.time() - t0, 3)},
            "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1e9, 2),
        }
        (out_dir / "segment.json").write_text(json.dumps(result, indent=2))
        return result


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--repeat", type=int, default=1, help="run N times to measure warm latency")
    a = ap.parse_args()
    seg = Segmenter()
    for _ in range(a.repeat):
        res = seg.run(a.image, a.out)
    print(json.dumps({k: res[k] for k in ("n_person_candidates", "timing_s", "peak_vram_gb")}))
    for c in res["crops"]:
        print(c["crop_id"], c["score"], c["area_frac"], c["colors"], "face" if c["face_found"] else "NOFACE")
    return 0 if res["crops"] else 2


if __name__ == "__main__":
    sys.exit(main())
