"""Validate decoded art and assemble the FIX-009 review sheet. Requires Pillow."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ids = json.loads((ROOT / 'assets/fix009-items.json').read_text())
entries = json.loads((ROOT / 'packages/catalog/catalog.json').read_text())['entries']
priced = [e for e in entries if (e.get('price_coins') or e.get('price_xp') or 0) > 0]
for entry in priced:
    path = ROOT / 'apps/web/public/thumbs' / f"{entry['id']}.png"
    with Image.open(path) as image:
        image.load()
        assert image.size == (512, 512) and image.mode == 'RGBA', path
        alpha = image.getchannel('A')
        assert alpha.getextrema() == (0, 255), f'Empty or opaque art: {path}'
        assert sum(value > 32 for value in alpha.getdata()) > 500, f'Invisible art: {path}'

columns, cell_w, cell_h = 8, 180, 202
sheet = Image.new('RGB', (columns * cell_w, ((len(ids)+columns-1)//columns)*cell_h+50), '#f5f3eb')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 13)
title = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 24)
draw.text((18, 12), f'FIX-009 | {len(ids)} new shop thumbnails', fill='#314b42', font=title)
for index, item_id in enumerate(ids):
    x, y = (index % columns) * cell_w, (index // columns) * cell_h + 50
    draw.rounded_rectangle((x+6, y+4, x+cell_w-6, y+cell_h-8), radius=14, fill='#e1eadc')
    with Image.open(ROOT / 'apps/web/public/thumbs' / f'{item_id}.png') as image:
        image.thumbnail((164, 164), Image.Resampling.LANCZOS)
        sheet.paste(image, (x+8, y+4), image)
    draw.text((x+cell_w/2, y+173), item_id, fill='#314b42', font=font, anchor='mt')
output = ROOT / 'assets/previews/fix009-contact-sheet.png'
sheet.save(output)
print(f'PASS: {len(priced)} priced thumbnails decoded; {len(ids)} new images in {output}')
