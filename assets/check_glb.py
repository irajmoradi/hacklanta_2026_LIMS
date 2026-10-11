"""Dependency-free GLB checks. Exit nonzero on missing or invalid kit assets."""
import json
import struct
from pathlib import Path
import sys
import math
from kit_spec import ADDITIONS, REQUIRED_NODES, LANDMARKS
import town_spec as town
import event_spec as events
import plaza_spec as plaza
import house_spec_006 as houses
from outfits_spec import NAMES as OUTFITS, TOPS as OUTFIT_TOPS
from nature_spec_009 import NAMES as NATURE, TREES as NATURE_TREES

FARM = {'farm_store':8000,'goat_kid':1500,'duckling':1500,'calf':1500,'chicken':1500,'paddock_fence':1500,'pigeon':400}
MODELS=Path(__file__).resolve().parents[1]/'apps/web/public/models'
EXPECTED={
    **{f'house_lv{i}': {'wall','roof','trim','accent'} for i in range(1,4)},
    'shop':{'wall','roof','trim','accent'}, 'mayor_stage':{'wood','metal','accent'},
    'tree_a':{'wood','leaf'},'tree_b':{'wood','leaf'},'lantern':{'metal','light'},
    'bench':{'wood','metal'},'fence':{'wood','wall'},'crater':{'soil','stone'},
    'path_tile':{'path'},'hat_cap':{'accent'},'hat_crown':{'light','accent'},
    'hat_beanie':{'roof','wall'},'pet_dog':{'fur','accent'},
    'villager_base':{'skin','hair','shirt','pants','shoes'}}
EXPECTED.update({name: set() for name in FARM})
REQUIRED_NODES.update({name: {"body_bob", "head_peck"} for name in FARM if name not in ("farm_store", "paddock_fence")})
EXPECTED['cafe_patio'] = {'sage','cream','copper','patio_bulb'}
REQUIRED_NODES['cafe_patio'] = {'table_0','table_1','table_2','menu_chalkboard','patio_pavers'}
EXPECTED['study_nook'] = {'wood', 'wall', 'leaf', 'light'}
REQUIRED_NODES['study_nook'] = {'table_0', 'table_1', 'table_2', 'little_library', 'chalkboard', 'Study_Spot_lettering', 'rug_patch'}
EXPECTED.update({name: spec[0] for name,spec in ADDITIONS.items()})
EXPECTED.update({name: spec[0] for name,spec in town.ADDITIONS.items()})
REQUIRED_NODES['streetlight']={'lamp'}
EXPECTED.update({name: set() for name in events.NAMES})
REQUIRED_NODES.update(events.REQUIRED_NODES)
EXPECTED.update({name: spec[0] for name, spec in plaza.ADDITIONS.items()})
REQUIRED_NODES.update(plaza.REQUIRED_NODES)
EXPECTED['colosseum']={'wall','stone','accent','roof','metal','path','fire'}
REQUIRED_NODES['colosseum']={'sand_floor','podium_1','podium_2','podium_3','entry_lintel','torch_flame','gate'}
EXPECTED.update({name: EXPECTED.get(name,set()) | set(houses.TINTS) for name in houses.MODELS})


EXPECTED.update({name: {'primary', 'secondary', 'accent'} for name in OUTFITS})
EXPECTED.update({name: set() for name in NATURE})


def values(doc, binary, index):
    """Read dense kit accessors, respecting stride and accessor offsets."""
    a=doc['accessors'][index]
    assert 'sparse' not in a, 'sparse accessor unsupported by kit'
    v=doc['bufferViews'][a['bufferView']]
    fmt={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}[a['componentType']]
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    size=struct.calcsize('<'+fmt*width)
    stride=v.get('byteStride',size)
    offset=a.get('byteOffset',0)
    assert stride>=size and a['count']>0, 'invalid accessor layout'
    assert offset+(a['count']-1)*stride+size<=v['byteLength'], 'accessor overflow'
    start=v.get('byteOffset',0)+offset
    result=[struct.unpack_from('<'+fmt*width,binary,start+i*stride) for i in range(a['count'])]
    assert all(math.isfinite(x) for row in result for x in row), 'non-finite accessor'
    return result


