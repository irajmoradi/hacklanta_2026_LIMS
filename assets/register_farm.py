"""Idempotently publish FEAT-008 definitions and offline fixtures."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT/path).read_text(encoding='utf-8'))
def write(path, data): (ROOT/path).write_text(json.dumps(data, indent=2)+'\n', encoding='utf-8')
schema=read('packages/catalog/catalog.schema.json')
for field in ('kind','slot'):
    for value in ('farm_animal','house_addon'):
        values=schema['$defs']['Entry']['properties'][field]['enum']
        if value not in values: values.append(value)
write('packages/catalog/catalog.schema.json',schema)
catalog=read('packages/catalog/catalog.json')
if not any(d['id']=='commercial' for d in catalog['districts']):
    catalog['districts'].append(dict(id='commercial',origin=[0,0,-24],jitter=0))
level=next(l for l in catalog['levels'] if 'pet_shelter' in l['buildings'])
if 'farm_store' not in level['buildings']: level['buildings'].append('farm_store')
entries=[dict(id='farm_store',kind='building',name='Farm Store',description='A red barn with baby animals for your house paddock.',price_xp=0,unlock={'village_level':level['level']},asset={'glb':'/models/farm_store.glb'},tags=['farm']),
dict(id='house_paddock',kind='house_addon',slot='house_addon',name='House Paddock',description='A fenced side yard for up to six farm animals.',price_xp=80,requires=['farm_store'],asset={'glb':'/models/paddock_fence.glb'},tags=['shop','farm'])]
for model,name,cost in [('goat_kid','Goat Kid',60),('duckling','Duckling',25),('calf','Calf',75),('chicken','Chicken',30)]:
    for suffix in ['', '_friend']:
        entries.append(dict(id=model+suffix,kind='farm_animal',slot='farm_animal',name=name+(' Friend' if suffix else ''),description='Lives in the house paddock; does not follow villagers.',price_xp=cost,requires=['farm_store','house_paddock'],asset={'glb':f'/models/{model}.glb'},tags=['shop','farm','non_followable']))
entries.append(dict(id='pigeon',kind='decoration',slot='decoration',name='Plaza Pigeon',description='Ambient fountain flock, instanced without shadows.',price_xp=0,asset={'glb':'/models/pigeon.glb'},tags=['ambient']))
ids={e['id'] for e in entries}
catalog['entries']=[e for e in catalog['entries'] if e['id'] not in ids]+entries
catalog['buildings']=[b for b in catalog['buildings'] if b['id']!='farm_store']+[dict(id='farm_store',placement=dict(district='commercial',offset=[0,0,0],size=4))]
write('packages/catalog/catalog.json',catalog)
fallback=read('apps/web/src/scene/catalog.fallback.json')
fallback['entries']=[e for e in fallback['entries'] if e['id'] not in ids]+entries
next(e for e in fallback['entries'] if e['id']=='farm_store')['placement']=dict(district='commercial',size=4,color='#ad443c',action='shop')
write('apps/web/src/scene/catalog.fallback.json',fallback)
