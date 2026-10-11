"""Write suggestions, refresh catalog rows, and assemble rendered contact sheets."""
import json,re
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from house_spec_006 import *
from check_glb import read,MODELS as FOLDER

ROOT=Path(__file__).resolve().parent

def registry():
    # Keep the older suggestions' exact material inventories truthful for the
    # four legacy town-pack houses. This does not touch the runtime catalog.
    previous=ROOT/'catalog_additions.json'
    old=json.loads(previous.read_text())
    for entry in old['entries']:
        if entry['id'] in LEGACY:
            doc,_=read(FOLDER/(entry['id']+'.glb'))
            entry['asset']['tint_materials']=sorted(m['name'] for m in doc['materials'])
    previous.write_text(json.dumps(old,indent=2)+'\n')
    entries=[]
    for name,(style,lv,_) in MODELS.items():
        if name in LEGACY: continue
        entries.append(dict(id=name,kind='house',slot='house',name=f'{style.title()} Level {lv}',
            description=f'Four-sided {style} home, level {lv}; three runtime palettes in palette_presets.',
            price_xp=0,requires=[],tags=['house_styles_006',style,f'level_{lv}'],
            asset=dict(glb=f'/models/{name}.glb',attach=dict(anchor='ground',offset=[0,0,0],rotation=[0,0,0],scale=1),tint_materials=list(TINTS))))
    data=dict(entries=entries,palette_presets=PALETTES,selection_suggestion=dict(
        status='Proposal only; integrator merges entries and implements runtime tint selection.',
        styles=list(STYLES),hash='FNV-1a 32-bit over UTF-8 user ID bytes. Initialize h=2166136261; for each byte: h=Math.imul(h ^ byte,16777619) >>> 0.',
        style='styles[h % 6]',palette='palette_presets[style][Math.floor(h / 6) % 3]',
        level='Clamp integer house level to [1,3]; levels 4 and 5 use style level 3 until additional style tiers exist.',
        model='`/models/house_${style}_lv${level}.glb`',
        tint='Clone each mesh material per member, then set material.color from the five named sRGB hex colors. Never tint the shared cached material.',
        fallback='If style load fails, keep the existing fixture/current house model; no network generation needed.',
        scale='Style GLBs use compact lots, max 3.31 x 3.31 m footprint, ground Y=0, front +Z. Legacy replacements retain their individual original bounds.',
        pricing='Zero prices are suggested demo defaults, not an economy change.',
        legacy={k:dict(style=s,level=l,palette=p) for k,(s,l,p) in LEGACY.items()}))
    (ROOT/'catalog_additions_006.json').write_text(json.dumps(data,indent=2)+'\n')

def catalog():
    path=ROOT/'CATALOG.md'
    text=path.read_text(encoding='utf-8')
    text=re.sub(r'\d+ original procedural GLBs',f'{len(list(FOLDER.glob("*.glb")))} procedural GLBs',text)
    rows=[]
    for name,(style,lv,_) in MODELS.items():
        doc,_=read(FOLDER/(name+'.glb'))
        tris=sum(doc['accessors'][p['indices']]['count']//3 for n in doc['nodes'] if 'mesh' in n for p in doc['meshes'][n['mesh']]['primitives'])
        row=f'| `{name}` | {tris} | {len(doc["nodes"])} | {style.title()} level {lv}; detailed front/back/sides; '+('legacy bounds preserved' if name in LEGACY else '3 tint palettes')+' |'
        pattern=r'^\| `'+name+r'` \|.*$'
        if re.search(pattern,text,re.M): text=re.sub(pattern,row,text,flags=re.M)
        else: rows.append(row)
    if rows: text+='\n## ASSET-006 personal house styles\n\n| Name | Tris | Nodes | Intended use |\n| --- | ---: | ---: | --- |\n'+'\n'.join(rows)+'\n'
    note='\nASSET-006: [front/back contact sheet](previews/houses_006_contact.png), [all palettes](previews/houses_006_palettes.png), [integration and reproduction](HOUSES_006.md).\n'
    if note not in text: text+=note
    path.write_text(text,encoding='utf-8')

def sheets():
    src=ROOT/'previews/houses_006'
    try: font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',17)
    except OSError: font=ImageFont.load_default()
    def sheet(cells,cols,rows,name):
        canvas=Image.new('RGB',(cols*400,rows*385),(22,29,38))
        draw=ImageDraw.Draw(canvas)
        for x,y,file,label in cells:
            with Image.open(src/(file+'.png')) as im: canvas.paste(im.convert('RGB'),(x*400,y*385+35))
            draw.text((x*400+10,y*385+9),label,font=font,fill=(233,226,207))
        canvas.save(ROOT/'previews'/name)
    names=list(MODELS)
    cells=[(i%4,(i//4)*2+j,name+'_'+view,name+' / '+view) for i,name in enumerate(names) for j,view in enumerate(('front','back'))]
    sheet(cells,4,14,'houses_006_contact.png')
    cells=[(p,i,f'house_{s}_lv2_palette_{p}',f'{s} / palette {p+1}') for i,s in enumerate(STYLES) for p in range(3)]
    sheet(cells,3,6,'houses_006_palettes.png')

if __name__=='__main__':
    registry()
    catalog()
    sheets()