def bounds(doc,binary):
    """World-space glTF bounds (+Y up), from actual vertices and node transforms."""
    parents={child:i for i,n in enumerate(doc['nodes']) for child in n.get('children',[])}
    def transform(p,n):
        if 'matrix' in n:
            m=n['matrix']
            return tuple(sum(m[k*4+j]*p[k] for k in range(3))+m[12+j] for j in range(3))
        p=tuple(v*s for v,s in zip(p,n.get('scale',(1,1,1))))
        x,y,z,w=n.get('rotation',(0,0,0,1))
        u=(x,y,z)
        cross=(y*p[2]-z*p[1],z*p[0]-x*p[2],x*p[1]-y*p[0])
        dot=sum(u[i]*p[i] for i in range(3))
        norm=sum(v*v for v in u)
        t=n.get('translation',(0,0,0))
        return tuple(2*dot*u[i]+(w*w-norm)*p[i]+2*w*cross[i]+t[i] for i in range(3))
    points=[]
    for index,n in enumerate(doc['nodes']):
        if 'mesh' not in n:
            continue
        for prim in doc['meshes'][n['mesh']]['primitives']:
            for point in values(doc,binary,prim['attributes']['POSITION']):
                cursor=index
                seen=set()
                while cursor is not None:
                    assert cursor not in seen, 'cyclic hierarchy'
                    seen.add(cursor)
                    point=transform(point,doc['nodes'][cursor])
                    cursor=parents.get(cursor)
                points.append(point)
    return tuple(min(p[i] for p in points) for i in range(3)),tuple(max(p[i] for p in points) for i in range(3))

def read(path):
    raw=path.read_bytes()
    assert len(raw)>=20, 'truncated GLB'
    magic,version,length=struct.unpack_from('<4sII',raw)
    assert magic==b'glTF' and version==2 and length==len(raw), 'invalid GLB header'
    pos=12
    chunks={}
    while pos<len(raw):
        size,kind=struct.unpack_from('<II',raw,pos)
        assert size%4==0 and pos+8+size<=len(raw), 'invalid chunk size'
        chunks[kind]=raw[pos+8:pos+8+size]
        pos+=8+size
    return json.loads(chunks[0x4E4F534A]),chunks.get(0x004E4942,b'')

