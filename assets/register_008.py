"""Update catalog-owned registry without modifying HTTP or database contracts."""
import copy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'packages/catalog/catalog.json'
catalog=json.loads(path.read_text()); entries=catalog['entries']; by_id={e['id']:e for e in entries}
variants={1:['porch','bay'],2:['balcony','bay'],3:['tower','greenhouse'],4:['tower','greenhouse'],5:['tower','greenhouse']}
for style in ('cottage','modern','aframe','tudor','beach','townhouse'):
    for level,choices in variants.items():
        for choice in choices:
            name=f'house_{style}_lv{level}_{choice}'
            entry=copy.deepcopy(by_id[f'house_{style}_lv{min(level,3)}'])
            entry.update(id=name,name=f'{style.title()} Level {level} · {choice.title()}',
                description=f'{choice.title()} architecture; tintable PBR siding and roof.',
                tags=['house_variants_008',style,f'level_{level}',choice])
            entry['asset']['glb']=f'/models/{name}.glb'
            if name not in by_id: entries.append(entry)
for name in ('perfect_week_halo','competition_laurels','mayor_medal','auditor_badge','champion_mantle','streak_flame_scarf'):
    entry=by_id[name]; entry['asset']['glb']=f'/models/{name}.glb'
    entry['asset']['tint_materials']={
        'perfect_week_halo':['gold'],'competition_laurels':['accent'],
        'mayor_medal':['primary'],'auditor_badge':['accent'],
        'champion_mantle':['primary'],'streak_flame_scarf':['primary','secondary','accent'],
    }[name]
    entry.pop('tint',None) # Authored multi-material colors, rather than blanket reward tints.
    if name=='auditor_badge':
        entry['name']='Auditor Badge'; entry['slot']='torso'
        entry['asset']['attach'].update(bone='Spine',offset=[.18,.30,.32])
for name in ('shirt_hoodie','jacket_denim','shirt_stripes'):
    entry=by_id[name]
    entry['asset']={'glb':f'/models/{name}.glb','tint_materials':['shirt','wall'] if name!='jacket_denim' else ['jacket','light'],
                    'attach':{'anchor':'villager_base','offset':[0,0,0],'rotation':[0,0,0],'scale':1}}
    entry['tags']=sorted(set(entry.get('tags',[])+['skinned','rebind']))
path.write_text(json.dumps(catalog,indent=2)+'\n')
print('Registered 60 house variants, six unique rewards, three rigged garments')
