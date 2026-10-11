"""CV-006 SAM 3 side of "photo -> wearable / decoration" (runs in the `vcv-sam3` env, worker child kind "segment").

outfit(seg, image, out_dir, slot, prompt?) -> garment mask -> {tint{primary,secondary}, pattern.png (256 seamless), cutout.png}
object_cutout(seg, image, out_dir, prompt?) -> best object mask -> cutout.png (RGBA, tight crop, padded square)
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
from PIL import Image

SLOT_PROMPTS = {
    "torso": ["shirt", "jacket", "sweater", "t-shirt", "dress", "top"],
    "head": ["hat", "cap", "beanie", "turban", "headscarf"],
}
OBJECT_PROMPTS = ["object", "mug", "plant", "toy", "instrument"]
MIN_SCORE = 0.3


def _hex(rgb) -> str:
    return "#" + "".join(f"{int(round(float(v))):02x}" for v in rgb)


def _best_mask(seg, img: Image.Image, prompts: list[str], restrict: np.ndarray | None = None):
    """Try prompts in order; return (mask, score, prompt) of the best instance (score + small size bonus).
    Stops early once a prompt yields a confident (>0.6) instance, so specific/user prompts win."""
    import torch
    state = None
    best_mask, best_score, best_prompt, best_key = None, 0.0, None, -1.0
    for p in prompts:
        with torch.autocast("cuda", dtype=torch.bfloat16):
            masks, boxes, scores, state = seg._query(img, p, state)
        for m, s in zip(masks, scores):
            if restrict is not None:
                m = m & restrict
            if m.mean() < 0.002:
                continue
            key = float(s) + 0.15 * min(float(m.mean()) * 10, 1.0)
            if key > best_key:
                best_mask, best_score, best_prompt, best_key = m, float(s), p, key
        if best_mask is not None and best_score > 0.6:
            break
    return best_mask, best_score, best_prompt


def _kmeans2(px: np.ndarray, iters: int = 12):
    """2-cluster k-means on Nx3 colors -> (centers sorted by cluster size desc, sizes)."""
    rng = np.random.default_rng(0)
    if len(px) > 20000:
        px = px[rng.choice(len(px), 20000, replace=False)]
    c = np.stack([np.percentile(px, 25, axis=0), np.percentile(px, 75, axis=0)]).astype(np.float32)
    for _ in range(iters):
        d = ((px[:, None, :] - c[None]) ** 2).sum(-1)
        lab = d.argmin(1)
        for k in range(2):
            if (lab == k).any():
                c[k] = px[lab == k].mean(0)
    sizes = np.bincount(lab, minlength=2)
    order = np.argsort(-sizes)
    return c[order], sizes[order]


def _largest_inner_square(mask: np.ndarray) -> tuple[int, int, int]:
    """Largest axis-aligned square fully inside mask (DP on a downsampled mask). Returns (y, x, side) full-res."""
    h, w = mask.shape
    f = max(1, int(max(h, w) / 512))
    m = mask[::f, ::f].astype(np.int32)
    dp = np.zeros_like(m)
    dp[0, :], dp[:, 0] = m[0, :], m[:, 0]
    for y in range(1, m.shape[0]):
        row, prev = m[y], dp[y - 1]
        for x in range(1, m.shape[1]):
            if row[x]:
                dp[y, x] = 1 + min(prev[x], dp[y, x - 1], prev[x - 1])
    y, x = np.unravel_index(dp.argmax(), dp.shape)
    side = int(dp[y, x])
    return (y - side + 1) * f, (x - side + 1) * f, side * f


def _seamless(patch: Image.Image, out: int = 256) -> Image.Image:
    """Periodic swatch without mirror artifacts: cross-fade the patch with its half-period roll.
    The rolled copy is continuous across the wrap, and it dominates near the borders, so tiles meet seamlessly."""
    p = np.asarray(patch.convert("RGB").resize((out, out), Image.LANCZOS)).astype(np.float32)
    r = np.roll(np.roll(p, out // 2, 0), out // 2, 1)
    t = np.linspace(0, 1, out)
    edge = np.minimum(t, 1 - t) * 2                   # 0 at borders, 1 at center
    w = np.clip(np.minimum.outer(edge, edge) * 1.6, 0, 1)[..., None]
    w = w * w * (3 - 2 * w)                           # smoothstep
    return Image.fromarray(np.clip(w * p + (1 - w) * r, 0, 255).astype(np.uint8))


def outfit(seg, image_path: str, out_dir: str, slot: str = "torso", prompt: str | None = None) -> dict:
    t0 = time.time()
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    if slot not in SLOT_PROMPTS:
        raise ValueError(f"slot must be one of {sorted(SLOT_PROMPTS)}")
    img = Image.open(image_path).convert("RGB")
    img.thumbnail((2048, 2048))
    arr = np.asarray(img)
    prompts = ([prompt] if prompt else []) + SLOT_PROMPTS[slot]
    mask, score, used = _best_mask(seg, img, prompts)
    if mask is None or score < MIN_SCORE:
        raise RuntimeError(f"no {slot} garment found")
    px = arr[mask].astype(np.float32)
    centers, sizes = _kmeans2(px)
    primary, secondary = centers[0], centers[1]
    if np.abs(primary - secondary).sum() < 30:  # effectively one color: derive a darker shade as secondary
        secondary = primary * 0.7
    y, x, side = _largest_inner_square(mask)
    if side < 24:  # thin garment: fall back to the mask bbox center
        ys, xs = np.where(mask)
        cy, cx = int(ys.mean()), int(xs.mean())
        side = max(24, int(min(ys.ptp(), xs.ptp()) * 0.5))
        y, x = max(0, cy - side // 2), max(0, cx - side // 2)
    # half-size patch from the inner square's top-left quadrant: avoids most centered chest logos/prints
    half = max(24, side // 2)
    patch = img.crop((x + side // 8, y + side // 8, x + side // 8 + half, y + side // 8 + half))
    _seamless(patch, 256).save(out / "pattern.png")
    ys, xs = np.where(mask)
    rgba = np.dstack([arr, (mask * 255).astype(np.uint8)])[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(rgba, "RGBA").save(out / "cutout.png")
    res = {"kind": "outfit_from_photo", "slot": slot, "prompt_used": used, "garment_score": round(score, 3),
           "garment_area_frac": round(float(mask.mean()), 4),
           "tint": {"primary": _hex(primary), "secondary": _hex(secondary)},
           "tint_share": round(float(sizes[0] / sizes.sum()), 3),
           "pattern_png": str(out / "pattern.png"), "cutout_png": str(out / "cutout.png"),
           "swatch_source_px": int(side), "timing_s": {"total": round(time.time() - t0, 2)}}
    (out / "outfit.json").write_text(json.dumps(res, indent=2))
    return res


def object_cutout(seg, image_path: str, out_dir: str, prompt: str | None = None) -> dict:
    t0 = time.time()
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    img = Image.open(image_path).convert("RGB")
    img.thumbnail((2048, 2048))
    arr = np.asarray(img)
    prompts = ([prompt] if prompt else []) + OBJECT_PROMPTS
    mask, score, used = _best_mask(seg, img, prompts)
    if mask is None or score < MIN_SCORE:
        raise RuntimeError("no object found")
    ys, xs = np.where(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([arr, (mask * 255).astype(np.uint8)])[y0:y1, x0:x1]
    obj = Image.fromarray(rgba, "RGBA")
    side = int(max(obj.size) * 1.15)
    sq = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    sq.paste(obj, ((side - obj.width) // 2, (side - obj.height) // 2), obj)
    sq.save(out / "cutout.png")
    # white-background RGB version for the image model
    white = Image.new("RGB", sq.size, (255, 255, 255))
    white.paste(sq, (0, 0), sq)
    white.save(out / "cutout_white.png")
    res = {"kind": "object_from_photo", "prompt_used": used, "object_score": round(score, 3),
           "object_area_frac": round(float(mask.mean()), 4), "cutout_png": str(out / "cutout.png"),
           "cutout_white_png": str(out / "cutout_white.png"), "timing_s": {"cutout": round(time.time() - t0, 2)}}
    (out / "object_cutout.json").write_text(json.dumps(res, indent=2))
    return res