def validate(path):
    doc,binary=read(path)
    assert doc['asset']['version']=='2.0'
    assert all('uri' not in b for b in doc.get('buffers',[])), 'external buffer'
    assert len(binary)>=doc['buffers'][0]['byteLength']
    for view in doc.get('bufferViews',[]):
        assert view.get('buffer',0)==0, 'unexpected buffer index'
        assert view.get('byteOffset',0)+view['byteLength']<=len(binary), 'buffer overflow'
    for index in range(len(doc.get('accessors',[]))):
        values(doc,binary,index)
    # ASSET-008 permits tiny embedded PNGs; remote/large textures remain forbidden.
    for image in doc.get('images',[]):
        assert 'uri' not in image and 'bufferView' in image, 'textures must be embedded'
        assert image.get('mimeType')=='image/png', 'texture must be PNG'
        view=doc['bufferViews'][image['bufferView']]
        start=view.get('byteOffset',0); data=binary[start:start+view['byteLength']]
        assert data[:8]==b'\x89PNG\r\n\x1a\n' and data[12:16]==b'IHDR', 'invalid texture PNG'
        width,height=struct.unpack_from('>II',data,16)
        assert 0<width<=256 and 0<height<=256, 'texture exceeds 256px budget'
    for texture in doc.get('textures',[]):
        assert 0<=texture.get('source',-1)<len(doc.get('images',[])), 'invalid texture source'
    names={m.get('name','') for m in doc.get('materials',[])}
    assert names and '' not in names, 'unnamed materials'
    assert EXPECTED.get(path.stem,set())<=names, f'missing materials {EXPECTED.get(path.stem,set())-names}'
    triangles=0
    for node in doc.get('nodes',[]):
        if 'mesh' not in node:
            continue
        for p in doc['meshes'][node['mesh']]['primitives']:
            assert p.get('mode',4)==4,'non-triangle primitive'
            accessor=doc['accessors'][p.get('indices',p['attributes']['POSITION'])]
            assert accessor['count']%3==0, 'incomplete triangle'
            triangles+=accessor['count']//3
            assert 'material' in p,'missing material'
            assert 0<=p['material']<len(doc['materials']), 'invalid material reference'
            if 'indices' in p:
                assert max(row[0] for row in values(doc,binary,p['indices']))<doc['accessors'][p['attributes']['POSITION']]['count'], 'index outside vertex buffer'
    house_variant=path.stem.startswith(tuple('house_'+style+'_lv' for style in houses.STYLES))
    budget=6000 if path.stem == 'cafe_patio' else 8000 if path.stem == 'study_nook' else FARM[path.stem] if path.stem in FARM else 25000 if path.stem=='colosseum' else 5000 if path.stem in houses.MODELS or house_variant else 2000 if path.stem in events.NAMES else 6000 if path.stem in town.BUILDINGS or path.stem in plaza.NAMES else 8000 if path.stem in LANDMARKS else 3000
    assert 0<triangles<=budget, f'{triangles} triangles exceeds {budget} budget'
    if path.stem in NATURE:
        budget = 2500 if path.stem.removeprefix('nature_') in NATURE_TREES else 1500
        assert triangles<=budget, f'nature budget exceeded: {triangles}>{budget}'
        assert len(doc['meshes'])==1 and sum('mesh' in n for n in doc['nodes'])==1, 'nature must be a single mesh'
        assert 1<=len(doc['materials'])<=3, 'nature requires at most three tint materials'
        assert names <= {'leaf','bark','flower'}, 'unknown nature tint material'
        lo,hi=bounds(doc,binary)
        assert abs(lo[1])<.001, 'nature root must be at ground level'
    nodes={n.get('name',''):n for n in doc['nodes']}
    required=REQUIRED_NODES.get(path.stem,set())
    assert required<=nodes.keys(), f'missing nodes {required-nodes.keys()}'
    for name in required:
        assert sum(n.get('name')==name for n in doc['nodes'])==1, f'duplicate animation node {name}'
        assert 'mesh' in nodes[name] or nodes[name].get('children'), f'empty animation node {name}'
    if path.stem in events.NAMES or path.stem in plaza.NAMES:
        lo,hi=bounds(doc,binary)
        assert abs(lo[1])<.001, f'base must be at Y=0, got {lo[1]}'
        if path.stem in ('fog_bank_card','sun_rays_card'):
            assert all(m.get('doubleSided') and m.get('alphaMode')=='BLEND' for m in doc['materials']), 'FX cards must be double-sided alpha blend'
    if path.stem in town.NAMES or path.stem in OUTFITS or path.stem=='jacket_denim':
        lo,hi=bounds(doc,binary)
        if path.stem in town.STREETS+town.BUILDINGS+town.UPGRADES:
            assert abs(lo[1])<.001, f'base must be at Y=0, got {lo[1]}'
        if path.stem in town.TILES:
            assert all(abs(v-e)<.001 for v,e in zip((lo[0],lo[2],hi[0],hi[2]),(-2,-2,2,2))), 'tile must be centered 4 m square'
        if path.stem in town.BUILDINGS:
            assert all(-4<=lo[i]<=hi[i]<=4 for i in (0,2)), 'building exceeds 8 m lot'
        if path.stem in town.SKINNED or path.stem in ['outfit_' + s for s in OUTFIT_TOPS] or path.stem=='jacket_denim':
            assert doc.get('skins'), 'clothing requires matching skeleton'
            for node in doc['nodes']:
                if 'mesh' not in node: continue
                assert 'skin' in node, 'unskinned clothing'
                skin=doc['skins'][node['skin']]
                joints={doc['nodes'][i]['name'] for i in skin['joints']}
                assert joints<={'Root','Spine','Head','Arm_L','Arm_R','Leg_L','Leg_R'}, 'unknown clothing joint'
                for p in doc['meshes'][node['mesh']]['primitives']:
                    assert {'JOINTS_0','WEIGHTS_0'}<=p['attributes'].keys(), 'unweighted clothing'
                    for weights in values(doc,binary,p['attributes']['WEIGHTS_0']):
                        assert abs(sum(weights)-1)<.0001 and min(weights)>=0, 'invalid clothing weights'
                    for indices in values(doc,binary,p['attributes']['JOINTS_0']):
                        assert all(0<=j<len(skin['joints']) for j in indices), 'invalid clothing joint index'
    if path.stem in ADDITIONS:
        lo,hi=bounds(doc,binary)
        if path.stem!='jacket_denim':
            assert abs(lo[1])<.001, f'base must be at Y=0, got {lo[1]}'
        if path.stem=='string_lights':
            assert abs(hi[0]-lo[0]-10)<.001, 'strand must be 10 m along X'
        if path.stem=='lake_patch':
            assert abs(hi[1]-lo[1])<.0001, 'lake must be flat'
        if path.stem.startswith('house_lv'):
            original=path.with_name(path.stem[:-2]+'.glb')
            base_doc,base_binary=read(original)
            old_lo,old_hi=bounds(base_doc,base_binary)
            assert all(abs(a-b)<.001 for a,b in zip((*lo[::2],*hi[::2]),(*old_lo[::2],*old_hi[::2]))), 'alternate house footprint changed'
    if path.stem == 'study_nook':
        lo,hi=bounds(doc,binary)
        assert abs(lo[1]) < .001 and all(-5 <= lo[i] <= hi[i] <= 5 for i in (0,2)), 'study nook exceeds lot or is not grounded'
        assert any(m.get('name') == 'light' and max(m.get('emissiveFactor',[0])) > 0 for m in doc['materials']), 'missing warm emission'
    clips={a.get('name','') for a in doc.get('animations',[])}
    if path.stem=='villager_base':
        assert clips=={'idle','walk','wave','cheer'},f'incorrect clips {clips}'
        joints={doc['nodes'][i].get('name') for s in doc.get('skins',[]) for i in s['joints']}
        assert 'Head' in joints,'missing Head joint'
        assert any('skin' in n for n in doc['nodes']), 'unskinned avatar'
        for mesh in doc['meshes']:
            for p in mesh['primitives']:
                assert {'JOINTS_0','WEIGHTS_0'}<=p['attributes'].keys(),'unweighted mesh'
        for a in doc['animations']:
            assert a['channels'], 'empty animation'
            assert all(doc['accessors'][s['input']]['count']>=24 for s in a['samplers']), 'clip not baked'
    else:
        assert not clips,'unexpected static asset animation'
    return f'{path.name}: {triangles} triangles; materials={",".join(sorted(names))}; clips={",".join(sorted(clips)) or "none"}'

def main():
    folder=Path(sys.argv[1]) if len(sys.argv)>1 else MODELS
    failures=[]
    for name in EXPECTED:
        if not (folder/(name+'.glb')).exists():
            failures.append(f'{name}: missing GLB')
    for path in sorted(folder.glob('*.glb')):
        try:
            print(validate(path))
        except (AssertionError,KeyError,ValueError,IndexError,struct.error) as error:
            failures.append(f'{path.name}: {error}')
    for failure in failures:
        print('FAIL '+failure)
    print(f'{len(list(folder.glob("*.glb")))} GLBs checked; {len(failures)} failures')
    return bool(failures)

if __name__=='__main__':
    sys.exit(main())
