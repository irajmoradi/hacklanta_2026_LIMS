"""Deterministic material-only migration of the ASSET-009 building exports.

Original node graph and binary data are retained; new UVs/maps are appended.
Run after upstream geometry exporters. Captured inputs make reruns idempotent.
"""
import json
import struct
from pathlib import Path

from check_glb import read, values, MODELS

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'assets/baseline_011'
LIBRARY = json.loads((ROOT / 'assets/materials/library.json').read_text())
# Colors are sRGB; all surface recipes come from the ASSET-008 library.
PALETTES = {
    'arcade': {'wall': ('#182C50', 'metal'), 'roof': ('#242B39', 'metal'), 'trim': ('#157C87', 'metal'), 'accent': ('#EA4AA8', 'ceramic'), 'metal': ('#161D2C', 'metal')},
    'storefront_bakery': {'wall': ('#FFF1D8', 'stone'), 'roof': ('#CA7358', 'tile'), 'trim': ('#FFF9EF', 'wood'), 'accent': ('#DB8F9D', 'wood'), 'paper': ('#FFFFFF', 'fabric')},
    'storefront_records': {'wall': ('#D8AA35', 'stone'), 'roof': ('#242729', 'metal'), 'trim': ('#F7EBD1', 'tile'), 'accent': ('#E7BE52', 'ceramic'), 'wood': ('#34302B', 'wood'), 'metal': ('#111820', 'metal'), 'light': ('#FFF4CE', 'ceramic')},
    'storefront_cafe': {'wall': ('#9DB69B', 'stone'), 'roof': ('#BA7954', 'metal'), 'trim': ('#FAF8EC', 'wood'), 'accent': ('#FAF8EC', 'wood'), 'wood': ('#F4F0DF', 'wood'), 'light': ('#FFF6D9', 'ceramic'), 'metal': ('#B57851', 'metal')},
    'town_hall': {'wall': ('#E8E3D4', 'stone'), 'roof': ('#526375', 'shingle'), 'trim': ('#C9C6BB', 'stone'), 'accent': ('#DDD6BE', 'stone'), 'light': ('#DDB85F', 'brass'), 'metal': ('#343A40', 'metal')},
    'gym': {'wall': ('#BEC4C4', 'stone'), 'roof': ('#727F88', 'metal'), 'trim': ('#68757D', 'stone'), 'accent': ('#F38A39', 'ceramic'), 'light': ('#FFAC50', 'ceramic'), 'metal': ('#34434D', 'metal')},
    'studio_art': {'wall': ('#FFFDF5', 'brick'), 'roof': ('#56777E', 'metal'), 'trim': ('#F8F4E7', 'wood'), 'accent': ('#E96F94', 'ceramic'), 'light': ('#E7B743', 'ceramic'), 'paper': ('#FFFDF8', 'fabric')},
    'library': {'wall': ('#215442', 'wood'), 'roof': ('#293E39', 'shingle'), 'trim': ('#53392B', 'wood'), 'wood': ('#53392B', 'wood'), 'accent': ('#B68D42', 'brass'), 'light': ('#E3BD63', 'brass')},
    'pet_shelter': {'wall': ('#F5CE75', 'stone'), 'roof': ('#698A9B', 'shingle'), 'trim': ('#FFEFCA', 'wood'), 'accent': ('#377CA7', 'wood'), 'metal': ('#377CA7', 'wood'), 'wood': ('#E6B65F', 'wood'), 'light': ('#FFF4D6', 'ceramic')},
    'farm_store': {'barn': ('#AD443C', 'wood'), 'cream': ('#FFF8E8', 'wood')},
    'shop': {'wall': ('#328D89', 'wood'), 'roof': ('#356663', 'shingle'), 'trim': ('#FFF0CF', 'wood'), 'accent': ('#FFF0CF', 'wood'), 'light': ('#E9B454', 'ceramic')},
}
DEFAULTS = {'wall': 'wood', 'roof': 'shingle', 'trim': 'wood', 'accent': 'ceramic',
            'wood': 'wood', 'stone': 'stone', 'metal': 'metal', 'glass': 'glass',
            'light': 'brass', 'paper': 'fabric', 'hay': 'fabric', 'barn': 'wood', 'cream': 'wood'}


def linear(hex_color):
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb] + [1]


def patterns():
    from PIL import Image, ImageDraw
    dest = ROOT / 'assets/materials'
    checker = Image.new('RGB', (128, 128), '#FFFAED')
    draw = ImageDraw.Draw(checker)
    for y in range(4):
        for x in range(4):
            if (x + y) % 2 == 0:
                draw.rectangle((x * 32, y * 32, x * 32 + 31, y * 32 + 31), fill='#20252B')
    checker.save(dest / 'checker_011.png')
    splash = Image.new('RGB', (128, 128), '#FFF9E8')
    draw = ImageDraw.Draw(splash)
    for i, color in enumerate(('#ED6694', '#24AAA5', '#F4BC43', '#6D77C1', '#ED7855')):
        x, y = (i * 43 + 12) % 108, (i * 71 + 17) % 108
        draw.ellipse((x - 10, y - 8, x + 17, y + 15), fill=color)
        draw.line((x + 4, y, x + 8, min(127, y + 32)), fill=color, width=5)
        draw.ellipse((x + 20, y - 9, x + 24, y - 5), fill=color)
    splash.save(dest / 'splash_011.png')


