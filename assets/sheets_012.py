from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]
sheet=Image.new('RGB',(1800,1390),'#f1eee5');draw=ImageDraw.Draw(sheet)
draw.text((30,20),'CAFE PATIO / ASSET-012 / 5,831 triangles / sage, cream, copper',fill='#293f38')
for i,name in enumerate(['front','rear','detail','night']):
    im=Image.open(root/f'assets/previews/patio_012/{name}.png').convert('RGB')
    x=(i%2)*900;y=60+(i//2)*665;sheet.paste(im,(x,y));draw.text((x+18,y+12),name.upper(),fill='#ffffff' if name=='night' else '#293f38')
sheet.save(root/'assets/previews/cafe_patio_contact.png')
im=Image.open(root/'assets/previews/patio_012/front.png');im.resize((420,303),Image.Resampling.LANCZOS).save(root/'apps/web/public/thumbs/cafe_patio.png')
