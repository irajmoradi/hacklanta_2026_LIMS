"""Distinct storefront architecture, retaining the captured placement envelopes."""
import sys, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
from village_kit import roof
from town_kit import ring, sign_icon
sys.path.insert(0,str(ROOT/'assets'))
from nature_spec_009 import BUILDINGS

BASE=json.loads((ROOT/'assets/buildings_baseline_009.json').read_text())
PALETTE.update(neon_cyan='#49E9EF',neon_pink='#EE52AB',paper='#FFF0CF')

def label(text,loc,size=.42,material='light'):
    bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,0))
    obj=bpy.context.object
    obj.data.body=text
    obj.data.align_x='CENTER'
    obj.data.size=size
    obj.data.resolution_u=1
    obj.data.extrude=.002
    obj.data.materials.append(mat(material))
    bpy.ops.object.convert(target='MESH')
    obj.name='sign_'+text.lower().replace(' ','_')

def glow(material):
    bsdf=mat(material).node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Emission Color'].default_value=mat(material).diffuse_color
    bsdf.inputs['Emission Strength'].default_value=2

def books(x,y,z):
    for i in range(7):
        box('book',(x+i*.16,y,z+.16+(i%3)*.04),(.12,.22,.32+(i%3)*.08),['roof','accent','light'][i%3])

