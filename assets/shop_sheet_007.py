"""Assemble labeled shop-card-sized audit sheets from the rendered transparent tiles."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
entries = [e for e in json.loads((ROOT/'packages/catalog/catalog.json').read_text())['entries']
           if any(t in e.get('tags', []) for t in ('shop','earn_only')) and e['kind'] != 'consumable']
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 17)
small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13)
for phase, folder in [('before','assets/previews/shop_before_tiles'), ('after','apps/web/public/thumbs')]:
    if not all((ROOT/folder/(e['id']+'.png')).exists() for e in entries): continue
    sheet = Image.new('RGB',(1200, 80+math.ceil(len(entries)/5)*248),'#f8f5ef')
    draw = ImageDraw.Draw(sheet)
    draw.text((24,22),f'VILLAGE / SHOP ART PASS — {phase.upper()}',font=font,fill='#354c43')
    for i,e in enumerate(entries):
        x,y = (i%5)*240, 72+(i//5)*248
        draw.rounded_rectangle((x+8,y,x+232,y+236),radius=20,fill={'common':'#e7eee4','rare':'#d3e4f3','epic':'#e7d6ef','legendary':'#f0ddb4'}.get(e.get('rarity'),'#e7eee4'))
        tile = Image.open(ROOT/folder/(e['id']+'.png')).convert('RGBA')
        tile.thumbnail((206,190))
        sheet.paste(tile,(x+(240-tile.width)//2,y+4),tile)
        draw.text((x+20,y+194),e['name'],font=font,fill='#354c43')
        draw.text((x+20,y+217),e['id'],font=small,fill='#62746b')
    sheet.save(ROOT/f'assets/previews/shop_{phase}.png')
paths = [ROOT/f'assets/previews/shop_{p}.png' for p in ('before','after')]
if all(p.exists() for p in paths):
    a,b = [Image.open(p) for p in paths]
    both = Image.new('RGB',(a.width+b.width,max(a.height,b.height)),'#f8f5ef')
    both.paste(a,(0,0)); both.paste(b,(a.width,0))
    both.save(ROOT/'assets/previews/shop_before_after.png')
