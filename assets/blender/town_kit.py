"""Deterministic town and wardrobe expansion; no network or external assets."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
from village_kit import roof, window, bench
sys.path.insert(0,str(ROOT/'assets'))
from town_spec import *


def ring(name, loc, radius, tube, material, vertical=False, scale=(1,1,1)):
    bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=4,
        location=loc,major_radius=radius,minor_radius=tube)
    obj=bpy.context.object
    obj.scale=scale
    if vertical: obj.rotation_euler.x=math.pi/2
    return finish(obj,name,material)


def tile(name):
    box('tile',(0,0,.05),(4,4,.1),'path')
    if name.startswith('road') or name=='crosswalk':
        box('asphalt',(0,0,.105),(4,4,.01),'metal')
        connections={'road_straight':{0,2},'crosswalk':{0,2},'road_corner':{0,1},
                     'road_t':{0,1,3},'road_cross':{0,1,2,3}}[name]
        for x in (-1.75,1.75):
            for y in (-1.75,1.75): box('corner_pavement',(x,y,.16),(.5,.5,.12),'path')
        for side in range(4):
            a=side*math.pi/2
            if side not in connections:
                box('closed_edge',(1.75*math.sin(a),-1.75*math.cos(a),.16),
                    (3,.5,.12) if side%2==0 else (.5,3,.12),'path')
            else:
                if name!='crosswalk':
                    for d in (1,1.65):
                        obj=box('lane_dash',(d*math.sin(a),-d*math.cos(a),.116),(.055,.36,.012),'light')
                        obj.rotation_euler.z=a
        if name=='crosswalk':
            for x in (-1.2,-.8,-.4,0,.4,.8,1.2):
                box('zebra',(x,0,.118),(.24,1.25,.016),'wall')
    else:
        for i in range(-1,2):
            box('paver_joint',(i,0,.104),(.018,4,.008),'stone')
            box('paver_joint',(0,i,.104),(4,.018,.008),'stone')
        if name=='plaza_tile':
            obj=box('inlay',(0,0,.115),(1.1,1.1,.02),'accent'); obj.rotation_euler.z=math.pi/4
        if name=='curb_corner':
            box('curb_edge',(-1.8,-.4,.17),(.16,3.2,.14),'wall')
            box('curb_edge',(.4,1.8,.17),(3.2,.16,.14),'wall')
            for i in range(9):
                a=i*math.pi/16
                obj=box('rounded_curb',(-1.2-.6*math.cos(a),1.2+.6*math.sin(a),.17),(.16,.13,.14),'wall')
                obj.rotation_euler.z=-a


def prop(name):
    if name=='streetlight':
        cone('base',(0,0,.1),.22,.16,.2,'stone')
        beam('pole',(0,0,.2),(0,0,3),.06,'metal')
        beam('arm',(0,0,3),(0,-.65,3),.055,'metal')
        box('lamp',(0,-.65,2.95),(.42,.65,.13),'light')
    elif name=='bus_stop':
        box('pad',(0,0,.07),(3.5,1.5,.14),'path')
        for x in (-1.55,1.55): box('post',(x,.5,1.25),(.1,.1,2.5),'metal')
        box('shelter_roof',(0,0,2.5),(3.5,1.5,.15),'accent')
        box('rear_glass',(0,.54,1.4),(3,.05,1.6),'glass')
        bench()
        box('bus_sign',(-1.55,-.05,2.1),(.5,.08,.5),'light')
    elif name=='bike_rack':
        box('base',(0,0,.05),(2.7,.7,.1),'stone')
        for x in (-1,-.5,0,.5,1):
            ring('bike_hoop',(x,0,.52),.4,.045,'metal',True)
    elif name=='trash_bin':
        cone('bin',(0,0,.4),.29,.34,.8,'accent',12)
        cone('lid',(0,0,.84),.37,.28,.08,'metal',12)
        box('slot',(0,-.34,.68),(.3,.025,.11),'metal')
    elif name=='planter':
        box('planter',(0,0,.24),(1.1,1.1,.48),'roof')
        box('soil',(0,0,.49),(.96,.96,.04),'soil')
        for x,y in [(-.25,0),(.25,0),(0,.25),(0,-.25)]:
            ball('plant',(x,y,.8),(.3,.3,.4),'leaf')
            ball('flower',(x,y,1.12),(.12,.12,.12),'blossom')
    elif name=='traffic_cone':
        box('foot',(0,0,.04),(.5,.5,.08),'metal')
        cone('cone',(0,0,.36),.2,.035,.56,'fire')
        cone('stripe',(0,0,.4),.111,.086,.085,'wall')
    elif name=='hedge_row':
        box('soil',(0,0,.075),(4,.8,.15),'soil')
        for x in (-1.5,-.75,0,.75,1.5): ball('hedge',(x,0,.65),(.5,.5,.65),'leaf')


def sign_icon(name,z):
    y=-3.12
    if name=='storefront_records':
        ring('vinyl',(0,y,z),.36,.12,'metal',True)
        ball('label',(0,y-.015,z),(.13,.035,.13),'accent')
    elif name=='storefront_cafe':
        box('cup',(0,y,z),(.48,.15,.42),'wall')
        ring('handle',(.29,y,z),.14,.04,'wall',True)
        for x in (-.12,.12): beam('steam',(x,y,z+.3),(x+.08,y,z+.48),.025,'light')
    elif name=='storefront_bakery':
        ball('loaf',(0,y,z),(.55,.13,.22),'hay')
        for x in (-.25,0,.25): beam('bread_score',(x-.05,y-.12,z-.06),(x+.06,y-.12,z+.1),.025,'wall')
    elif name=='gym':
        beam('bar',(-.5,y,z),(.5,y,z),.055,'metal')
        for x in (-.42,.42): box('weight',(x,y,z),(.17,.2,.55),'metal')
    elif name=='library':
        for x in (-.23,.23):
            obj=box('book',(x,y,z),(.43,.13,.55),'wall'); obj.rotation_euler.y=x*.5
    elif name=='studio_art':
        ball('palette',(0,y,z),(.55,.1,.32),'wood')
        for x,m in [(-.3,'roof'),(0,'accent'),(.3,'light')]: ball('paint',(x,y-.1,z),(.09,.025,.09),m)
    elif name=='arcade':
        for x,zoff in [(-.3,.2),(0,.2),(.3,.2),(-.3,0),(0,0),(.3,0),(-.45,-.2),(.45,-.2)]:
            box('pixel',(x,y,z+zoff),(.19,.15,.19),'leaf')
    elif name=='town_hall':
        ring('clock',(0,y,z),.4,.065,'light',True)
        beam('hand',(0,y-.02,z),(0,y-.02,z+.28),.025,'wall')
        beam('hand',(0,y-.02,z),(.22,y-.02,z),.025,'wall')


def building(name):
    house=name.startswith('house')
    lv5='lv5' in name
    floors=3 if lv5 or name=='apartment_small' else 2 if house or name in ('town_hall','library') else 1
    h=floors*1.65
    box('foundation',(0,0,.12),(6.4,5.8,.24),'stone')
    box('walls',(0,0,.24+h/2),(6,5.2,h),'wall')
    roof(h+.24,6.6,5.7,.9 if house else .45)
    for floor in range(floors):
        z=.24+floor*1.65
        box('cornice',(0,0,z+.06),(6.15,5.35,.12),'trim')
        for x in (-2.25,-1.05,1.05,2.25): window(x,-2.63,z+.85)
        if floor and (house or name=='apartment_small'):
            box('balcony',(0,-2.95,z),(2.6,.65,.15),'accent')
            for x in (-1.2,-.6,0,.6,1.2): box('baluster',(x,-3.25,z+.32),(.055,.06,.65),'metal')
            box('rail',(0,-3.25,z+.65),(2.6,.08,.08),'accent')
    box('door',(0,-2.65,.86),(.85,.12,1.25),'accent')
    box('step',(0,-2.95,.12),(1.4,.6,.24),'stone')
    if house:
        for x in (-2.3,2.3):
            box('flower_box',(x,-2.85,.45),(.8,.35,.3),'wood')
            for dx in (-.25,0,.25): ball('flower',(x+dx,-2.85,.68),(.17,.15,.17),'blossom')
        box('chimney',(2,1.5,h+.85),(.45,.55,1.2),'stone')
        if lv5:
            cone('tower',(2,1,h+.9),.65,.65,1.6,'wall')
            cone('spire',(2,1,h+2.1),.82,0,1.1,'roof')
        if name.endswith('_b'):
            mat('wall').diffuse_color=mat('accent').diffuse_color
            mat('wall').node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=mat('accent').diffuse_color
            for x in (-2.65,2.65): box('corner_stone',(x,-2.66,h/2),(.18,.14,h),'wall')
    else:
        box('signboard',(0,-3,h+.25),(2.2,.17,1.1),'roof')
        sign_icon(name,h+.25)
        if name=='town_hall':
            for x in (-2.7,2.7): cone('column',(x,-3.15,1.65),.16,.16,3.3,'wall')
        elif name!='apartment_small':
            for i in range(10): box('awning',(-2.7+i*.6,-3,1.52),(.6,.85,.12),'accent' if i%2 else 'wall')
        if name=='storefront_cafe':
            cone('table_leg',(2.4,-3.45,.4),.08,.08,.8,'metal')
            cone('table',(2.4,-3.45,.82),.42,.42,.08,'wood')


def clothing(name):
    # Reuse the exact exported bind skeleton, discarding the body and clips.
    bpy.ops.import_scene.gltf(filepath=str(OUT/'villager_base.glb'))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    for obj in list(bpy.context.scene.objects):
        if obj!=rig: bpy.data.objects.remove(obj,do_unlink=True)
    rig.animation_data_clear()
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for bone in rig.pose.bones: bone.matrix_basis.identity()
    # Remove unused avatar materials to preserve exact tint names.
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    def weight(obj,bone):
        obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))),1,'REPLACE')
        obj.modifiers.new('Skeleton','ARMATURE').object=rig
        obj.parent=rig
        return obj
    if name.startswith('shirt'):
        weight(cone('torso',(0,0,.88),.257,.317,.50,'shirt'),'Spine')
        for side,x in [('L',.37),('R',-.37)]:
            long=name!='shirt_tee'
            weight(cone('sleeve',(x,0,.89 if long else .98),.12,.135,.45 if long else .26,'shirt'),'Arm_'+side)
        if name=='shirt_hoodie':
            weight(ring('hood',(0,.08,1.12),.21,.08,'shirt',scale=(1,1,.65)),'Spine')
            weight(box('pocket',(0,-.263,.78),(.27,.035,.13),'accent'),'Spine')
            for x in (-.08,.08): weight(beam('drawstring',(x,-.29,1.07),(x,-.29,.93),.012,'wall'),'Spine')
        if name=='shirt_flannel':
            mat('shirt').node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=mat('roof').diffuse_color
            def surface(x,z):
                r=.257+.06*(z-.63)/.5
                return (x,-r+abs(x)*(math.sqrt(2)-1)-.003,z)
            for x in (-.15,-.075,0,.075,.15):
                weight(mesh('plaid_vertical',[surface(x-.009,.65),surface(x+.009,.65),surface(x+.009,1.11),surface(x-.009,1.11)],[(0,1,2,3)],'accent'),'Spine')
            for z in (.7,.8,.9,1):
                verts=[surface(x,zz) for zz in (z-.009,z+.009) for x in (-.17,0,.17)]
                weight(mesh('plaid_horizontal',verts,[(0,1,4,3),(1,2,5,4)],'wall'),'Spine')
    elif name.startswith('pants'):
        weight(box('waist',(0,0,.59),(.415,.305,.195),'pants'),'Root')
        shorts=name=='pants_shorts'
        for side,x in [('L',.14),('R',-.14)]:
            weight(box('leg',(x,0,.445 if shorts else .345),(.205,.245,.22 if shorts else .445),'pants'),'Leg_'+side)
            weight(box('pocket',(x,-.133,.52),(.12,.018,.09),'accent'),'Leg_'+side)
            if shorts: weight(box('exposed_calf',(x,0,.25),(.19,.23,.22),'skin'),'Leg_'+side)
    else:
        for side,x in [('L',.14),('R',-.14)]:
            bone='Leg_'+side
            weight(box('shoe',(x,-.065,.095),(.245,.39,.19),'shoes'),bone)
            weight(box('sole',(x,-.065,.022),(.255,.4,.044),'wall'),bone)
            if name=='shoes_boots': weight(box('boot_top',(x,0,.23),(.23,.265,.3),'shoes'),bone)
            else:
                for y in (-.17,-.11,-.05): weight(box('lace',(x,y,.195),(.16,.025,.018),'wall'),bone)


def accessory(name):
    if name=='backpack':
        box('pack',(0,.055,0),(.43,.24,.46),'accent')
        box('pocket',(0,.19,-.06),(.31,.07,.2),'roof')
        for x in (-.18,.18): ring('strap',(x,-.08,0),.2,.025,'wood',True,scale=(.3,1,1.2))
    elif name=='hat_cowboy':
        cone('brim',(0,0,.035),.51,.51,.07,'wood',16)
        cone('crown',(0,0,.19),.29,.23,.3,'wood',12)
        cone('band',(0,0,.11),.284,.268,.08,'roof',12)
    elif name=='hat_beret':
        cone('band',(0,0,.035),.31,.31,.07,'metal',12)
        ball('beret',(.06,0,.15),(.4,.34,.18),'roof')
        beam('stem',(.07,0,.29),(.09,0,.36),.025,'roof')
    elif name=='hat_party':
        cone('party_hat',(0,0,.34),.31,0,.68,'accent',12)
        ball('pom',(0,0,.73),(.09,.09,.09),'light')
        for z,r in [(.15,.24),(.35,.15),(.53,.07)]: ring('stripe',(0,0,z),r,.025,'blossom')
    elif name=='glasses_sun':
        for x in (-.15,.15):
            box('frame',(x,0,0),(.28,.045,.18),'metal')
            box('lens',(x,-.027,0),(.23,.018,.13),'glass')
            beam('arm',(x*2,0,0),(x*2,.25,0),.018,'metal')
        beam('bridge',(-.04,0,0),(.04,0,0),.022,'metal')
    elif name=='necklace_chain':
        ring('chain',(0,0,0),.29,.023,'light',scale=(1,1,.6))
        ball('pendant',(0,-.3,-.055),(.055,.025,.07),'accent')
    elif name=='wristband_festival':
        ring('band',(0,0,0),.093,.018,'blossom')
        box('ticket',(0,-.1,0),(.12,.03,.06),'light')
    elif name in ('pet_collar','pet_bandana'):
        ring('collar',(0,-.25,.52),.28,.035,'accent',True,scale=(1,1,.78))
        if name=='pet_collar': ball('tag',(0,-.3,.25),(.07,.025,.08),'light')
        else:
            obj=mesh('bandana',[(-.24,-.3,.49),(.24,-.3,.49),(0,-.46,.22)],[(0,1,2)],'roof')
            obj.data.materials[0].use_backface_culling=False


def upgrade(name):
    if name=='upgrade_solar_roof':
        for x in (-.68,0,.68):
            box('frame',(x,0,.055),(.65,1.25,.11),'metal')
            box('panel',(x,0,.12),(.58,1.18,.02),'glass')
            for y in (-.4,0,.4): box('cell',(x,y,.135),(.59,.018,.01),'wall')
    elif name=='upgrade_porch':
        box('deck',(0,0,.15),(3.3,1.5,.3),'wood')
        box('step',(0,-.92,.075),(1.5,.35,.15),'stone')
        for x in (-1.5,1.5):
            for y in (-.6,.6): box('post',(x,y,1.15),(.12,.12,2.3),'wall')
        roof(2.3,3.5,1.7,.45)
    elif name=='upgrade_garden_gnome':
        for x in (-.1,.1): box('shoe',(x,-.04,.06),(.16,.24,.12),'metal')
        cone('body',(0,0,.25),.22,.15,.35,'accent')
        ball('face',(0,0,.48),(.15,.14,.17),'skin')
        cone('beard',(0,-.1,.37),.02,.14,.25,'wall')
        cone('hat',(0,0,.75),.2,0,.42,'roof')
        ball('nose',(0,-.15,.49),(.055,.055,.055),'skin')
    else:
        box('backboard',(0,0,.32),(1.6,.1,.64),'metal')
        for x in (-.55,0,.55):
            beam('neon',(x-.18,-.07,.15),(x,-.07,.48),.035,'blossom')
            beam('neon',(x,-.07,.48),(x+.18,-.07,.15),.035,'light')


if __name__=='__main__':
    for name in NAMES:
        reset()
        if name in TILES: tile(name)
        elif name in STREETS: prop(name)
        elif name in BUILDINGS: building(name)
        elif name in SKINNED: clothing(name)
        elif name in ACCESSORIES: accessory(name)
        else: upgrade(name)
        export(name)
