"""Compose honest same-camera comparisons and all sixty exported variant views."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from check_glb import read,bounds
ROOT=Path(__file__).resolve().parents[1]; PREVIEW=ROOT/'assets/previews'; THUMBS=ROOT/'apps/web/public/thumbs'
STYLES=('cottage','modern','aframe','tudor','beach','townhouse')
CHOICES={1:['porch','bay'],2:['balcony','bay'],3:['tower','greenhouse'],4:['tower','greenhouse'],5:['tower','greenhouse']}
ITEMS=('shirt_hoodie','jacket_denim','perfect_week_halo','competition_laurels','mayor_medal','auditor_badge','champion_mantle','streak_flame_scarf','pet_dog','pet_dog_b','house_lv2','decor_fountain')
def font(size):
    return ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',size)
def tile(sheet,path,x,y,size):
    image=Image.open(path).convert('RGBA');image.thumbnail((size,size),Image.Resampling.LANCZOS)
    sheet.paste(image,(x+(size-image.width)//2,y+(size-image.height)//2),image)
def main():
    sheet=Image.new('RGB',(1980,1540),'#eee9df'); draw=ImageDraw.Draw(sheet)
    draw.text((25,15),'Village / round two — authored materials & distinct rewards',font=font(30),fill='#273b38')
    draw.text((25,57),'Left: ASSET-007 exported model thumbnail    •    Right: ASSET-008 exported model, same camera and lighting',font=font(20),fill='#5f6862')
    for i,name in enumerate(ITEMS):
        x=(i%3)*660;y=105+(i//3)*355
        draw.rounded_rectangle((x+10,y,x+650,y+345),radius=14,fill='#faf7f0')
        draw.text((x+26,y+8),name.replace('_',' '),font=font(22),fill='#273b38')
        tile(sheet,PREVIEW/'round2_before'/(name+'.png'),x+20,y+38,300)
        tile(sheet,THUMBS/(name+'.png'),x+340,y+38,300)
        draw.text((x+30,y+315),'BEFORE',font=font(16),fill='#737c75');draw.text((x+350,y+315),'AFTER',font=font(16),fill='#356b51')
    sheet.save(PREVIEW/'round2_before_after.png')
    sheet=Image.new('RGB',(2500,1870),'#eee9df');draw=ImageDraw.Draw(sheet)
    draw.text((25,15),'Village / 60 house options — six styles × five levels × two new variants',font=font(32),fill='#273b38')
    draw.text((25,62),'Classic remains a third option. Greenhouse views show the rear annex. Levels 4–5 retain the legacy lot envelope.',font=font(22),fill='#5f6862')
    for row,style in enumerate(STYLES):
        y=110+row*290
        draw.text((20,y),style.upper(),font=font(24),fill='#273b38')
        for level,choices in CHOICES.items():
            for index,choice in enumerate(choices):
                x=((level-1)*2+index)*250
                tile(sheet,THUMBS/f'house_{style}_lv{level}_{choice}.png',x,y+20,235)
                draw.text((x+12,y+250),f'L{level} · {choice}',font=font(18),fill='#273b38')
    sheet.save(PREVIEW/'house_variants.png')
    print('Wrote round2_before_after.png and house_variants.png')

def envelopes():
    result={}
    for style in STYLES:
        for choice in CHOICES[3]:
            doc,binary=read(ROOT/f'apps/web/public/models/house_{style}_lv3_{choice}.glb')
            low,high=bounds(doc,binary);result[f'{style}_{choice}']={'min':low,'max':high}
    (ROOT/'apps/web/src/scene/houseVariantBounds.json').write_text(json.dumps(result,indent=2)+'\n')
if __name__=='__main__':
    envelopes()
    main()
