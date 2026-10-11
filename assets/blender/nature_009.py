"""Original, deterministic single-mesh vegetation; no providers or textures."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *
sys.path.insert(0, str(ROOT / 'assets'))
from nature_spec_009 import *

PALETTE.update(bark='#805A40', flower='#EB7094')

def sprig(x, y, z, h, bloom=True):
    beam('stem', (x,y,z), (x,y,z+h), .023, 'leaf')
    ball('leaf', (x+.09,y,z+h*.45), (.17,.06,.075), 'leaf')
    if bloom: ball('flower', (x,y,z+h), (.12,.12,.13), 'flower')

def tree(key):
    h = 1.8 if key == 'sapling' else 4.6 if key == 'pine_tall' else 3.2
    if key.startswith('pine'):
        cone('trunk', (0,0,h/2), .16,.08,h,'bark')
        for z,r in ((h*.42,1.05),(h*.64,.85),(h*.84,.6)):
            cone('needles',(0,0,z),r,0,h*.6,'leaf',10)
    elif key == 'palm':
        beam('trunk',(0,0,0),(.4,0,3.4),.14,'bark')
        for i in range(8):
            a=i*math.tau/8
            x,y=math.cos(a),math.sin(a)
            mesh('frond',[(.4,0,3.5),(.4+x*.9-y*.3,y*.9+x*.3,3.7),(.4+x*1.9,y*1.9,2.8),(.4+x*.9+y*.3,y*.9-x*.3,3.7)],[(0,1,2),(0,2,3)],'leaf')
        mat('leaf').use_backface_culling=False
    else:
        cone('trunk',(0,0,h*.4),.20 if key!='sapling' else .08,.075,h*.8,'bark')
        for i in range(6):
            a=i*2.4; r=.8 if key!='sapling' else .42
            x,y=math.cos(a)*r,math.sin(a)*r
            z=h*(.63+.08*(i%3))
            beam('branch',(0,0,h*.4),(x,y,z),.065,'bark')
            if key=='dead':
                beam('twig',(x*.7,y*.7,z*.85),(x*1.25,y*1.25,z+.45),.035,'bark')
                continue
            scale=(.65,.65,1.1) if key=='birch' else (.9,.85,.65) if key.startswith('cherry') else (.8,.75,.85)
            if key=='sapling': scale=(.38,.32,.43)
            if key=='maple_autumn':
                cone('maple_lobes',(x,y,z),.85,.2,1.15,'leaf',5)
            else:
                if key=='cherry_white': scale=(1.05,.9,.4)
                ball('crown',(x,y,z),scale,'leaf')
            if key=='willow':
                for j in range(3):
                    cone('drooping_leaf',(x+(j-1)*.24,y,z-.9),.09,.27,1.8,'leaf',5)
            if key=='apple':
                for j in range(3): ball('apple',(x+(j-1)*.3,y-.55,z-.15),(.13,.13,.13),'flower')
        if key=='birch':
            PALETTE['bark']='#E9E1CC'
            for i in range(7): box('bark_mark',(0,-.14,.25+i*.28),(.19,.02,.055),'flower')

def bush(key):
    if key=='topiary_spiral':
        cone('trunk',(0,0,.85),.06,.05,1.7,'bark')
        for i in range(22):
            a=i*.65; r=.42*(1-i/27)
            ball('spiral',(math.cos(a)*r,math.sin(a)*r,.25+i*.075),(.21,.21,.16),'leaf')
    elif key=='topiary_ball':
        cone('trunk',(0,0,.4),.07,.05,.8,'bark')
        ball('ball',(0,0,1),(.6,.6,.6),'leaf')
    elif key in ('hedge','boxwood'):
        box('clipped_hedge',(0,0,.48),(2.4 if key=='hedge' else 1.15,.7,.96),'leaf')
        for x in (-.35,.35): cone('trunk',(x,0,.12),.045,.045,.24,'bark')
    else:
        for i in range(5):
            x,y=math.cos(i*2.4)*.4,math.sin(i*2.4)*.35
            ball('bush',(x,y,.42),(.45,.4,.42),'leaf')
            for j in range(3):
                s=.055 if key=='berry_bush' else .12
                ball('bloom',(x+(j-1)*.17,y-.3,.62),(s,s,s),'flower')

def garden(key):
    box('bed',(0,0,.04),(2.2,1.5,.08),'bark')
    if key=='tomatoes':
        for y in (-.72,.72): box('raised_side',(0,y,.19),(2.2,.08,.38),'bark')
        for x in (-1.06,1.06): box('raised_end',(x,0,.19),(.08,1.5,.38),'bark')
    for i in range(5):
        for j in range(3):
            if key=='sunflowers' and (i%2 or j==1): continue
            if key=='lavender' and (j==1 or i==4): continue
            if key=='tomatoes' and i%2: continue
            x,y=(i-2)*.4,(j-1)*.43
            if key=='rock_garden':
                if (i+j)%2: ball('rock',(x,y,.17),(.22,.18,.2),'bark')
                else: sprig(x,y,.08,.18,False)
            elif key=='pumpkin_patch':
                ball('vine',(x,y,.13),(.22,.18,.055),'leaf')
                if (i+j)%2:
                    ball('pumpkin',(x,y,.27),(.23,.20,.21),'flower')
                    cone('stalk',(x,y,.48),.025,.025,.1,'bark',5)
            elif key=='vegetable_patch':
                for a in range(3): ball('cabbage',(x+.07*math.cos(a*2),y+.07*math.sin(a*2),.17),(.14,.12,.12),'leaf')
            elif key=='tomatoes':
                beam('stake',(x,y,.08),(x,y,1),.018,'bark')
                sprig(x,y,.08,.65,False)
                for z in (.4,.6,.75): ball('tomato',(x+.07,y-.05,z),(.085,.085,.085),'flower')
            elif key=='sunflowers':
                sprig(x,y,.08,.85+(i%2)*.15,False)
                z=.93+(i%2)*.15
                for a in range(7): ball('petal',(x+math.cos(a*math.tau/7)*.13,y-.02,z+math.sin(a*math.tau/7)*.13),(.095,.045,.09),'flower')
                ball('seed',(x,y-.065,z),(.085,.04,.085),'bark')
            elif key=='lavender':
                for a in (-1,1):
                    sprig(x+a*.08,y,.08,.4+a*.05,False)
                    cone('lavender',(x+a*.08,y,.52+a*.05),.045,.02,.23,'flower',5)
            else:
                sprig(x,y,.08,.32+((i*3+j)%4)*.08)
                if key=='tulips': cone('cup',(x,y,.45+((i*3+j)%4)*.08),.06,.13,.16,'flower',6)

def detail(key):
    if key in ('rocks','stump','log'):
        if key=='rocks':
            for x,y,s in [(-.3,0,.5),(.35,.2,.35),(.2,-.3,.22)]: ball('rock',(x,y,s*.42),(s,s*.7,s*.5),'bark')
        elif key=='stump':
            cone('stump',(0,0,.3),.36,.28,.6,'bark',9)
            cone('cut',(0,0,.605),.25,.25,.01,'flower',9)
        else:
            beam('log',(-.85,0,.2),(.85,0,.2),.2,'bark')
            beam('end',(.85,0,.2),(.86,0,.2),.16,'flower')
            beam('branch',(.2,0,.2),(.4,.4,.5),.08,'bark')
    elif key=='mushrooms':
        for x,y,h in [(-.2,0,.4),(.2,.1,.27),(0,-.25,.2)]:
            cone('stem',(x,y,h/2),.035,.035,h,'bark')
            cone('cap',(x,y,h),h*.5,.025,h*.3,'flower',9)
    elif key=='lily_pads':
        for x,y,r in [(-.4,0,.35),(.3,.25,.3),(.25,-.3,.22)]:
            verts=[(x,y,.01)]+[(x+math.cos(i*math.tau/12)*r,y+math.sin(i*math.tau/12)*r,.01) for i in range(12)]
            mesh('pad',verts,[(0,i,i+1) for i in range(1,12)],'leaf')
        ball('flower',(-.4,0,.09),(.13,.13,.08),'flower')
    else:
        for i in range(15):
            a=i*2.4; r=.07*(i%4); x,y=math.cos(a)*r,math.sin(a)*r
            h=.3+(i%5)*.09
            mesh('blade',[(x-.025,y,0),(x+.025,y,0),(x+math.cos(a)*.25,y+math.sin(a)*.25,h)],[(0,1,2)],'leaf')
            if key=='fern':
                for j in range(3): ball('frond',(x+math.cos(a)*.1,y+math.sin(a)*.1,.15+j*.1),(.13,.06,.035),'leaf')

for name in NAMES:
    reset()
    key=name.removeprefix('nature_')
    PALETTE.update(metadata(name)['variants'][0]['materials'])
    if key=='apple' or key=='tomatoes': PALETTE['flower']='#D84D38'
    if key=='pumpkin_patch': PALETTE['flower']='#ED8C32'
    if key=='birch': PALETTE.update(bark='#E9E1CC',flower='#514539')
    if key in TREES: tree(key)
    elif key in BUSHES: bush(key)
    elif key in GARDENS: garden(key)
    else: detail(key)
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # Ground even irregular rock/log geometry; pads sit directly on the water.
    low=min(v.co.z for v in obj.data.vertices)
    for v in obj.data.vertices: v.co.z-=low
    export(name)
