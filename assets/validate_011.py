"""Acceptance: original placement/geometry contracts and new surface identities."""
import copy
import json
from PIL import Image
from check_glb import read, bounds, validate, values, MODELS
from palette_011 import PALETTES, BASE, ROOT, LIBRARY, linear


def main():
    registry = json.loads((ROOT / 'packages/catalog/catalog.json').read_text(encoding='utf-8'))
    entries = {e['id']: e for e in registry['entries']}
    for old in json.loads((BASE / 'catalog_contracts.json').read_text(encoding='utf-8')):
        current = copy.deepcopy(entries[old['id']])
        assert set(old['asset'].get('tint_materials', [])) <= set(current['asset']['tint_materials'])
        if 'tint_materials' in old['asset']:
            current['asset']['tint_materials'] = old['asset']['tint_materials']
        else:
            current['asset'].pop('tint_materials')
        assert current == old, f"catalog placement/progression changed: {old['id']}"
    for name, palette in PALETTES.items():
        path = MODELS / (name + '.glb')
        validate(path)
        doc, binary = read(path)
        old, original = read(BASE / path.name)
        assert binary[:len(original)] == original, f'original binary changed: {name}'
        for key in ('nodes', 'scenes', 'scene', 'animations', 'skins'):
            assert doc.get(key) == old.get(key), f'{key} changed: {name}'
        assert doc['accessors'][:len(old['accessors'])] == old['accessors']
        assert doc['bufferViews'][:len(old['bufferViews'])] == old['bufferViews']
        assert bounds(doc, binary) == bounds(old, original)
        assert len(doc['meshes']) == len(old['meshes'])
        for mesh, previous in zip(doc['meshes'], old['meshes']):
            actual = copy.deepcopy(mesh)
            for prim, before in zip(actual['primitives'], previous['primitives']):
                assert len(values(doc, binary, prim['attributes']['TEXCOORD_0'])) == len(values(doc, binary, prim['attributes']['POSITION']))
                prim['attributes'] = {k: v for k, v in prim['attributes'].items() if k != 'TEXCOORD_0'}
                if 'TEXCOORD_0' in before['attributes']:
                    prim['attributes']['TEXCOORD_0'] = before['attributes']['TEXCOORD_0']
                prim['material'] = before['material']
            assert actual == previous, f'mesh geometry changed: {name}'
        materials = {m['name']: m for m in doc['materials']}
        assert {m['name'] for m in old['materials']} <= materials.keys()
        for key, (color, kind) in palette.items():
            material = materials[key]
            pbr = material['pbrMetallicRoughness']
            assert pbr['baseColorFactor'] == linear(color)
            assert pbr['roughnessFactor'] == LIBRARY[kind]['roughness']
            assert pbr['metallicFactor'] == LIBRARY[kind]['metalness']
            assert material['extras']['surface'] == kind
        for material in materials.values():
            kind = material['extras']['surface']
            if 'pattern' in LIBRARY[kind]:
                assert 'baseColorTexture' in material['pbrMetallicRoughness']
        for entry in entries.values():
            if entry.get('asset', {}).get('glb') == '/models/' + name + '.glb':
                assert set(entry['asset']['tint_materials']) == materials.keys()

        def assigned(prefix):
            return [doc['materials'][p['material']]['name'] for n in doc['nodes']
                    if n.get('name', '').split('.')[0] == prefix
                    for p in doc['meshes'][n['mesh']]['primitives']]

        if name == 'storefront_bakery':
            assert assigned('striped_awning').count('awning_pink') == 6
            assert assigned('striped_awning').count('paper') == 6
        if name == 'storefront_records':
            assert assigned('front_post') == ['checker_trim'] * 3
            assert assigned('record_bin') == ['checker_trim'] * 2
        if name == 'studio_art':
            assert assigned('front_post') == ['paint_splash_trim'] * 3
            assert assigned('door') == ['paint_splash_trim']
        if name == 'arcade':
            assert all(max(materials[k]['emissiveFactor']) > 0 for k in ('neon_pink', 'neon_cyan'))
        if 'glass' in materials:
            assert materials['glass']['extensions']['KHR_materials_transmission']['transmissionFactor'] == .45
        with Image.open(ROOT / 'apps/web/public/thumbs' / (name + '.png')) as im:
            im.verify()
        print(f'{name}: exact geometry/nodes/anchors; embedded PBR maps; palette and thumbnail OK')
    with Image.open(ROOT / 'assets/previews/buildings_palette_before_after.png') as im:
        assert im.size == (2240, 2970)
        im.verify()
    print('ASSET-011: 11 buildings, 11 thumbnails, matched PBR comparison sheet; 0 failures')


if __name__ == '__main__':
    main()
