import io
from types import SimpleNamespace

import pytest
from fastapi import UploadFile
from PIL import Image

from app.assets import save_image

pytestmark = pytest.mark.asyncio


async def test_iphone_mpo_photo_is_accepted_and_saved_as_jpeg(tmp_path):
    buf = io.BytesIO()
    first, second = Image.new("RGB", (64, 48), "blue"), Image.new("RGB", (64, 48), "red")
    first.save(buf, format="MPO", save_all=True, append_images=[second])
    buf.seek(0)
    assert Image.open(io.BytesIO(buf.getvalue())).format == "MPO"
    key, _ = await save_image(SimpleNamespace(asset_dir=tmp_path), UploadFile(buf, filename="IMG_8913.jpeg"), "items")
    assert key.endswith(".jpg")
    with Image.open(tmp_path / key) as saved:
        assert saved.format == "JPEG" and saved.size == (64, 48)
