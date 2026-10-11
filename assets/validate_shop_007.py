"""Shop-specific contract and thumbnail checks, in addition to check_glb.py."""
import json
from pathlib import Path
from PIL import Image
from check_glb import read, validate, values
from validate_round2_008 import FEATURES

ROOT=Path(__file__).resolve().parents[1]
models=ROOT/'apps/web/public/models'
baseline=json.loads((ROOT/'assets/shop_baseline_007.json').read_text(encoding="utf-8"))
for name, contract in baseline.items():
    path=models/(name+'.glb')
    validate(path)
    doc,binary=read(path)
    if name in FEATURES:
        # ASSET-008 deliberately replaces these designs; check their new feature
        # contract instead of freezing the weak 007 geometry forever.
        assert FEATURES[name] <= {n['name'].split('.')[0] for n in doc['nodes']}, name
        continue
    assert sorted(m['name'] for m in doc['materials']) == contract['materials'], f'{name}: tint names changed'
    assert set(contract['nodes']) <= {n['name'] for n in doc['nodes']}, f'{name}: authored nodes lost'
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            colors=values(doc,binary,primitive['attributes']['COLOR_0'])
            assert all(c[0] == c[1] == c[2] for c in colors), f'{name}: AO must preserve runtime tints'
    assert all('baseColorFactor' in m['pbrMetallicRoughness'] for m in doc['materials']), f'{name}: palette lost'
# This art pass covers the original 29 cards; farm and FEAT-006 retain icon fallbacks.
art_ids = {
    'auditor_badge', 'champion_mantle', 'competition_laurels', 'decor_flowers',
    'decor_fountain', 'decor_lamp', 'festival_vip', 'glasses_round', 'hat_beanie',
    'hat_cap', 'hat_cowboy', 'hat_crown', 'hat_festival', 'hat_headphones',
    'house_backyard', 'house_lv2', 'house_lv3', 'jacket_denim', 'mayor_medal',
    'perfect_week_halo', 'pet_dog', 'pet_dog_b', 'scarf', 'shirt_hoodie',
    'shirt_stripes', 'streak_flame_scarf', 'voice_hype_coach', 'voice_pirate',
    'voice_shakespearean',
}
entries=[e for e in json.loads((ROOT/'packages/catalog/catalog.json').read_text(encoding="utf-8"))['entries']
         if e['id'] in art_ids]
assert {e['id'] for e in entries} == art_ids, 'An art-pack item disappeared from the catalog'
for entry in entries:
    with Image.open(ROOT/'apps/web/public/thumbs'/(entry['id']+'.png')) as image:
        assert image.size == (512,512) and image.mode == 'RGBA', entry['id']
        low,high=image.getchannel('A').getextrema()
        assert low == 0 and high == 255, f'{entry["id"]}: empty art or missing transparency'
print(f'{len(baseline)} preserved model contracts; {len(entries)} transparent 512px thumbnails; 0 failures')
