"""Run with blender --background --python assets/blender/village_kit.py."""
import sys
from pathlib import Path
import math
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *

def roof(z, width=3.3, depth=2.9, rise=.85):
    x, y = width/2, depth/2
    mesh('gable_roof', [(-x,-y,z),(x,-y,z),(0,-y,z+rise),
                        (-x,y,z),(x,y,z),(0,y,z+rise)],
         [(0,2,1),(3,4,5),(0,3,5,2),(2,5,4,1),(0,1,4,3)], 'roof')

def window(x,y,z):
    box('window_frame', (x,y,z), (.56,.1,.64), 'trim')
    box('window_glass', (x,y-.06,z), (.44,.04,.52), 'glass')
    box('window_cross', (x,y-.09,z), (.04,.03,.52), 'wall')

def house(level):
    h = 1.65 + (level-1)*.65
    box('foundation', (0,0,.12), (3,2.6,.24), 'stone')
    box('walls', (0,0,.24+h/2), (2.9,2.5,h), 'wall')
    roof(.24+h)
    box('door_frame', (0,-1.29,.75), (.67,.12,1.25), 'trim')
    box('door', (0,-1.37,.72), (.51,.06,1.1), 'accent')
    ball('door_knob', (.17,-1.42,.72), (.045,.04,.045), 'light')
    for x in (-.96,.96):
        window(x,-1.28,1.05)
    if level >= 2:
        box('floor_trim', (0,0,1.85), (3,2.6,.12), 'trim')
        for x in (-.85,.85):
            window(x,-1.28,2.17)
        box('chimney', (.95,.55,h+.6), (.35,.4,.95), 'stone')
    if level == 3:
        box('balcony', (0,-1.36,1.94), (1.55,.17,.15), 'accent')
        for x in (-1.1,1.1):
            box('planter', (x,-1.38,.59), (.65,.22,.2), 'wood')
            for dx in (-.2,0,.2):
                ball('flowers', (x+dx,-1.38,.76), (.12,.12,.15), 'accent')
        cone('finial', (0,0,h+1.25), .14,0,.35,'light')

def shop():
    house(1)
    box('shop_sign', (0,-1.42,1.85), (1.45,.12,.4), 'wood')
    ball('sign_emblem', (0,-1.51,1.85), (.16,.045,.16), 'light')
    for i in range(6):
        obj = box('awning', (-1.25+i*.5,-1.62,1.58), (.5,.95,.1), 'accent' if i%2 else 'wall')
        obj.rotation_euler.x = .16
    for x in (-1.45,1.45):
        box('awning_post',(x,-2,.72),(.09,.09,1.44),'wood')

def stage():
    box('platform',(0,0,.2),(4.8,3,.4),'wood')
    box('step',(0,-1.7,.1),(2,.4,.2),'wood')
    for x in (-2.2,2.2):
        box('stage_post',(x,.85,1.65),(.16,.16,2.5),'trim')
        box('speaker',(x,-.8,.95),(.58,.45,1.1),'metal')
        for z in (.73,1.17):
            obj = cone('speaker_cone',(x,-1.035,z),.19,.19,.03,'stone',12)
            obj.rotation_euler.x = math.pi/2
    box('top_beam',(0,.85,2.88),(4.7,.2,.2),'accent')
    beam('bunting_cord',(-2.2,.68,2.69),(2.2,.68,2.69),.018,'trim')
    for i in range(9):
        x=-2.1+i*.48
        mesh('festival_flag',[(x,.66,2.68),(x+.36,.66,2.68),(x+.18,.66,2.27)],[(0,1,2),(2,1,0)],'roof' if i%2 else 'light')
    cone('mic_base',(0,-.3,.44),.19,.19,.08,'metal')
    beam('mic_stand',(0,-.3,.48),(0,-.3,1.55),.025,'metal')
    ball('microphone',(0,-.34,1.58),(.06,.12,.06),'metal')

def tree(kind):
    cone('trunk',(0,0,.65),.18,.12,1.3,'wood')
    if kind=='a':
        for x,y,z,s in [(-.42,0,1.65,.7),(.4,.1,1.8,.75),(0,0,2.25,.8)]:
            ball('canopy',(x,y,z),(s,s,s),'leaf')
    else:
        for z,r in [(1.2,.85),(1.8,.65),(2.35,.4)]:
            cone('pine_tier',(0,0,z),r,0,1.2,'leaf')

