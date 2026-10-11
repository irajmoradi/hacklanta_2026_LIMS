"""Validate QA evidence encoding, local report links, and obvious secret markers."""
import json
import re
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent
counts = {"png": 0, "json": 0, "local_links": 0}
for path in root.rglob("*.png"):
    with Image.open(path) as image:
        image.verify()
    counts["png"] += 1
for path in root.rglob("*.json"):
    text = path.read_text(encoding="utf-8")
    json.loads(text)
    assert not re.search(r"-----BEGIN .*PRIVATE KEY-----|\bsk-[A-Za-z0-9]{20,}|data:image/[^;]+;base64,", text), path
    counts["json"] += 1
report = root.parent / "QA-012.md"
for target in re.findall(r"\]\((QA-012/[^)]+)\)", report.read_text(encoding="utf-8")):
    assert (report.parent / target).is_file(), target
    counts["local_links"] += 1
print(json.dumps(counts))
