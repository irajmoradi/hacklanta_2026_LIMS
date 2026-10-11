"""Make local QA contact sheets from the nine rendered/encoded section frames.

Requires Pillow. Does not modify source imagery or delivered videos.
"""
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'artifacts'
labels = ['Hook','Promise','Avatar pipeline','Shared goals','Unlock','Repair','Pets + sync','Generated objects','Decor + persistence','Mayor + iMessage','Lived-in world','End card']
font = ImageFont.load_default(size=20)
for stem, width in [('village-trailer-v4', 640), ('village-trailer-v4-square', 360)]:
    sheet = Image.new('RGB', (width * 3, 396 * 4), '#102b22')
    draw = ImageDraw.Draw(sheet)
    for index, label in enumerate(labels, 1):
        image = Image.open(out / f'{stem}-frame-{index}.png').convert('RGB')
        image.thumbnail((width, 360), Image.Resampling.LANCZOS)
        x, y = ((index - 1) % 3) * width, ((index - 1) // 3) * 396
        sheet.paste(image, (x, y))
        draw.text((x + 12, y + 365), f'{index:02} / {label}', fill='#e9ff75', font=font)
    sheet.save(out / f'{stem}-sections.png')
    print(out / f'{stem}-sections.png')

for prefix,labels,columns in [('pipeline',['photo','mask','traits','villager','splat','waveform','voice'],4),('detail',['mayor','walking','mesh','placed-object','unlock','repair'],3)]:
    if not all((out/f'{prefix}-{name}.png').exists() for name in labels):continue
    sheet=Image.new('RGB',(480*columns,300*((len(labels)+columns-1)//columns)),'#102b22')
    draw=ImageDraw.Draw(sheet)
    for i,name in enumerate(labels):
        frame=Image.open(out/f'{prefix}-{name}.png').convert('RGB');frame.thumbnail((480,270),Image.Resampling.LANCZOS)
        x,y=(i%columns)*480,(i//columns)*300
        sheet.paste(frame,(x,y));draw.text((x+10,y+275),name,fill='#e9ff75',font=font)
    sheet.save(out/f'{prefix}-sequence.png')
    print(out/f'{prefix}-sequence.png')