def write_glb(path, doc, binary):
    doc['buffers'][0]['byteLength'] = len(binary)
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    path.write_bytes(struct.pack('<4sII', b'glTF', 2, 28 + len(data) + len(binary))
                    + struct.pack('<II', len(data), 0x4E4F534A) + data
                    + struct.pack('<II', len(binary), 0x004E4942) + binary)


def migrate(name):
    path = MODELS / (name + '.glb')
    source = BASE / path.name
    if not source.exists():
        source.write_bytes(path.read_bytes())
    doc, original = read(source)
    binary = bytearray(original)
    textures = {}

    def append(data, target=None):
        view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)}
        if target:
            view['target'] = target
        doc['bufferViews'].append(view)
        binary.extend(data)
        binary.extend(b'\0' * (-len(binary) % 4))
        return len(doc['bufferViews']) - 1

    def texture(pattern):
        if pattern not in textures:
            view = append((ROOT / 'assets/materials' / (pattern + '.png')).read_bytes())
            doc.setdefault('images', []).append({'name': pattern, 'bufferView': view, 'mimeType': 'image/png'})
            if not doc.get('samplers'):
                doc['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
            doc.setdefault('textures', []).append({'source': len(doc['images']) - 1, 'sampler': 0})
            textures[pattern] = len(doc['textures']) - 1
        return {'index': textures[pattern]}

    def surface(material, kind, color=None, pattern=None):
        spec = LIBRARY[kind]
        pbr = material.setdefault('pbrMetallicRoughness', {})
        if color:
            pbr['baseColorFactor'] = linear(color)
        pbr.update(roughnessFactor=spec['roughness'], metallicFactor=spec['metalness'])
        pattern = pattern or spec.get('pattern')
        if pattern:
            pbr['baseColorTexture'] = texture(pattern)
        if 'transmission' in spec:
            doc.setdefault('extensionsUsed', [])
            if 'KHR_materials_transmission' not in doc['extensionsUsed']:
                doc['extensionsUsed'].append('KHR_materials_transmission')
            material.setdefault('extensions', {})['KHR_materials_transmission'] = {'transmissionFactor': spec['transmission']}
        material.setdefault('extras', {}).update(surface=kind, tint_factor=pbr.get('baseColorFactor', [1, 1, 1, 1]))

    for material in doc['materials']:
        key = material['name']
        color, kind = PALETTES[name].get(key, (None, DEFAULTS.get(key, 'ceramic')))
        surface(material, kind, color)

    def extra(key, color, kind, pattern=None):
        material = {'name': key}
        surface(material, kind, color, pattern)
        doc['materials'].append(material)
        return len(doc['materials']) - 1

    overrides = {}
    if name == 'storefront_bakery':
        pink = extra('awning_pink', '#F29CB5', 'fabric')
        for node in doc['nodes']:
            if node.get('name', '').startswith('striped_awning'):
                for prim in doc['meshes'][node['mesh']]['primitives']:
                    if doc['materials'][prim['material']]['name'] == 'roof':
                        prim['material'] = pink
    if name == 'storefront_records':
        checker = extra('checker_trim', '#FFFFFF', 'tile', 'checker_011')
        overrides = {'front_post': checker, 'record_bin': checker}
    if name == 'studio_art':
        splash = extra('paint_splash_trim', '#FFFFFF', 'ceramic', 'splash_011')
        overrides = {'front_post': splash, 'door': splash}

    for node in doc['nodes']:
        if node.get('name', '').split('.')[0] in overrides and 'mesh' in node:
            for prim in doc['meshes'][node['mesh']]['primitives']:
                prim['material'] = overrides[node['name'].split('.')[0]]
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            # Append box-projected UVs; every original accessor and byte stays intact.
            points = values(doc, original, prim['attributes']['POSITION'])
            normals = values(doc, original, prim['attributes']['NORMAL'])
            uv = []
            for p, normal in zip(points, normals):
                axis = max(range(3), key=lambda i: abs(normal[i]))
                a, b = ((2, 1), (0, 2), (0, 1))[axis]
                uv.extend((p[a] * 1.5, p[b] * 1.5))
            view = append(struct.pack('<' + 'f' * len(uv), *uv), 34962)
            doc['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': len(points), 'type': 'VEC2'})
            prim['attributes']['TEXCOORD_0'] = len(doc['accessors']) - 1
    write_glb(path, doc, binary)


def main():
    BASE.mkdir(exist_ok=True)
    patterns()
    for name in PALETTES:
        migrate(name)
    path = ROOT / 'packages/catalog/catalog.json'
    registry = json.loads(path.read_text(encoding='utf-8'))
    for entry in registry['entries']:
        name = Path(entry.get('asset', {}).get('glb', '')).stem
        if name in PALETTES:
            doc, _ = read(MODELS / (name + '.glb'))
            entry['asset']['tint_materials'] = sorted(m['name'] for m in doc['materials'])
    path.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    # Keep the legacy authoring inventory used by the GLB regression suite current.
    path = ROOT / 'assets/catalog_additions.json'
    additions = json.loads(path.read_text(encoding='utf-8'))
    for entry in additions['entries']:
        if entry['id'] in PALETTES:
            doc, _ = read(MODELS / (entry['id'] + '.glb'))
            entry['asset']['tint_materials'] = sorted(m['name'] for m in doc['materials'])
    path.write_text(json.dumps(additions, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'ASSET-011: {len(PALETTES)} material migrations; geometry and node graphs preserved')


if __name__ == '__main__':
    main()
