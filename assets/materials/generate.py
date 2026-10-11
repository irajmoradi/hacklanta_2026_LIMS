"""Deterministic neutral 128px tiling PBR color maps; no external assets."""
import math
from pathlib import Path
from PIL import Image

DEST = Path(__file__).resolve().parent
for kind in ('wood','brick','stone','shingle','tile','metal','fabric','leather'):
    image = Image.new('RGB', (128,128))
    pixels=[]
    for y in range(128):
        for x in range(128):
            noise=((x*73+y*139+x*y*17)%31)/31
            if kind=='wood':
                v=.78+.13*math.sin(x*math.tau/16+1.4*math.sin(y*math.tau/128))+.05*noise
                if x%32<1: v=.49
            elif kind in ('brick','shingle','tile'):
                row=y//32; u=(x+(row%2)*32)%64
                v=(.48 if kind=='shingle' else .61) if y%32<3 or u<3 else .81+.12*noise
                if kind=='tile': v*=.83+.17*math.sin(u*math.pi/64)
            elif kind=='stone':
                v=.58+.33*noise+.06*math.sin((x+y)*math.tau/32)
            elif kind=='metal': v=.91+.07*noise
            elif kind=='fabric': v=.62+.16*(x%4<2)+.14*(y%4<2)
            else: v=.72+.22*noise
            pixels.append((round(v*255),)*3)
    image.putdata(pixels)
    image.save(DEST/(kind+'.png'))
print('8 neutral 128px material textures generated')
