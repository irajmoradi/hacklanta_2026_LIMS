"""Assemble labeled contact sheets from actual GLB renders (Pillow only)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from nature_spec_009 import NAMES, BUILDINGS

DEST=Path(__file__).resolve().parent/'previews'
FONT=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
SMALL=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)

def sheet(items,columns,title,path):
    w,h=420,380
    canvas=Image.new('RGB',(columns*w,70+((len(items)+columns-1)//columns)*h),'#19212D')
    draw=ImageDraw.Draw(canvas)
    draw.text((22,20),title,font=FONT,fill='#F0DFBF')
    for i,(name,suffix,caption) in enumerate(items):
        x,y=(i%columns)*w,70+(i//columns)*h
        with Image.open(DEST/'pack_009'/f'{name}_{suffix}.png') as im: canvas.paste(im.convert('RGB'),(x,y))
        draw.text((x+12,y+342),caption,font=SMALL,fill='#F0DFBF')
    canvas.save(DEST/path)

sheet([(n,'standard',n.removeprefix('nature_').replace('_',' ').title()) for n in NAMES],6,
      'VILLAGE / NATURE 009 / 33 silhouettes / actual exported GLBs','nature_pack.png')
sheet([(n,v,n.removeprefix('nature_')+' / '+v) for n in NAMES for v in ('standard','young','mature')],6,
      'NATURE / 99 material + size presets / 1.0, 0.72, 1.18 relative scale','nature_variants.png')
sheet([(n,v,n+' / '+v.upper()) for n in BUILDINGS for v in ('before','after')],4,
      'VILLAGE / commercial + civic / BEFORE and AFTER / same horizontal footprints','buildings_before_after.png')
