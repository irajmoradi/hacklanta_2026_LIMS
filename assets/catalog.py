"""Generate a reviewable catalog from the actual validated exported GLBs."""
from check_glb import MODELS, read, validate
from kit_spec import ADDITIONS, REQUIRED_NODES
from pathlib import Path
import json
import town_spec as town
import event_spec as events
import plaza_spec as plaza
from outfits_spec import NAMES as OUTFITS, entry as outfit_entry
from nature_spec_009 import NAMES as NATURE, metadata as nature_metadata


def main():
    # Preserve curated usage notes and supplemental contact-sheet sections.
    target = Path(__file__).resolve().parent / 'CATALOG.md'
    previous = target.read_text(encoding='utf-8') if target.exists() else ''
    notes = {line.split('|')[1].strip(): line.split('|')[-2].strip()
             for line in previous.split('\n## ')[0].splitlines() if line.startswith('| `')}
    supplements = '\n## ' + previous.split('\n## ', 1)[1] if '\n## ' in previous else ''
    rows=['# Village asset catalog', '',
          f'{len(list(MODELS.glob("*.glb")))} original procedural GLBs. Counts include every mesh instance. Node counts',
          'include meshes, animation pivots, and joints; named runtime hooks follow the count.',
          'All attachment offsets are glTF meters in the named joint\'s local frame.', '',
          '| Name | Tris | Nodes / runtime hooks | Intended use |',
          '| --- | ---: | --- | --- |']
    for path in sorted(MODELS.glob('*.glb')):
        validate(path)
        doc,_=read(path)
        tris=sum(doc['accessors'][p.get('indices',p['attributes']['POSITION'])]['count']//3
                 for n in doc['nodes'] if 'mesh' in n
                 for p in doc['meshes'][n['mesh']]['primitives'])
        hooks=', '.join('`'+s+'`' for s in sorted(REQUIRED_NODES.get(path.stem,set())))
        specs={**ADDITIONS,**town.ADDITIONS,**plaza.ADDITIONS,**{n:(set(),d) for n,d in events.DESCRIPTIONS.items()}}
        use=specs[path.stem][1] if path.stem in specs else 'Original fallback kit; see README'
        if path.stem in OUTFITS:
            use = outfit_entry(path.stem)['description'] + ' Tint: primary / secondary / accent.'
        if path.stem=='villager_base':
            hooks='`Head`, `Spine`; idle / walk / wave / cheer'
            use='Rigged 1.86 m fallback villager and cosmetic fit reference'
        if path.stem not in OUTFITS:
            use = notes.get('`' + path.stem + '`', use)
        if path.stem in NATURE:
            meta = nature_metadata(path.stem)
            use = f"Nature {meta['group']}; {meta['placement']['hint']}; weight {meta['placement']['weight']}; 3 named material/size presets"
        rows.append(f'| `{path.stem}` | {tris} | {len(doc["nodes"])}'+(f'; {hooks}' if hooks else '')+f' | {use} |')
    (Path(__file__).resolve().parent/'CATALOG.md').write_text('\n'.join(rows)+'\n'+supplements,encoding='utf-8')
    print(f'Catalog written: {len(rows)-8} models')
    entries=[]
    for name in town.NAMES:
        doc,_=read(MODELS/(name+'.glb'))
        attach={'anchor':'ground','offset':[0,0,0],'rotation':[0,0,0],'scale':1}
        kind='decoration'
        slot='world'
        requires=[]
        if name in town.BUILDINGS:
            kind='house' if name.startswith('house') else 'building'
            slot='house' if kind=='house' else 'building'
        if name in town.SKINNED:
            kind='clothing'
            slot='torso' if name.startswith('shirt') else 'legs' if name.startswith('pants') else 'feet'
            attach['anchor']='villager_base'
        elif name in town.ATTACH:
            kind='clothing'
            slot='head' if name.startswith('hat') else 'face' if name.startswith('glasses') else 'back' if name=='backpack' else 'neck' if name=='necklace_chain' else 'wrist'
            bone,offset=town.ATTACH[name]
            attach.pop('anchor'); attach.update(bone=bone,offset=list(offset))
            if name=='wristband_festival': attach['rotation']=[3.141592653589793,0,0]
        elif name.startswith('pet_'):
            slot='pet_neck'; attach['anchor']='pet_dog'; requires=['pet_dog']
        elif name in town.UPGRADES:
            slot='house_upgrade'
            attach['anchor']='house_ground'
            if name=='upgrade_porch': attach['offset']=[0,0,3.35]
            elif name=='upgrade_garden_gnome': attach['offset']=[2.5,0,3.3]
            elif name=='upgrade_neon_sign': attach['offset']=[0,2.6,2.8]
            else:
                # Front roof slope on the level-four and level-five house.
                attach['anchor']='house_roof'; attach['rotation']=[.306,0,0]
        entry={'id':name,'kind':kind,'slot':slot,'name':name.replace('_',' ').title(),
               'description':town.ADDITIONS[name][1], 'price_xp':500 if name in town.BUILDINGS else 75,
               'requires':requires,'asset':{'glb':'/models/'+name+'.glb','attach':attach,
               'tint_materials':sorted(m['name'] for m in doc['materials'])}}
        if name in town.SKINNED: entry['tags']=['skinned','rebind-villager-skeleton']
        entries.append(entry)
    (Path(__file__).resolve().parent/'catalog_additions.json').write_text(json.dumps({'entries':entries},indent=2)+'\n',encoding='utf-8')
    entries=[]
    for pack,names in events.PACKS.items():
        for name in names:
            doc,_=read(MODELS/(name+'.glb'))
            hat=name=='party_hat_villager'
            attach={'offset':[0,.68,0] if hat else [0,0,0], 'rotation':[0,0,0], 'scale':1}
            attach.update({'bone':'Head'} if hat else {'anchor':'ground'})
            entries.append({'id':name,'kind':'decoration','slot':'head' if hat else 'decoration',
                'name':name.replace('_',' ').title(),'description':events.DESCRIPTIONS[name],
                'price_xp':0,'requires':[],'tags':['event_pack',pack],
                'asset':{'glb':'/models/'+name+'.glb','attach':attach,
                         'tint_materials':sorted(m['name'] for m in doc['materials'])}})
    (Path(__file__).resolve().parent/'catalog_additions_004.json').write_text(json.dumps({'entries':entries},indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    main()
