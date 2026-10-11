import hashlib
import io
import warnings
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps

MAX_UPLOAD = 10 * 1024 * 1024


async def save_image(settings, file: UploadFile, prefix):
    try:
        content = await file.read(64 * 1024 * 1024 + 1)
    finally:
        await file.close()
    if len(content) > 64 * 1024 * 1024:
        raise HTTPException(413, "Image exceeds 64 MiB safety limit")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as img:
                if img.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError("Unsupported image")
                extension = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}[img.format]
                resize = len(content) > MAX_UPLOAD or max(img.size) > 4096
                img.verify()
            if resize:
                with Image.open(io.BytesIO(content)) as img:
                    img = ImageOps.exif_transpose(img).convert("RGB")
                    img.thumbnail((4096, 4096), Image.Resampling.LANCZOS)
                    output = io.BytesIO()
                    img.save(output, format="JPEG", quality=85)
                    content = output.getvalue()
                    while len(content) > MAX_UPLOAD:
                        img.thumbnail(
                            (int(img.width * 0.8), int(img.height * 0.8)), Image.Resampling.LANCZOS
                        )
                        output = io.BytesIO()
                        img.save(output, format="JPEG", quality=85)
                        content = output.getvalue()
                    extension = "jpg"
    except Exception:
        raise HTTPException(415, "Upload a valid JPEG, PNG, or WebP image") from None
    digest = hashlib.sha256(content).hexdigest()
    key = f"{prefix}/{uuid4()}.{extension}"
    path = settings.asset_dir / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return key, digest


def asset_path(settings, key):
    if (
        "\\" in key
        or ":" in key
        or "\x00" in key
        or any(part in {".", "..", ""} for part in key.split("/"))
    ):
        raise HTTPException(404, "Asset not found")
    root = settings.asset_dir.resolve()
    path = (root / key).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise HTTPException(404, "Asset not found")
    return path
