"""FEAT-008: original low-poly farm kit, metres, named idle pivots."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *

PALETTE.update(barn='#AD443C', cream='#FFF1D2', feathers='#EEC95C', pigeon='#8796A4')
NAMES = ['farm_store','goat_kid','duckling','calf','chicken','paddock_fence','pigeon']

def animal(name):
    reset()
    bird = name in ('duckling','chicken','pigeon')
    coat = 'pigeon' if name == 'pigeon' else 'feathers' if name == 'duckling' else 'cream'
    ball('body_bob',(0,0,.34 if bird else .48),(.22,.32,.23) if bird else (.25,.43,.27),coat)
    ball('head_peck',(0,-.29,.55 if bird else .75),(.17,.19,.18),coat)
    for x in [-.11,.11]:
        ball('eye',(x,-.435,.6 if bird else .8),(.026,.025,.026),'metal')
    if bird:
        beak=cone('beak',(0,-.49,.52),.065,0,.17,'hay',4)
        beak.rotation_euler.x=math.pi/2
        for x in [-.2,.2]: ball('wing_flutter',(x,0,.36),(.055,.23,.13),coat)
        for x in [-.09,.09]: box('foot',(x,-.03,.035),(.065,.16,.07),'hay')
        if name == 'chicken':
            for y in [-.34,-.27,-.2]: ball('comb',(0,y,.72),(.05,.055,.075),'barn')
    else:
        for x in [-.16,.16]:
            for y in [-.25,.25]: box('leg',(x,y,.18),(.09,.1,.36),'wood')
            ball('ear',(x*1.5,-.25,.83),(.14,.065,.08),coat)
            if name == 'goat_kid': cone('horn',(x,-.2,.96),.045,.008,.19,'wood')
        ball('muzzle',(0,-.45,.66),(.15,.09,.09),'fur')
        if name == 'calf':
            for x in [-.22,.22]: ball('spot',(x,.1,.54),(.035,.18,.16),'wood')
        ball('tail',(0,.44,.53),(.06,.15,.06),coat)
    export(name)

def generate():
    for name in ['goat_kid','duckling','calf','chicken','pigeon']: animal(name)
    reset()
    for x in [-1,1]: box('post',(x,0,.4),(.12,.12,.8),'cream')
    for z in [.25,.6]: box('rail',(0,0,z),(2,.08,.09),'cream')
    export('paddock_fence')
    reset()
    box('barn',(0,0,1.15),(3.6,2.6,2.3),'barn')
    for x in [-1.8,1.8]:
        for y in [-1.3,1.3]: box('corner_trim',(x,y,1.18),(.12,.12,2.36),'cream')
    for x in [i*.2 for i in range(-8,9)]: box('siding',(x,-1.31,1.15),(.025,.025,2.3),'wood')
    mesh('roof',[(-2,-1.5,2.3),(2,-1.5,2.3),(0,-1.5,3.35),(-2,1.5,2.3),(2,1.5,2.3),(0,1.5,3.35)],[(0,1,2),(5,4,3),(0,2,5,3),(2,1,4,5)],'cream')
    box('door',(0,-1.35,.8),(1.25,.12,1.6),'wood')
    for x in [-.65,.65]: box('door_trim',(x,-1.44,.85),(.08,.08,1.7),'cream')
    beam('door_brace',(-.55,-1.45,.15),(.55,-1.45,1.5),.04,'cream')
    for x in [-1.5,1.5]:
        box('hay_bale',(x,-1.9,.3),(.75,.65,.6),'hay')
        cone('milk_can',(x,-1.65,.86),.16,.13,.5,'stone')
        cone('can_lid',(x,-1.65,1.14),.18,.08,.08,'metal')
    box('wooden_sign',(0,-1.43,2.02),(1.65,.13,.36),'wood')
    bpy.ops.object.text_add(location=(-.69,-1.51,1.92),rotation=(math.pi/2,0,0))
    sign=bpy.context.object; sign.data.body='FARM STORE'; sign.data.size=.2; sign.data.extrude=.002; sign.data.materials.append(mat('cream'))
    bpy.ops.object.convert(target='MESH')
    export('farm_store')

if __name__ == '__main__': generate()
