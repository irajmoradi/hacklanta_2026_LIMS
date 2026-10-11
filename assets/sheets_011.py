"""Package matched PBR renders into review sheet and individual thumbnails."""
from PIL import Image, ImageDraw, ImageFont
from palette_011 import ROOT, PALETTES

DEST = ROOT / 'assets/previews'
FONT = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 24)
SMALL = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
W, H = 560, 480
canvas = Image.new('RGB', (W * 4, 90 + H * 6), '#19212D')
draw = ImageDraw.Draw(canvas)
draw.text((24, 18), 'VILLAGE / ASSET-011 / distinct storefront colors + ASSET-008 surfaces', font=FONT, fill='#F7EDD8')
draw.text((24, 53), 'Matched cameras and PBR lighting | BEFORE / AFTER pairs | geometry, nodes and anchors preserved', font=SMALL, fill='#BDD1DA')
for i, name in enumerate(PALETTES):
    for j, version in enumerate(('before', 'after')):
        x, y = (i % 2 * 2 + j) * W, 90 + (i // 2) * H
        with Image.open(DEST / 'palette_011' / f'{name}_{version}.png') as im:
            canvas.paste(im.convert('RGB'), (x, y))
            if version == 'after':
                thumb = im.convert('RGB')
                thumb.thumbnail((420, 340), Image.Resampling.LANCZOS)
                thumb.save(ROOT / 'apps/web/public/thumbs' / (name + '.png'))
        draw.text((x + 14, y + 447), name.replace('storefront_', '').replace('_', ' ').upper() + ' / ' + version.upper(), font=SMALL, fill='#F7EDD8')
canvas.save(DEST / 'buildings_palette_before_after.png')
print('ASSET-011: 11 thumbnails and matched before/after sheet packaged')