def build(name):
    # Open display fronts: the window glazing is behind the exhibits.
    h=2.4
    box('foundation',(0,0,.10),(6.4,5.8,.20),'stone')
    box('rear_wall',(0,2.35,1.3),(6,.3,2.2),'wall')
    for x in (-2.85,2.85): box('side_wall',(x,0,1.3),(.3,4.6,2.2),'wall')
    box('floor',(0,0,.22),(5.8,5.2,.04),'trim')
    box('window_back',(0,-1.75,1.25),(5.4,.06,1.9),'glass')
    for x in (-2.8,0,2.8): box('front_post',(x,-2.6,1.3),(.12,.16,2.2),'accent')
    box('door',(0,-2.63,.9),(.8,.08,1.4),'accent')
    if name=='arcade':
        box('flat_roof',(0,0,2.5),(6.6,5.7,.2),'roof')
        box('marquee',(0,-2.8,2.7),(5.8,.4,.85),'metal')
        for z in (2.26,3.14): box('neon_edge',(0,-3.03,z),(6,.08,.07),'neon_pink')
        label('ARCADE',(0,-3.04,2.52),.62,'neon_cyan')
        glow('neon_cyan'); glow('neon_pink')
        for i in range(12):
            ball('bulb',(-2.65+i*.48,-3.05,3.08),(.045,.04,.045),'light')
        for x in (-2.1,-1.2,1.2,2.1):
            box('cabinet',(x,-2.27,.86),(.62,.55,1.25),'metal')
            box('screen',(x,-2.56,1.14),(.46,.02,.43),'neon_cyan')
            box('controls',(x,-2.65,.77),(.64,.22,.1),'neon_pink')
            for dx in (-.12,.12): ball('button',(x+dx,-2.67,.84),(.045,.045,.03),'light')
        for i in range(12):
            for j in range(3): box('checker',(-2.75+i*.5,-2.75+j*.5,.26),(.5,.5,.015),'wall' if (i+j)%2 else 'metal')
    elif name=='storefront_bakery':
        roof(2.4,6.6,5.7,1.5)
        box('chimney',(1.9,1.3,3.8),(.55,.6,1.8),'roof')
        smoke=ball('chimney_smoke',(1.9,1.3,4.9),(.28,.28,.36),'paper')
        for i in range(12): box('striped_awning',(-2.75+i*.5,-2.7,2.0),(.5,1.1,.15),'roof' if i%2 else 'paper')
        for x in (-1.8,1.5):
            box('bread_shelf',(x,-2.3,.8),(1.5,.65,.1),'wood')
            for j in range(4): ball('bread',(x-.5+j*.32,-2.35,1.0),(.14,.25,.13),'hay')
        label('BAKERY',(0,-2.88,2.8),.5)
    elif name=='library':
        box('upper_storey',(-.9,.3,3.0),(4.0,4.6,1.5),'wall')
        roof(3.75,6.6,5.7,.8)
        box('bay_base',(1.65,-2.65,.5),(2.15,1.0,.7),'roof')
        box('bay_glass',(1.65,-2.13,1.4),(1.9,.07,1.3),'glass')
        for z in (.88,1.4):
            box('bay_shelf',(1.65,-2.7,z),(2,.6,.07),'wood')
            books(.82,-2.85,z+.05)
        for x in (.65,2.65): box('bay_frame',(x,-2.95,1.35),(.1,.1,1.5),'accent')
        box('bay_cap',(1.65,-2.65,2.17),(2.3,1.1,.17),'roof')
        label('BOOKSHOP',(-.65,-2.75,2.65),.38)
    elif name=='storefront_cafe':
        cone('round_roof',(0,0,2.6),3.1,1.2,.9,'roof',12)
        box('pergola',(0,-2.7,2.25),(6,.95,.12),'wood')
        for x in (-2.6,2.6): beam('porch_post',(x,-3,0),(x,-3,2.4),.07,'wood')
        for x in (-1.6,1.6):
            cone('table',(x,-2.8,.72),.5,.5,.08,'wood')
            beam('table_leg',(x,-2.8,.1),(x,-2.8,.7),.06,'metal')
            cone('cup',(x,-2.8,.86),.09,.11,.2,'paper')
        label('CAFE',(0,-2.9,2.55),.52)
        sign_icon(name,3.3)
    elif name=='storefront_records':
        obj=box('slanted_roof',(0,0,2.7),(6.6,5.7,.18),'roof'); obj.rotation_euler.y=.12
        ring('rooftop_vinyl',(-1.6,0,3.65),.82,.25,'metal',True)
        ball('record_label',(-1.6,-.15,3.65),(.28,.05,.28),'accent')
        for x in (-1.7,1.7):
            box('record_bin',(x,-2.35,.6),(1.5,.65,.6),'wood')
            for i in range(6): box('record_sleeve',(x-.58+i*.23,-2.35,.99),(.17,.4,.35),'accent' if i%2 else 'roof')
        label('VINYL',(1,-2.9,2.5),.48)
    elif name=='gym':
        # Barrel vault, open front and exercise silhouettes.
        verts=[]
        for y in (-2.85,2.85):
            verts.extend([(math.cos(i*math.pi/10)*3.3,y,2.4+math.sin(i*math.pi/10)*1.4) for i in range(11)])
        mesh('barrel_roof',verts,[(i,i+1,i+12,i+11) for i in range(10)],'roof')
        for x in (-1.6,1.6):
            box('rack',(x,-2.2,.75),(1.25,.6,.12),'metal')
            for dx in (-.45,.45): beam('rack_post',(x+dx,-2.2,.2),(x+dx,-2.2,1.65),.06,'metal')
            beam('barbell',(x-.7,-2.2,1.4),(x+.7,-2.2,1.4),.05,'metal')
            for dx in (-.6,.6): ball('weight',(x+dx,-2.2,1.4),(.12,.25,.25),'accent')
        label('GYM',(0,-2.95,2.75),.65)
    elif name=='town_hall':
        roof(2.5,6.6,5.7,.8)
        box('clock_tower',(0,.3,3.6),(1.5,1.6,2.4),'wall')
        cone('tower_cap',(0,.3,5),1.18,0,1,'roof',4)
        for x in (-2.4,-1.4,1.4,2.4): cone('column',(x,-2.9,1.35),.14,.14,2.7,'wall')
        box('portico',(0,-2.8,2.65),(5.6,.8,.2),'accent')
        ring('clock',(0,-.54,4.1),.47,.06,'light',True)
        beam('hand',(0,-.61,4.1),(0,-.61,4.44),.025,'metal')
        beam('hand',(0,-.61,4.1),(.24,-.61,4.1),.025,'metal')
        label('TOWN HALL',(0,-3.22,2.74),.38)
    elif name=='studio_art':
        for i in range(3):
            x=-2.2+i*2.2
            mesh('sawtooth_roof',[(x-1.1,-2.85,2.4),(x+1.1,-2.85,3.4),(x+1.1,2.85,3.4),(x-1.1,2.85,2.4)],[(0,1,2,3)],'roof')
            box('clerestory',(x+1.08,0,2.9),(.04,5.5,1),'glass')
        for x in (-1.7,1.7):
            beam('easel',(x,-2.3,.2),(x,-2.3,1.75),.055,'wood')
            box('canvas',(x,-2.5,1.3),(.8,.07,.9),'paper')
            for j,m in enumerate(('roof','accent','light')): ball('paint',(x-.22+j*.22,-2.55,1.25),(.15,.02,.22),m)
        label('ART STUDIO',(0,-2.9,2.45),.42)
    elif name=='pet_shelter':
        roof(2.4,6.6,5.7,1.2)
        for x in (-1.6,1.6):
            box('kennel',(x,-2.1,.65),(1.5,1.1,1.1),'wood')
            box('kennel_door',(x,-2.67,.57),(.7,.035,.9),'metal')
            obj=cone('kennel_roof',(x,-2.1,1.35),1.1,0,.7,'roof',4); obj.rotation_euler.z=math.pi/4
        label('PET SHELTER',(0,-2.9,2.55),.42)
        for dx,z in [(-.3,3.25),(-.1,3.4),(.1,3.4),(.3,3.25),(0,3.05)]: ball('paw',(dx,-1,z),(.13,.07,.14),'light')
    elif name=='shop':
        roof(2.4,6.6,5.7,.75)
        box('false_front',(0,-2.95,2.9),(5.2,.3,1.25),'wall')
        box('cornice',(0,-2.95,3.55),(5.6,.5,.18),'trim')
        label('GENERAL STORE',(0,-3.12,2.85),.46,'accent')
        for x in (-1.7,1.7):
            box('crate',(x,-2.5,.5),(1.4,.7,.55),'wood')
            for i in range(5): ball('produce',(x-.5+i*.25,-2.5,.87),(.14,.16,.14),'light')

