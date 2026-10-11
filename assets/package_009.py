"""Merge nature entries and refresh building tint metadata without touching unlocks."""
import json
from pathlib import Path
from nature_spec_009 import NAMES, BUILDINGS, metadata
from check_glb import read, MODELS

ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'packages/catalog/catalog.json'
registry=json.loads(path.read_text())
registry['entries']=[e for e in registry['entries'] if e['id'] not in NAMES]
for name in NAMES:
    doc,_=read(MODELS/(name+'.glb'))
    materials=sorted(m['name'] for m in doc['materials'])
    meta=metadata(name)
    variants=meta['variants']
    for v in variants: v['materials']={k:c for k,c in v['materials'].items() if k in materials}
    registry['entries'].append({'id':name,'kind':'decoration','slot':'decoration',
        'name':name.removeprefix('nature_').replace('_',' ').title(),
        'description':f"{meta['group'].title()} for {meta['placement']['hint'].replace('_',' ')}; three material/size presets.",
        'price_xp':0,'requires':[],'source':'earned:nature','rarity':'common',
        'tags':['nature',meta['group'],'placement_'+meta['placement']['hint']],
        'scatter':meta['placement'],
        'asset':{'glb':'/models/'+name+'.glb','attach':{'anchor':'ground','offset':[0,0,0],'rotation':[0,0,0],'scale':1},
                 'tint_materials':materials,'variants':variants}})
for e in registry['entries']:
    filename=e.get('asset',{}).get('glb','').split('/')[-1].removesuffix('.glb')
    if filename in BUILDINGS:
        doc,_=read(MODELS/(filename+'.glb'))
        e['asset']['tint_materials']=sorted(m['name'] for m in doc['materials'])
path.write_text(json.dumps(registry,indent=2)+'\n',encoding='utf-8')

# Schema changes are additive: existing catalogs and legacy consumers remain valid.
path=ROOT/'packages/catalog/catalog.schema.json'
schema=json.loads(path.read_text())
identifier={'type':'string','pattern':'^[a-z][a-z0-9_]*$'}
schema['$defs']['Entry']['properties']['scatter']={'type':'object','additionalProperties':False,
    'properties':{'surface':{'enum':['ground','water']},'hint':identifier,
                  'weight':{'type':'number','exclusiveMinimum':0},'clearance_m':{'type':'number','exclusiveMinimum':0}},
    'required':['surface','hint','weight','clearance_m']}
schema['$defs']['Entry']['properties']['asset']['properties']['variants']={
    'type':'array','minItems':2,'maxItems':3,'items':{'type':'object','additionalProperties':False,
    'properties':{'id':identifier,'scale':{'type':'number','exclusiveMinimum':0},
    'materials':{'type':'object','minProperties':1,'additionalProperties':{'type':'string','pattern':'^#[0-9a-fA-F]{6}$'}}},
    'required':['id','scale','materials']}}
path.write_text(json.dumps(schema,indent=2)+'\n',encoding='utf-8')
print(f'Packaged {len(NAMES)} nature assets and {len(BUILDINGS)} building updates')
