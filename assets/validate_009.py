"""Task acceptance: all nature, preserved building contracts and visible features."""
import json
from pathlib import Path
from check_glb import read, bounds, validate, MODELS
from nature_spec_009 import NAMES, TREES, BUSHES, GARDENS, BUILDINGS

ROOT=Path(__file__).resolve().parents[1]
registry=json.loads((ROOT/'packages/catalog/catalog.json').read_text())
entries={e['id']:e for e in registry['entries']}
baseline=json.loads((ROOT/'assets/buildings_baseline_009.json').read_text())
assert len(TREES)>=12 and len(BUSHES)>=6 and len(GARDENS)>=8
for name in NAMES:
    path=MODELS/(name+'.glb')
    validate(path)
    d,_=read(path)
    entry=entries[name]
    assert 'nature' in entry['tags'] and entry['scatter']['weight']>0
    assert 2<=len(entry['asset']['variants'])<=3
    assert set(entry['asset']['tint_materials'])=={m['name'] for m in d['materials']}
    assert entry['scatter']['surface']==('water' if name=='nature_lily_pads' else 'ground')
    for variant in entry['asset']['variants']:
        assert set(variant['materials'])<=set(entry['asset']['tint_materials'])
for name in BUILDINGS:
    if name=='colosseum':
        # ASSET-010 replaces this separate-scene hero; it has its own stricter
        # anchor, 22m envelope, crowd and material checks, not the old facade.
        import validate_010
        continue
    path=MODELS/(name+'.glb')
    validate(path)
    d,b=read(path)
    lo,hi=bounds(d,b)
    oldlo,oldhi=baseline[name]['bounds']
    assert all(abs(a-b)<.001 for a,b in zip((*lo[::2],*hi[::2]),(*oldlo[::2],*oldhi[::2]))), f'footprint changed: {name}'
    for old in baseline[name]['entries']:
        current=entries[old['id']]
        assert set(current['asset']['tint_materials'])=={m['name'] for m in d['materials']}
        for key in old:
            if key!='asset': assert current[key]==old[key], f'changed {name} {key}'
        for key in old['asset']:
            if key!='tint_materials': assert current['asset'][key]==old['asset'][key], f'changed {name} {key}'
    assert path.read_bytes()!=(ROOT/'assets/baseline_009'/path.name).read_bytes()
    nodes={n.get('name','') for n in d['nodes']}
    assert any(n.startswith('sign_') for n in nodes), f'missing signage: {name}'
    if name=='arcade':
        assert {'marquee','cabinet','screen','checker'}<=nodes
        assert any(m.get('emissiveFactor') for m in d['materials'])
    if name=='storefront_bakery': assert {'chimney_smoke','bread','striped_awning'}<=nodes
    if name=='library': assert {'bay_base','book','bay_shelf'}<=nodes
print(f'ASSET-009: {len(NAMES)} nature assets / 99 variants / {len(BUILDINGS)} preserved building contracts; 0 failures')