for name in BUILDINGS:
    reset()
    if name=='colosseum':
        # Keep arena geometry and all gameplay hooks, rebuild the entry silhouette.
        bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/baseline_009'/f'{name}.glb'))
        for x in (-2.7,2.7):
            box('entry_tower',(x,-9.1,2.8),(1.2,1.3,5.6),'wall')
            cone('entry_cap',(x,-9.1,6.15),1,0,1.1,'roof',4)
            box('entry_banner',(x,-9.77,4.3),(.7,.06,1.7),'accent')
        box('entry_marquee',(0,-9.65,4.25),(4.3,.4,.9),'roof')
        label('VILLAGE ARENA',(0,-9.88,4.13),.35,'light')
    else: build(name)
    # Fit exactly to the original horizontal envelope, preserving root and Y=0.
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    pts=[o.matrix_world@v.co for o in objs for v in o.data.vertices]
    old=BASE[name]['bounds']
    for axis,glaxis in ((0,0),(1,2)):
        lo=min(p[axis] for p in pts); hi=max(p[axis] for p in pts)
        targetlo,targethi=(old[0][0],old[1][0]) if axis==0 else (-old[1][2],-old[0][2])
        factor=(targethi-targetlo)/(hi-lo)
        # Bake world-space adjustment into vertices, including imported hierarchy.
        for obj in objs:
            inv=obj.matrix_world.inverted()
            for v in obj.data.vertices:
                p=obj.matrix_world@v.co
                p[axis]=targetlo+(p[axis]-lo)*factor
                v.co=inv@p
    export(name)
