"""Install deterministic runner artifacts and update only ASSET-013 catalog entries."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
styles = {
    'bottoms': ['jeans', 'chinos', 'joggers', 'shorts', 'skirt', 'overalls'],
    'footwear': ['sneakers', 'boots', 'sandals', 'loafers', 'high_tops', 'slippers'],
    'eyewear': ['round_wire', 'aviator', 'cat_eye', 'sunglasses', 'half_rim', 'heart', 'oversized'],
}
path=ROOT/'packages/catalog/catalog.json'
data=json.loads(path.read_text(encoding='utf-8'))
for prefix, names in styles.items():
    for index, style in enumerate(names):
        ident=f'{prefix}_{style}'
        previous=next((e for e in data['entries'] if e['id']==ident),None)
        if previous and 'asset013' not in previous.get('tags',[]):
            raise ValueError(f'Refusing to replace existing catalog item {ident}')
        for folder, ext in [('models','glb'),('thumbs','png')]:
            shutil.copyfile(HERE/'artifacts'/folder/f'{ident}.{ext}',ROOT/f'apps/web/public/{folder}/{ident}.{ext}')
        locked=style in ('overalls','boots','heart')
        entry=dict(id=ident,kind='clothing',slot={'eyewear':'face','footwear':'shoes','bottoms':'bottoms'}[prefix],
                   name=('Wire Round Glasses' if style=='round_wire' else style.replace('_',' ').title() + (' Glasses' if prefix=='eyewear' else '')),
                   description='Original CC0 three-channel wearable. '+('Unlocks at village level 2 (500 XP).' if locked else 'Choose your own primary, secondary and accent colors.'),
                   price_coins=20+index*5,source='shop',rarity='uncommon' if locked else 'common',
                   tags=['shop','asset013'],requires=['fitness_corner'] if locked else [],
                   asset={'glb':f'/models/{ident}.glb','tint_materials':['primary','secondary','accent']})
        if locked: entry['unlock']={'village_level':2}
        data['entries']=[e for e in data['entries'] if e['id']!=ident]+[entry]
path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
