"""Assemble downloaded Playwright captures for visual review (requires Pillow)."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

root = Path(__file__).resolve().parents[1] / 'artifacts' / 'fix022'
names = ['iraj', 'lance', 'stefanny', 'maya', 'mario']
views = ['front', 'side', 'three-quarter']
for surface in ['town', 'profile', 'wardrobe']:
    sheet = Image.new('RGB', (1440, 1800), '#edf0e6')
    draw = ImageDraw.Draw(sheet)
    for row, name in enumerate(names):
        for col, view in enumerate(views):
            with Image.open(root / f'{name}-{surface}-{view}.png') as source:
                thumb = ImageOps.contain(source.convert('RGBA'), (472, 326))
            sheet.paste(thumb, (col * 480 + (480 - thumb.width) // 2, row * 360 + 25), thumb)
            draw.text((col * 480 + 12, row * 360 + 7), f'{name} / {surface} / {view}', fill='#243322')
    sheet.save(root / f'contact-{surface}.png')
rows = [row for name in names for row in json.loads((root / f'{name}-measurements.json').read_text())]
assert len(rows) == 45
print(json.dumps({'views': len(rows), 'max_socket_error': max(row['error'] for row in rows)}, indent=2))
