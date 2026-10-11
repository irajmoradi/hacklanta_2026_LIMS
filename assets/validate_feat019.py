"""Lightweight catalog and GLB contract checks for the Community Hall."""

import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = json.loads(
    (ROOT / "packages/catalog/catalog.json").read_text(encoding="utf-8")
)
generated = (ROOT / "packages/catalog/dist/catalog.ts").read_text(encoding="utf-8")
generated = generated.split("export const catalog: VillageCatalog = ", 1)[1]
assert json.JSONDecoder().raw_decode(generated)[0] == source
entry = next(e for e in source["entries"] if e["id"] == "town_hall")
assert entry["asset"]["glb"] == "/models/community_hall.glb"
raw = (ROOT / "apps/web/public/models/community_hall.glb").read_bytes()
assert struct.unpack_from("<III", raw) == (0x46546C67, 2, len(raw))
size = struct.unpack_from("<I", raw, 12)[0]
model = json.loads(raw[20 : 20 + size])
assert set(entry["asset"]["tint_materials"]) == {m["name"] for m in model["materials"]}
triangles = sum(
    model["accessors"][p["attributes"]["POSITION"]]["count"] // 3
    for mesh in model["meshes"]
    for p in mesh["primitives"]
)
assert triangles <= 12000
assert all("bufferView" in image for image in model["images"])
print(
    f"Catalog parity, materials and embedded textures verified; Hall: {triangles} triangles."
)
