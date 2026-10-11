"""Deterministic, dependency-free Hall asset using ASSET-008 PBR recipes."""

import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
recipes = json.loads((ROOT / "assets/materials/library.json").read_text())
doc = dict(
    asset={"version": "2.0", "generator": "Village FEAT-019"},
    scene=0,
    scenes=[{"nodes": []}],
    nodes=[],
    meshes=[],
    materials=[],
    accessors=[],
    bufferViews=[],
    buffers=[],
    images=[],
    textures=[],
)
binary = bytearray()


def buffer(data):
    while len(binary) % 4:
        binary.append(0)
    index = len(doc["bufferViews"])
    doc["bufferViews"].append(
        dict(buffer=0, byteOffset=len(binary), byteLength=len(data))
    )
    binary.extend(data)
    return index


def accessor(values, width, kind):
    view = buffer(struct.pack("<" + "f" * len(values), *values))
    idx = len(doc["accessors"])
    doc["accessors"].append(
        dict(
            bufferView=view,
            componentType=5126,
            count=len(values) // width,
            type=kind,
            min=[min(values[i::width]) for i in range(width)],
            max=[max(values[i::width]) for i in range(width)],
        )
    )
    return idx


def material(name, color, recipe):
    spec = recipes[recipe]
    rgb = [int(color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    rgb = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    pbr = dict(
        baseColorFactor=rgb + [1],
        roughnessFactor=spec["roughness"],
        metallicFactor=spec["metalness"],
    )
    if spec.get("pattern"):
        image = len(doc["images"])
        doc["images"].append(
            dict(
                bufferView=buffer(
                    (ROOT / f"assets/materials/{recipe}.png").read_bytes()
                ),
                mimeType="image/png",
            )
        )
        doc["textures"].append(dict(source=image))
        pbr["baseColorTexture"] = dict(index=len(doc["textures"]) - 1)
    mat = dict(name=name, pbrMetallicRoughness=pbr, extras={"surface": recipe})
    if spec.get("transmission"):
        doc["extensionsUsed"] = ["KHR_materials_transmission"]
        mat["extensions"] = {
            "KHR_materials_transmission": {"transmissionFactor": spec["transmission"]}
        }
    doc["materials"].append(mat)
    return len(doc["materials"]) - 1


wood = material("wood", "#b29570", "wood")
trim = material("trim", "#685541", "wood")
roof = material("roof", "#687c70", "shingle")
glass = material("glass", "#b3d6d1", "glass")
stone = material("stone", "#c3bca8", "stone")
leaf = material("leaf", "#708963", "fabric")
art = material("accent", "#c1a47f", "fabric")


def box(name, center, size, mat):
    positions, normals, uv = [], [], []
    # Each face has an outward winding and independent normals/UVs.
    for normal, corners in [
        ((0, 0, 1), [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]),
        ((0, 0, -1), [(1, -1, -1), (-1, -1, -1), (-1, 1, -1), (1, 1, -1)]),
        ((1, 0, 0), [(1, -1, 1), (1, -1, -1), (1, 1, -1), (1, 1, 1)]),
        ((-1, 0, 0), [(-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1)]),
        ((0, 1, 0), [(-1, 1, 1), (1, 1, 1), (1, 1, -1), (-1, 1, -1)]),
        ((0, -1, 0), [(-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)]),
    ]:
        for i in (0, 1, 2, 0, 2, 3):
            positions.extend(corners[i][a] * size[a] / 2 for a in range(3))
            normals.extend(normal)
            uv.extend([(0, 0), (1, 0), (1, 1), (0, 1)][i])
    mesh = len(doc["meshes"])
    doc["meshes"].append(
        {
            "primitives": [
                dict(
                    attributes={
                        "POSITION": accessor(positions, 3, "VEC3"),
                        "NORMAL": accessor(normals, 3, "VEC3"),
                        "TEXCOORD_0": accessor(uv, 2, "VEC2"),
                    },
                    material=mat,
                )
            ]
        }
    )
    doc["scenes"][0]["nodes"].append(len(doc["nodes"]))
    doc["nodes"].append(dict(name=name, mesh=mesh, translation=center))


box("foundation", [0, 0.15, 0], [8, 0.3, 6.5], stone)
box("timber_floor", [0, 0.36, 0], [7.6, 0.12, 6], wood)
box("rear_wall", [0, 2.4, -3], [7.6, 4.2, 0.2], wood)
box("upper_floor", [0, 2.7, 0], [7.6, 0.18, 6], wood)
box("roof", [0, 4.65, 0], [8.2, 0.25, 6.7], roof)
for x in (-3.7, 3.7):
    box("side_glass", [x, 2.45, 0], [0.12, 4.1, 5.8], glass)
    for z in (-2.8, 0, 2.8):
        box("timber_post", [x, 2.5, z], [0.22, 4.4, 0.22], trim)
for x in (-3.5, -2, 2, 3.5):
    box("front_window", [x, 2.4, 3], [1.35, 3.9, 0.1], glass)
    box("front_mullion", [x - 0.7, 2.5, 3.05], [0.12, 4.4, 0.18], trim)
box("door", [0, 1.45, 3.08], [1.5, 2.2, 0.14], trim)
box("door_glass", [0, 1.65, 3.17], [1.1, 1.5, 0.04], glass)
box("lintel", [0, 3, 3.15], [7.7, 0.24, 0.3], wood)
box("stage_nook", [0, 0.65, -2], [3, 0.5, 1.5], trim)
for x in (-2, 0, 2):
    box("gallery_frame", [x, 3.6, -2.84], [1.2, 0.85, 0.08], trim)
    box("gallery_art", [x, 3.6, -2.78], [1, 0.65, 0.04], art)
for x in (-3.15, 3.15):
    box("planter", [x, 0.62, 3.35], [0.65, 0.55, 0.65], stone)
    for dx, dy in ((0, 0), (-0.18, 0.2), (0.18, 0.35)):
        box("plant", [x + dx, 1.12 + dy, 3.35], [0.36, 0.65, 0.4], leaf)
for i in range(19):
    box("rear_timber_slat", [-3.6 + i * 0.4, 2.4, -3.13], [0.05, 4.2, 0.06], trim)

triangles = len(doc["meshes"]) * 12
assert triangles <= 12000
while len(binary) % 4:
    binary.append(0)
doc["buffers"] = [{"byteLength": len(binary)}]
raw = json.dumps(doc, separators=(",", ":")).encode()
raw += b" " * (-len(raw) % 4)
glb = struct.pack("<III", 0x46546C67, 2, 28 + len(raw) + len(binary))
glb += struct.pack("<II", len(raw), 0x4E4F534A) + raw
glb += struct.pack("<II", len(binary), 0x004E4942) + binary
target = ROOT / "apps/web/public/models/community_hall.glb"
target.write_bytes(glb)
print(
    f"{target.name}: {triangles} triangles; {len(glb)} bytes; embedded ASSET-008 textures"
)
