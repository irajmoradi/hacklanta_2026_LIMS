"""Check ASSET-006 delivery, not just GLB syntax. No Blender dependency."""
import json
from pathlib import Path
from check_glb import MODELS as FOLDER, read, bounds, validate
from house_spec_006 import MODELS, LEGACY, TINTS, PALETTES

ROOT=Path(__file__).resolve().parent

def main():
    baseline=json.loads((ROOT/'house_baseline_006.json').read_text())
    results=[]
    for name in MODELS:
        path=FOLDER/(name+'.glb')
        result=validate(path)
        doc,binary=read(path)
        materials={m['name'] for m in doc['materials']}
        assert set(TINTS)<=materials, (name,'missing tint channel')
        tris=sum(doc['accessors'][p['indices']]['count']//3 for n in doc['nodes'] if 'mesh' in n for p in doc['meshes'][n['mesh']]['primitives'])
        assert tris<=5000,(name,tris)
        nodes={n['name']:n for n in doc['nodes']}
        required=['back_door','back_step','back_deck','back_garden_bed','back_downspout','back_ac_unit']
        required += [side+'_window_glass' for side in ('front','back','left','right')]
        assert all(any(n==r or n.startswith(r+'.') for n in nodes) for r in required),(name,'missing exterior detail')
        lo,hi=bounds(doc,binary)
        assert abs(lo[1])<.001,(name,'ground origin')
        if name in LEGACY:
            old=baseline[name]
            assert set(old['materials'])<=materials,(name,'lost original material')
            assert all(abs(a-b)<.0001 for a,b in zip((*lo,*hi),(*old['min'],*old['max']))),(name,'changed original bounds')
        for side,axis,sign in [('front',2,1),('back',2,-1),('left',0,-1),('right',0,1)]:
            wins=[n for key,n in nodes.items() if key.startswith(side+'_window_glass')]
            centers=[sum(b[axis] for b in bounds({**doc,'nodes':[n]},binary))/2 for n in wins]
            assert centers and all(c*sign>0 for c in centers),(name,side,'window on wrong side')
        results.append(result)
    assert all(len(p)==3 and all(set(row)==set(TINTS) for row in p) for p in PALETTES.values())
    print('\n'.join(results))
    print(f'{len(results)} houses; original bounds/materials preserved; 6 styles x 3 palettes; 0 failures')

if __name__=='__main__': main()
