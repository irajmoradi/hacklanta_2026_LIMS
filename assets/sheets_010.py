from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parent
out=root/'previews'
canvas=Image.new('RGB',(2400,1100),'#27232e');draw=ImageDraw.Draw(canvas)
try:
 title=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',32)
 small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',20)
except OSError:title=small=ImageFont.load_default()
for i,name in enumerate(('before','after')):
 canvas.paste(Image.open(out/f'colosseum_{name}.png').convert('RGB'),(1200*i,100))
 draw.text((36+1200*i,20),'BEFORE / ASSET-009' if i==0 else 'AFTER / ASSET-010',font=title,fill='#ead5b4')
 draw.text((36+1200*i,65),'Same exported-GLB camera and lighting. Procedural geometry; no external assets.',font=small,fill='#c2b6b0')
canvas.save(out/'colosseum_before_after.png')
