"""Normalize existing 008 exports to neutral embedded tiles + explicit tint factors.

Useful when migrating exports from Blender versions that bake MixRGB factors.
Geometry/accessor bytes and authored anchors are preserved byte-for-byte.
"""
import ast,json,struct
from pathlib import Path
from check_glb import read
from house_spec_006 import MODELS,PALETTES
ROOT=Path(__file__).resolve().parents[1]
tree=ast.parse((ROOT/'assets/blender/common.py').read_text())
palette=ast.literal_eval(next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='PALETTE' for t in n.targets)))
palette.update(door='#664535',primary='#314971',secondary='#DECBA4')
recipes=json.loads((ROOT/'assets/materials/library.json').read_text())
for path in (ROOT/'apps/web/public/models').glob('*.glb'):
    doc,binary=read(path)
    if not any('surface' in m.get('extras',{}) for m in doc['materials']): continue
    colors=palette.copy(); name=path.stem
    if name in MODELS:
        style,level,index=MODELS[name];colors.update(PALETTES[style][index])
    elif name.startswith('house_') and '_lv' in name:
        colors.update(PALETTES[name.split('_')[1]][0])
    if name=='shirt_hoodie':colors['shirt']='#AD6243'
    if name=='jacket_denim':colors['jacket']='#345D85'
    if name.startswith('pet_dog'):colors.update(fur='#BB7842' if name.endswith('_b') else '#896049',wall='#EAD5AC',accent='#375F65')
    if name=='competition_laurels':colors['accent']='#587A39'
    if name=='streak_flame_scarf':colors.update(primary='#853629',accent='#F28A32',secondary='#FFC857')
    replacements={}
    for material in doc['materials']:
        kind=material.get('extras',{}).get('surface')
        if kind not in recipes:continue
        pbr=material['pbrMetallicRoughness']; color=colors.get(material['name'])
        if color:
            rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
            pbr['baseColorFactor']=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]+[1]
        pattern=recipes[kind].get('pattern')
        if pattern and 'baseColorTexture' in pbr:
            image=doc['images'][doc['textures'][pbr['baseColorTexture']['index']]['source']]
            replacements[image['bufferView']]=(ROOT/'assets/materials'/(pattern+'.png')).read_bytes()
    buffer=bytearray()
    for i,view in enumerate(doc['bufferViews']):
        start=view.get('byteOffset',0)
        data=replacements.get(i,binary[start:start+view['byteLength']])
        view['byteOffset']=len(buffer);view['byteLength']=len(data)
        buffer.extend(data);buffer.extend(b'\0'*((-len(buffer))%4))
    doc['buffers'][0]['byteLength']=len(buffer)
    data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(data)+len(buffer))+struct.pack('<II',len(data),0x4E4F534A)+data+struct.pack('<II',len(buffer),0x004E4942)+buffer)
print('Neutral material maps and paint factors repacked; geometry unchanged')
