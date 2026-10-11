"""CV-007 "unique login" face match (CPU only, zero VRAM: never competes with SAM 3 / LAM / Hunyuan on the GPU).

Detector: YuNet (OpenCV Zoo, MIT). Recognizer: SFace MobileFaceNet (OpenCV Zoo, Apache-2.0), 128-d, cosine similarity.
Not liveness-checked: a printed photo of the person would pass. This is a convenience "is it you?" check, not security.

enroll(user_dir)  -> face_embedding.npy (+ face_embedding.json) from <user_dir>/face_512.png
verify(user_dir, selfie_path) -> {match, score, threshold, face_found, ...}
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import cv2
import numpy as np

CKPT = Path(os.environ.get("FACE_CKPT_DIR", Path.home() / "village-cv/checkpoints/face"))
YUNET = CKPT / "face_detection_yunet_2023mar.onnx"
SFACE = CKPT / "face_recognition_sface_2021dec.onnx"
# Calibrated on the CC0 cast (docs/cv/cv007.md); SFace's published cosine threshold is 0.363 (LFW).
THRESHOLD = float(os.environ.get("FACE_MATCH_THRESHOLD", "0.40"))
MODEL_ID = "opencv_zoo/sface_2021dec+yunet_2023mar"


class FaceID:
    def __init__(self):
        t0 = time.time()
        self.det = cv2.FaceDetectorYN.create(str(YUNET), "", (320, 320), 0.6, 0.3, 5000)
        self.rec = cv2.FaceRecognizerSF.create(str(SFACE), "")
        self.load_s = round(time.time() - t0, 3)

    def embed(self, image_bgr: np.ndarray) -> tuple[np.ndarray | None, dict]:
        """Largest face -> aligned 112x112 -> L2-normalized 128-d feature. Returns (feat|None, info)."""
        h, w = image_bgr.shape[:2]
        scale = 1.0
        if max(h, w) > 1280:  # YuNet is fast but big images waste time; faces stay large enough
            scale = 1280 / max(h, w)
            image_bgr = cv2.resize(image_bgr, (int(w * scale), int(h * scale)))
            h, w = image_bgr.shape[:2]
        self.det.setInputSize((w, h))
        _, faces = self.det.detect(image_bgr)
        if faces is None or len(faces) == 0:
            return None, {"face_found": False, "faces": 0}
        f = max(faces, key=lambda r: r[2] * r[3])
        aligned = self.rec.alignCrop(image_bgr, f)
        feat = self.rec.feature(aligned).flatten().astype(np.float32)
        feat /= np.linalg.norm(feat) + 1e-9
        return feat, {"face_found": True, "faces": int(len(faces)), "det_score": round(float(f[-1]), 3),
                      "face_box": [round(float(v) / scale, 1) for v in f[:4]]}

    def enroll(self, user_dir: str | Path) -> dict:
        t0 = time.time()
        user_dir = Path(user_dir)
        src = user_dir / "face_512.png"
        if not src.is_file():
            raise FileNotFoundError("no face_512.png for this user (upload a photo first)")
        img = cv2.imread(str(src))
        feat, info = self.embed(img)
        if feat is None:
            raise ValueError("no face found in the avatar photo")
        np.save(user_dir / "face_embedding.npy", feat)
        meta = {"model": MODEL_ID, "dim": int(feat.shape[0]), "source": "face_512.png",
                "source_mtime": src.stat().st_mtime, "enrolled_at": time.time(), **info}
        (user_dir / "face_embedding.json").write_text(json.dumps(meta, indent=2))
        return {**meta, "enrolled": True, "timing_s": round(time.time() - t0, 3)}

    def verify(self, user_dir: str | Path, selfie_path: str | Path, threshold: float = THRESHOLD) -> dict:
        t0 = time.time()
        user_dir = Path(user_dir)
        emb = user_dir / "face_embedding.npy"
        src = user_dir / "face_512.png"
        enrolled_now = False
        meta = json.loads((user_dir / "face_embedding.json").read_text()) if (user_dir / "face_embedding.json").is_file() else {}
        if not emb.is_file() or (src.is_file() and meta.get("source_mtime") != src.stat().st_mtime):
            self.enroll(user_dir)  # first use, or the avatar photo changed: (re-)enroll transparently
            enrolled_now = True
        ref = np.load(emb)
        img = cv2.imread(str(selfie_path))
        if img is None:
            raise ValueError("could not decode the selfie image")
        feat, info = self.embed(img)
        if feat is None:
            return {"match": False, "score": None, "threshold": threshold, "face_found": False,
                    "enrolled_now": enrolled_now, "model": MODEL_ID, "timing_s": round(time.time() - t0, 3)}
        score = float(np.dot(ref, feat))
        return {"match": bool(score >= threshold), "score": round(score, 4), "threshold": threshold,
                "face_found": True, "faces_in_selfie": info["faces"], "enrolled_now": enrolled_now,
                "model": MODEL_ID, "timing_s": round(time.time() - t0, 3)}
