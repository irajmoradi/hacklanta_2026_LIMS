"""Calibrate the face-match threshold on the CC0 cast (run in vcv-sam3, WSL). Prints a small ROC-ish table.

Identities: the 5 demo-cast users (anchor = avatars/<uid>/face_512.png) + extra CC0 faces as impostors
(unused demo_cast candidates, other people in the CC0 crowd photo).
Positives per cast identity (NOT independent photos; we only have one photo per person, see cv007.md):
  - LAM-rendered novel poses/expressions of that person (avatars/<uid>/head/frames/*.png)
  - "selfie-like" degradations of the original upload: tight/loose re-crop, 0.25x downscale, darker, blur, JPEG q25, mirror
Negatives: every anchor vs every image of every other identity.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from face import FaceID  # noqa: E402

DATA = Path(os.environ.get("VILLAGE_DATA_DIR", "/mnt/c/Users/mourn/Downloads/hacklanta/data"))
A = DATA / "assets" / "avatars"
CAST = {n: f"13370000-0000-4000-8000-00000000000{i}" for i, n in enumerate(["iraj", "lance", "stefanny", "maya", "dev"], 1)}


def degradations(img):
    h, w = img.shape[:2]
    out = {}
    out["recrop_tight"] = img[int(h * .12):int(h * .88), int(w * .12):int(w * .88)]
    small = cv2.resize(img, (w // 4, h // 4))
    out["downscale_0.25"] = small
    out["dark_0.55"] = np.clip(img.astype(np.float32) * 0.55, 0, 255).astype(np.uint8)
    out["blur_7"] = cv2.GaussianBlur(img, (7, 7), 0)
    ok, enc = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 25])
    out["jpeg_q25"] = cv2.imdecode(enc, cv2.IMREAD_COLOR)
    out["mirror"] = cv2.flip(img, 1)
    return out


def main():
    fid = FaceID()
    feats: dict[str, dict[str, np.ndarray]] = {}
    misses = []

    def add(ident, name, img):
        f, info = fid.embed(img)
        if f is None:
            misses.append(f"{ident}/{name}")
        else:
            feats.setdefault(ident, {})[name] = f

    for n, uid in CAST.items():
        anchor = cv2.imread(str(A / uid / "face_512.png"))
        add(n, "anchor", anchor)
        full = cv2.imread(str(DATA / "inputs" / "demo_cast" / f"{n}.jpg"))
        f, info = fid.embed(full)  # selfie-like: degrade the face region of the ORIGINAL photo (not the crop)
        if f is not None:
            x, y, w, h = [int(v) for v in info["face_box"]]
            m = int(max(w, h) * 0.9)
            crop = full[max(0, y - m):y + h + m, max(0, x - m):x + w + m]
            for k, im in degradations(crop).items():
                add(n, k, im)
        for fr in sorted((A / uid / "head" / "frames").glob("*.png"))[::4][:4]:
            add(n, f"lam_{fr.stem}", cv2.imread(str(fr)))
    extra = list((DATA / "inputs" / "demo_cast" / "candidates").glob("c[1356].jpg"))
    for p in extra:
        add(f"cc0_{p.stem}", "photo", cv2.imread(str(p)))
    gdir = next((DATA / "assets" / "villages").glob("*/group/*"), None)
    if gdir:
        for c in ["person_0", "person_4"]:  # other people in the crowd photo (person_2 = Iraj)
            if (gdir / c / "face_512.png").is_file():
                add(f"crowd_{c}", "face", cv2.imread(str(gdir / c / "face_512.png")))

    pos, neg = [], []
    for n in CAST:
        a = feats.get(n, {}).get("anchor")
        if a is None:
            continue
        for k, f in feats[n].items():
            if k != "anchor":
                pos.append((n, k, float(a @ f)))
        for other, d in feats.items():
            if other == n:
                continue
            for k, f in d.items():
                neg.append((n, f"{other}/{k}", float(a @ f)))
    ps = np.array([s for *_, s in pos])
    ns = np.array([s for *_, s in neg])
    print(f"positives {len(ps)}: min {ps.min():.3f} p10 {np.percentile(ps,10):.3f} mean {ps.mean():.3f}")
    print(f"negatives {len(ns)}: max {ns.max():.3f} p99 {np.percentile(ns,99):.3f} mean {ns.mean():.3f}")
    print("threshold   FAR(neg>=t)   FRR(pos<t)")
    table = []
    for t in [0.25, 0.30, 0.363, 0.40, 0.45, 0.50, 0.55, 0.60]:
        far, frr = float((ns >= t).mean()), float((ps < t).mean())
        table.append({"t": t, "far": far, "frr": frr})
        print(f"  {t:.3f}      {far:6.3f}        {frr:6.3f}   ({int((ns>=t).sum())}/{len(ns)} , {int((ps<t).sum())}/{len(ps)})")
    print("lowest positives:", sorted(pos, key=lambda x: x[2])[:6])
    print("highest negatives:", sorted(neg, key=lambda x: -x[2])[:6])
    print("no face detected:", misses)
    out = DATA / "cv007"
    out.mkdir(parents=True, exist_ok=True)
    (out / "calibration.json").write_text(json.dumps({"positives": pos, "negatives": neg, "table": table,
                                                      "misses": misses}, indent=1))


if __name__ == "__main__":
    main()