def lantern():
    cone('foot',(0,0,.08),.24,.18,.16,'stone')
    cone('post',(0,0,.95),.055,.055,1.8,'metal')
    box('glow',(0,0,1.88),(.24,.24,.34),'light')
    for x in (-.15,.15):
        for y in (-.15,.15):
            box('frame',(x,y,1.88),(.04,.04,.4),'metal')
    cone('cap',(0,0,2.14),.27,0,.2,'roof',4)

def bench():
    for x in (-.65,.65):
        for y in (-.2,.2):
            box('leg',(x,y,.23),(.1,.1,.46),'metal')
    for y in (-.22,0,.22):
        box('seat',(0,y,.48),(1.7,.18,.12),'wood')
    for x in (-.65,.65):
        box('back_support',(x,.26,.71),(.08,.08,.6),'metal')
    for z in (.73,.94):
        box('back_slat',(0,.27,z),(1.7,.1,.16),'wood')

def fence():
    for x in (-.9,.9):
        box('post',(x,0,.5),(.16,.16,1),'wood')
        cone('post_cap',(x,0,1.04),.14,0,.12,'accent',4)
    for z in (.32,.73):
        box('rail',(0,0,z),(2,.1,.12),'wall')

def crater():
    n=16
    verts=[]
    for radius,z in [(1.3,0),(1.02,.27),(.68,.06),(.22,.025)]:
        verts += [(radius*math.cos(i*2*math.pi/n),radius*math.sin(i*2*math.pi/n),z) for i in range(n)]
    faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(3) for i in range(n)]
    faces.append(tuple(range(3*n,4*n)))
    mesh('crater_bowl',verts,faces,'soil')
    for i in range(8):
        a=i*math.pi/4
        ball('rim_rock',(1.12*math.cos(a),1.12*math.sin(a),.19),(.18,.15,.19),'stone')

def cap():
    cone('cap',(0,0,.16),.34,.24,.32,'accent',12)
    box('bill',(0,-.32,.04),(.52,.4,.08),'accent')

def crown():
    cone('band',(0,0,.1),.34,.34,.2,'light',12)
    for i in range(6):
        a=i*math.pi/3
        cone('point',(.28*math.cos(a),.28*math.sin(a),.29),.105,0,.26,'light',4)
    ball('jewel',(0,-.35,.12),(.07,.035,.07),'accent')

def beanie():
    cone('cuff',(0,0,.065),.35,.35,.13,'roof',12)
    cone('knit',(0,0,.23),.34,.19,.32,'roof',12)
    ball('pom',(0,0,.45),(.12,.12,.12),'wall')

def dog():
    for x in (-.18,.18):
        for y in (-.27,.27):
            box('paw',(x,y,.16),(.16,.17,.32),'fur')
    ball('body',(0,0,.43),(.32,.52,.3),'fur')
    ball('head',(0,-.4,.68),(.29,.28,.28),'fur')
    ball('muzzle',(0,-.65,.59),(.18,.16,.13),'wall')
    ball('nose',(0,-.79,.63),(.07,.04,.055),'metal')
    for x in (-.24,.24):
        ball('ear',(x,-.38,.65),(.11,.14,.25),'trim')
        ball('eye',(x*.6,-.63,.76),(.035,.03,.035),'metal')
    beam('tail',(0,.35,.48),(0,.65,.82),.065,'fur')
    box('collar',(0,-.25,.49),(.5,.09,.09),'accent')

BUILDERS = {**{f'house_lv{i}':lambda i=i: house(i) for i in range(1,4)},
 'shop':shop,'mayor_stage':stage,'tree_a':lambda:tree('a'),'tree_b':lambda:tree('b'),
 'lantern':lantern,'bench':bench,'fence':fence,'crater':crater,
 'path_tile':lambda:box('paver',(0,0,.035),(1,1,.07),'path'),
 'hat_cap':cap,'hat_crown':crown,'hat_beanie':beanie,'pet_dog':dog}

if __name__ == '__main__':
    for name, builder in BUILDERS.items():
        reset()
        builder()
        export(name)
