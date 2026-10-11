"""CV-003 stage: stylize — face_512.png (+ traits colors) -> chibi low-poly head image via Gemini image editing.

Uses the Vertex AI *express* key (GOOGLE_API_KEY, "AQ." prefix) on aiplatform.googleapis.com (the
generativelanguage endpoint is disabled for this key). One fixed prompt for every villager so the
village has one consistent style. Every call is appended to <data>/logs/gemini_image_calls.jsonl so the
call budget is auditable.

  python workers/gpu/stylize.py --face .../face_512.png --traits .../traits.json --out .../body/stylized_head.png
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import time
from pathlib import Path

import httpx
from PIL import Image

MODEL = os.environ.get("STYLIZE_MODEL", "gemini-2.5-flash-image")
ENDPOINT = "https://aiplatform.googleapis.com/v1/publishers/google/models/{model}:generateContent"
PROMPT = (
    "Turn the person in this photo into a single stylized 3D video-game character HEAD in a cute chibi, "
    "low-poly, flat-shaded style (like a cozy village builder game). Show ONLY the head and a short neck stub, "
    "front view, looking straight at the camera, centered, filling about 70% of the frame, neutral friendly "
    "expression, plain pure white background, soft even lighting, no shadows on the background, no text. "
    "Stay FAITHFUL to the photo: keep the exact hair LENGTH and shape (short cropped hair stays short — never add "
    "long hair, bangs or a ponytail that isn't there), the same hair color and texture, same skin tone, same facial "
    "hair or lack of it, and glasses or headwear ONLY if visible in the photo. Do not change apparent age or gender "
    "presentation, do not beautify or invent features. Simple large eyes, small nose, smooth faceted surfaces."
)
PROMPT_VERSION = "head-v2-faithful"


OBJECT_PROMPT = (
    "Turn the object in this photo into a single stylized 3D video-game PROP in a cute, chunky, low-poly, flat-shaded "
    "style (like a cozy village builder game). Show only that one object, whole and complete, standing UPRIGHT as it "
    "would stand on a shelf or floor (add a simple pot or stand if it needs one), straight FRONT view facing the camera, "
    "slightly thickened so it reads as a solid 3D shape, centered, filling about 70% of the frame, plain pure white "
    "background, soft even lighting, no shadows, no text, no people. Keep its recognizable shape and colors."
)
OBJECT_PROMPT_VERSION = "object-v2"


def _repo_root() -> Path:
    return Path(os.environ.get("VILLAGE_REPO", Path(__file__).resolve().parents[2]))


def _api_key() -> str:
    key = os.environ.get("GOOGLE_API_KEY")
    if key:
        return key
    for env in (_repo_root() / ".env", Path("/mnt/c/Users/mourn/Downloads/hacklanta/.env"),
                Path(r"C:\Users\mourn\Downloads\hacklanta\.env")):
        if env.exists():
            for line in env.read_text(encoding="utf-8", errors="ignore").splitlines():
                if line.startswith("GOOGLE_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("GOOGLE_API_KEY not set")


def _log_call(entry: dict) -> None:
    data = Path(os.environ.get("VILLAGE_DATA_DIR", _repo_root() / "data"))
    (data / "logs").mkdir(parents=True, exist_ok=True)
    with open(data / "logs" / "gemini_image_calls.jsonl", "a") as f:
        f.write(json.dumps(entry) + "\n")


def stylize(face_png: str | Path, out_png: str | Path, traits: dict | None = None, prompt: str | None = None) -> dict:
    face = Image.open(face_png).convert("RGB")
    face.thumbnail((512, 512))
    buf = io.BytesIO()
    face.save(buf, "PNG")
    prompt = prompt or PROMPT
    if prompt is PROMPT and traits and traits.get("colors"):
        c = traits["colors"]
        prompt += f" Color hints from the photo: hair {c.get('hair')}, skin {c.get('skin')}."
    body = {
        "contents": [{"role": "user", "parts": [
            {"inlineData": {"mimeType": "image/png", "data": base64.b64encode(buf.getvalue()).decode()}},
            {"text": prompt}]}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"], "temperature": 0.2},
    }
    t0 = time.time()
    r = httpx.post(ENDPOINT.format(model=MODEL), params={"key": _api_key()}, json=body, timeout=120)
    dt = round(time.time() - t0, 2)
    _log_call({"ts": time.time(), "model": MODEL, "status": r.status_code, "seconds": dt, "input": str(face_png)})
    if r.status_code != 200:
        raise RuntimeError(f"Gemini {MODEL} HTTP {r.status_code}: {r.text[:300]}")
    j = r.json()
    img_b64 = None
    text = []
    for cand in j.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            if "inlineData" in part:
                img_b64 = part["inlineData"]["data"]
            elif "text" in part:
                text.append(part["text"])
    if not img_b64:
        raise RuntimeError(f"Gemini returned no image (text: {' '.join(text)[:200]})")
    out = Path(out_png)
    out.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(io.BytesIO(base64.b64decode(img_b64))).convert("RGB")
    img.save(out)
    return {"model": MODEL, "seconds": dt, "size": list(img.size), "out": str(out),
            "usage": j.get("usageMetadata", {})}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--face", required=True)
    ap.add_argument("--traits")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    traits = json.loads(Path(a.traits).read_text()) if a.traits else None
    print(json.dumps(stylize(a.face, a.out, traits)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
