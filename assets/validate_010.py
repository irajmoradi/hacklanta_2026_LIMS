"""ASSET-010 anchors, instancing and geometry contract, in addition to full kit validation."""
import json
from pathlib import Path
from check_glb import read, validate, MODELS, bounds
p=MODELS/'colosseum.glb';d,b=read(p);print(validate(p))
nodes={n.get('name'):n for n in d['nodes']}
assert 'confetti_emitter' in nodes
assert len(nodes['gate']['children'])==15
for rank,x,h in ((1,0,1.05),(2,-2,.7),(3,2,.4)):
    t=nodes[f'podium_{rank}']['translation']
    assert all(abs(a-b)<.001 for a,b in zip(t,(x,h/2+.16,0))), (rank,t)
crowd=[n for n in d['nodes'] if n.get('name','').startswith('crowd_')]
assert len(crowd)==105 and len({n['mesh'] for n in crowd})==1
assert len({tuple(n['translation']) for n in crowd})==105, 'overlapping crowd'
assert len([n for n in d['nodes'] if n.get('name','').startswith('stand_')])==70
assert len([n for n in d['nodes'] if n.get('name','').startswith('banner_')])>=8
assert any('COLOR_0' in p['attributes'] for m in d['meshes'] for p in m['primitives'])
lo,hi=bounds(d,b)
assert abs(lo[1])<.001 and max(abs(lo[0]),abs(lo[2]),hi[0],hi[2])<11
print('Anchors, gate, cloth, shared crowd, vertex weathering, 22m envelope: PASS')

recipes=json.loads((Path(__file__).parent/'materials/library.json').read_text())
for material in d['materials']:
    kind=material.get('extras',{}).get('surface')
    if kind:
        spec=recipes[kind]; pbr=material['pbrMetallicRoughness']
        assert abs(pbr['roughnessFactor']-spec['roughness'])<1e-6
        assert abs(pbr['metallicFactor']-spec['metalness'])<1e-6
        if 'pattern' in spec: assert 'baseColorTexture' in pbr
for kind in ('wall','stone','worn','mortar'):
    assert next(m for m in d['materials'] if m['name']==kind)['extras']['surface']=='stone'
entry=next(e for e in json.loads((Path(__file__).parents[1]/'packages/catalog/catalog.json').read_text())['entries'] if e['id']=='colosseum')
assert set(entry['asset']['tint_materials'])=={m['name'] for m in d['materials']}
print('Shared material recipes, embedded maps and catalog tints: PASS')
