"""ASSET-012 acceptance: real geometry, embedded PBR, registration and QA artifacts."""
import json
from pathlib import Path
from PIL import Image
from check_glb import read, bounds, validate, MODELS

ROOT=Path(__file__).resolve().parents[1]
path=MODELS/'cafe_patio.glb'
print(validate(path))
doc,binary=read(path)
nodes=doc['nodes']
names=[n.get('name','') for n in nodes]
count=lambda prefix: sum(n.split('.')[0]==prefix for n in names)
assert all(count(f'table_{i}')==1 for i in range(3))
assert all(count(f'chair_{i}_{j}')==1 for i in range(3) for j in range(2))
assert sum(n.startswith('parasol_') and '_stripe_' in n for n in names)==36
assert count('string_post')==3 and sum(n.startswith('bulb_') and not n.startswith('bulb_socket') for n in names)==17
assert count('bike_wheel')==2 and count('planter_soil')==2 and count('flower')>=6
assert count('coffee_cup')==6 and count('pastry_plate')==3
lo,hi=bounds(doc,binary)
assert abs(lo[1])<.001 and lo[0]>=-4.8 and hi[0]<=4.8 and lo[2]>=-1.86 and hi[2]<=1.86
library=json.loads((ROOT/'assets/materials/library.json').read_text(encoding='utf-8'))
for material in doc['materials']:
    kind=material['extras']['surface'];recipe=library[kind];pbr=material['pbrMetallicRoughness']
    assert abs(pbr.get('metallicFactor',1)-recipe['metalness'])<.000001
    assert abs(pbr.get('roughnessFactor',1)-recipe['roughness'])<.000001
    if 'pattern' in recipe: assert 'baseColorTexture' in pbr
assert all('bufferView' in image for image in doc['images'])
bulb=next(m for m in doc['materials'] if m['name']=='patio_bulb')
assert max(bulb['emissiveFactor'])>0
for filename in ['packages/catalog/catalog.json','apps/web/src/scene/catalog.fallback.json']:
    catalog=json.loads((ROOT/filename).read_text(encoding='utf-8'))
    entry=next(e for e in catalog['entries'] if e['id']=='cafe_patio')
    assert entry['kind']==entry['slot']=='decoration' and entry['source']!='shop' and 'shop' not in entry['tags']
    assert 'placement' not in entry and entry['asset']['attach']['offset']==[0,0,4.6]
    assert set(entry['asset']['tint_materials'])=={m['name'] for m in doc['materials']}
for name in ['assets/previews/cafe_patio_contact.png','assets/previews/cafe_patio_day.png','assets/previews/cafe_patio_night.png','assets/previews/cafe_patio_fallback.png','apps/web/public/thumbs/cafe_patio.png']:
    with Image.open(ROOT/name) as image: image.verify()
qa=json.loads((ROOT/'assets/previews/cafe_patio_browser_qa.json').read_text())
assert not qa['errors'] and qa['pose']['cupVisible'] and qa['initial']['parent']=='unlocked:storefront_cafe'
assert qa['emission'] and all(v==3 for v in qa['emission'])
print('ASSET-012: geometry, PBR, registry, contact sheet, day/night, drag-to-sip and offline QA; 0 failures')
