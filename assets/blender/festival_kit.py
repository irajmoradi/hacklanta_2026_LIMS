"""ASSET-002: original, deterministic festival props. No external dependencies."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *
from village_kit import house, roof


def group(name, loc, objects):
    """Keep world transforms while assigning an intentional animation pivot."""
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.location = loc
    bpy.context.view_layer.update()
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world
    return root


def ring(name, loc, radius, tube, material, segments=16, axis='Z'):
    bpy.ops.mesh.primitive_torus_add(major_segments=segments, minor_segments=4,
        location=loc, major_radius=radius, minor_radius=tube)
    obj = finish(bpy.context.object, name, material)
    if axis == 'Y':
        obj.rotation_euler.x = math.pi/2
    return obj


def disc(name, loc, radius, depth, material):
    obj = cone(name, loc, radius, radius, depth, material, 12)
    obj.rotation_euler.x = math.pi/2
    return obj


def stage_lights():
    for x in (-2.2, 2.2):
        box('foot', (x, 0, .08), (.8, .8, .16), 'metal')
        for y in (-.16, .16):
            beam('upright', (x,y,.16), (x,y,3.8), .045, 'metal')
    for z in (3.4, 3.8):
        beam('truss_rail', (-2.2,0,z), (2.2,0,z), .05, 'metal')
    for i in range(11):
        x = -2.2 + i*.4
        beam('truss_brace', (x,0,3.4), (x+.4,0,3.8), .025, 'stone')
    for i, x in enumerate((-1.65, -.55, .55, 1.65)):
        beam('hanger', (x,0,3.4), (x,0,3.18), .04, 'metal')
        parts = [disc('lamp_housing', (x,-.05,3.12), .22,.42,'metal'),
                 disc('lamp_lens', (x,-.27,3.12), .18,.025,'light')]
        group('lamp_'+str(i), (x,0,3.18), parts)


def food_truck():
    box('chassis',(0,0,.51),(3.7,1.65,.28),'metal')
    box('kitchen',( .45,0,1.35),(2.7,1.6,1.5),'accent')
    box('cab',(-1.35,0,1.12),(.9,1.6,1.04),'wall')
    box('roof',(.35,0,2.15),(2.95,1.8,.18),'wall')
    box('service_window',(.4,-.815,1.52),(1.65,.045,.65),'metal')
    box('counter',(.4,-1.01,1.16),(1.9,.45,.1),'wood')
    box('windshield',(-1.35,-.82,1.42),(.66,.04,.43),'glass')
    for x in (-1.2,1.2):
        for y in (-.85,.85):
            disc('tire',(x,y,.38),.38,.18,'metal')
            disc('hub',(x,y*1.11,.38),.17,.025,'stone')
    for i in range(8):
        box('awning',(-.64+i*.3,-1.02,1.99),(.3,.55,.09),'roof' if i%2 else 'wall')
    for x in (-1.72,1.72):
        box('running_light',(x,-.83,.85),(.12,.04,.14),'light')
    # A burger emblem reads without text or external branding.
    for z, r, material in [(2.4,.25,'hay'),(2.47,.27,'leaf'),(2.54,.25,'roof'),(2.64,.25,'hay')]:
        cone('burger_emblem',(.4,0,z),r,r,.09,material)


def ferris_wheel():
    box('base',(0,0,.12),(4.9,2.8,.24),'stone')
    for y in (-.8,.8):
        for x in (-1.65,1.65):
            beam('support',(x,y,.24),(0,y,3.25),.12,'accent')
    beam('axle',(0,-1.0,3.25),(0,1.0,3.25),.16,'metal')
    before=set(bpy.data.objects)
    for y in (-.38,.38):
        ring('rim',(0,y,3.25),2.5,.075,'roof',24,'Y')
        for i in range(10):
            a=i*math.tau/10
            beam('spoke',(0,y,3.25),(2.5*math.sin(a),y,3.25+2.5*math.cos(a)),.035,'light')
    gondolas=[]
    for i in range(10):
        a=i*math.tau/10
        x,z=2.5*math.sin(a),3.25+2.5*math.cos(a)
        beam('rim_crossbar',(x,-.38,z),(x,.38,z),.055,'metal')
        old=set(bpy.data.objects)
        for dx in (-.23,.23):
            beam('gondola_hanger',(x+dx,0,z),(x+dx,0,z-.48),.025,'metal')
        box('gondola_seat',(x,0,z-.51),(.64,.65,.12),'accent')
        for dy in (-.3,.3):
            box('gondola_side',(x,dy,z-.36),(.64,.06,.3),'accent')
        gondolas.append(group('gondola_'+str(i),(x,0,z),set(bpy.data.objects)-old))
    objects=set(bpy.data.objects)-before
    wheel=group('wheel',(0,0,3.25),[o for o in objects if o.parent is None])
    wheel['rotation_axis']='glTF local Z; counter-rotate gondola_0..9 by the opposite angle'


def tent_merch():
    for x in (-1.35,1.35):
        for y in (-1.05,1.05):
            beam('tent_post',(x,y,0),(x,y,2.1),.045,'wood')
    for i in range(8):
        a=i*math.tau/8
        b=(i+1)*math.tau/8
        mesh('canopy_panel',[(0,0,2.95),(1.65*math.cos(a),1.4*math.sin(a),2.05),
             (1.65*math.cos(b),1.4*math.sin(b),2.05)],[(0,1,2)],'roof' if i%2 else 'wall')
    box('backdrop',(0,1.02,1.1),(2.7,.06,1.8),'accent')
    box('merch_counter',(0,-.5,.8),(2.5,.55,.15),'wood')
    for x in (-1,1):
        box('counter_leg',(x,-.5,.4),(.12,.4,.8),'wood')
    for x in (-.75,0,.75):
        box('shirt_display',(x,.95,1.45),(.38,.08,.48),'wall')
        box('shirt_sleeves',(x,.95,1.57),(.59,.08,.17),'wall')


def speaker_stack():
    for z in (.5,1.5):
        box('cabinet',(0,0,z),(.8,.65,.96),'metal')
        for dz,r in [(-.15,.25),(.29,.12)]:
            disc('speaker_driver',(0,-.335,z+dz),r,.025,'stone')
            disc('dust_cap',(0,-.36,z+dz),r*.4,.025,'metal')
        box('corner_badge',(.3,-.34,z-.35),(.08,.02,.06),'light')


def string_lights():
    beam('cord',(-5,0,.33),(5,0,.33),.018,'metal')
    for i in range(21):
        x=-4.8+i*.48
        beam('socket_drop',(x,0,.33),(x,0,.17),.022,'metal')
        ball('bulb',(x,0,.09),(.075,.075,.09),'light' if i%2 else 'blossom')


def banner_flag():
    cone('foot',(0,0,.06),.28,.23,.12,'stone')
    beam('pole',(0,0,.12),(0,0,2.6),.035,'wood')
    ball('finial',(0,0,2.64),(.09,.09,.09),'light')
    mesh('banner',[(0,0,2.5),(.85,0,2.5),(.85,0,1.35),(.43,0,1.57),(0,0,1.35)],
         [(0,1,3),(1,2,3),(0,3,4)],'accent')
    disc('emblem',(.43,-.015,2.06),.18,.018,'light')


def picnic_table():
    for x in (-.7,.7):
        for side in (-1,1):
            beam('trestle',(x,side*.65,0),(x,side*.2,.78),.065,'wood')
        box('bench_support',(x,0,.37),(.12,1.8,.13),'wood')
    for y in (-.3,0,.3):
        box('table_plank',(0,y,.82),(2,.27,.1),'wood')
    for y in (-.75,.75):
        box('bench',(0,y,.48),(2,.32,.1),'wood')


def hay_bale():
    box('straw',(0,0,.3),(1,.65,.6),'hay')
    for x in (-.3,.3):
        box('twine_top',(x,0,.605),(.035,.66,.02),'trim')
        for y in (-.33,.33):
            box('twine_side',(x,y,.3),(.035,.02,.6),'trim')
    for z in (.1,.22,.38,.49):
        box('straw_ridge',(0,-.332,z),(.94,.015,.012),'wall')


def pet_shelter():
    box('foundation',(0,0,.09),(3.4,2.6,.18),'stone')
    box('back_wall',(0,1.12,1.0),(3.2,.12,1.8),'wall')
    for x in (-1.5,0,1.5):
        box('partition',(x,0,.85),(.13,2.3,1.5),'wall')
    roof(1.9,3.6,2.8,.7)
    for x in (-.75,.75):
        box('pet_bed',(x,0,.23),(1.1,1.3,.15),'accent')
        cone('bowl',(x,-.85,.25),.19,.23,.15,'metal')
    box('shelter_sign',(0,-1.44,1.72),(1.1,.08,.43),'wood')
    ball('paw_pad',(0,-1.50,1.67),(.12,.025,.10),'light')
    for x,z in [(-.18,1.81),(0,1.87),(.18,1.81)]:
        ball('paw_toe',(x,-1.50,z),(.065,.025,.065),'light')


def fountain():
    cone('base',(0,0,.1),1.2,1.2,.2,'stone',16)
    ring('basin_rim',(0,0,.4),1.08,.14,'stone')
    cone('water',(0,0,.30),1.02,1.02,.025,'water',24)
    cone('pedestal',(0,0,.75),.28,.17,.9,'stone')
    cone('upper_bowl',(0,0,1.25),.25,.65,.22,'stone',12)
    cone('upper_water',(0,0,1.365),.59,.59,.012,'water',16)
    beam('jet',(0,0,1.36),(0,0,1.9),.045,'water')
    ball('jet_tip',(0,0,1.92),(.08,.08,.1),'water')


def lake_patch():
    n=24
    verts=[(0,0,0)]+[(3*(1+.10*math.sin(i*5))*math.cos(i*math.tau/n),
        2*(1+.12*math.cos(i*3))*math.sin(i*math.tau/n),0) for i in range(n)]
    mesh('water',verts,[(0,1+i,1+(i+1)%n) for i in range(n)],'water')


def bridge():
    for i in range(13):
        y=-1.8+i*.3
        z=.15+.35*(1-(y/1.95)**2)
        box('deck_plank',(0,y,z),(1.6,.28,.13),'wood')
    for x in (-.72,.72):
        for y in (-1.8,-.9,0,.9,1.8):
            z=.15+.35*(1-(y/1.95)**2)
            box('rail_post',(x,y,z+.38),(.1,.1,.8),'trim')
        for i in range(4):
            y=-1.8+i*.9
            beam('handrail',(x,y,.95+.35*(1-(y/1.95)**2)),
                (x,y+.9,.95+.35*(1-((y+.9)/1.95)**2)),.065,'wood')
    # Footings establish the ground anchor.
    for y in (-1.8,1.8):
        box('footing',(0,y,.08),(1.7,.35,.16),'stone')


def well():
    for i in range(12):
        a=i*math.tau/12
        obj=box('well_block',(.65*math.cos(a),.65*math.sin(a),.4),(.36,.27,.8),'stone')
        obj.rotation_euler.z=a+math.pi/2
    cone('well_water',(0,0,.15),.5,.5,.02,'water',16)
    for x in (-.8,.8):
        box('post',(x,0,1.05),(.13,.13,2.1),'wood')
    roof(2.05,2.1,1.6,.55)
    beam('spindle',(-.9,0,1.6),(.9,0,1.6),.07,'wood')
    beam('rope',(0,0,.5),(0,0,1.6),.02,'hay')
    cone('bucket',(0,0,.58),.16,.22,.3,'wood')


def garden_plot():
    box('earth',(0,0,.10),(2,1.5,.2),'soil')
    for x in (-1,1):
        box('border',(x,0,.15),(.12,1.65,.3),'wood')
    for y in (-.8,.8):
        box('border',(0,y,.15),(2,.12,.3),'wood')
    for x in (-.65,0,.65):
        for y in (-.45,0,.45):
            cone('carrot',(x,y,.25),.045,.085,.16,'fire')
            for dx in (-.1,.1):
                ball('sprout',(x+dx,y,.36),(.16,.08,.13),'leaf')


def campfire():
    for i in range(10):
        a=i*math.tau/10
        ball('hearth_stone',(.55*math.cos(a),.55*math.sin(a),.13),(.18,.16,.13),'stone')
    for y in (-.19,.19):
        beam('log',(-.4,y,.15),(.4,-y,.15),.09,'wood')
    flames=[cone('flame',(0,0,.52),.3,.015,.8,'fire',7)]
    flames.append(cone('flame_core',(0,-.06,.4),.18,0,.52,'light',7))
    for x in (-.18,.18):
        flames.append(cone('flame_tip',(x,.03,.39),.13,0,.48,'fire',5))
    group('fire',(0,0,.12),flames)


def mailbox():
    box('post',(0,0,.53),(.12,.12,1.06),'wood')
    box('mailbox',(0,0,1.2),(.45,.65,.35),'accent')
    box('door',(0,-.335,1.2),(.38,.035,.28),'wall')
    box('slot',(0,-.36,1.25),(.25,.02,.035),'metal')
    box('flag_stem',(.25,.1,1.45),(.035,.045,.4),'roof')
    box('flag',(.25,-.01,1.63),(.035,.26,.13),'roof')


def signpost():
    beam('post',(0,0,0),(0,0,1.95),.065,'wood')
    for z,side,material in [(1.7,1,'accent'),(1.25,-1,'roof')]:
        verts=[(side*x,-.08,z+dz) for x,dz in [(-.5,-.14),(.4,-.14),(.65,0),(.4,.14),(-.5,.14)]]
        mesh('arrow',verts,[(0,1,2,3,4)],material)
        for x in (-.25,-.05,.15):
            box('paint_mark',(x,-.09,z),(.11,.018,.035),'wall')


def alternate_house(level):
    house(level)
    # Same exact extents as the originals; swap surface colors and add inset timber.
    bpy.data.objects['walls'].data.materials[0]=mat('accent')
    bpy.data.objects['door'].data.materials[0]=mat('roof')
    for x in (-1.34,1.34):
        box('facade_timber',(x,-1.27,.24+(1.65+(level-1)*.65)/2),
            (.09,.065,1.65+(level-1)*.65),'trim')
    for x in (-.96,.96):
        for dx in (-.34,.34):
            box('shutter',(x+dx,-1.3,1.05),(.10,.06,.64),'wall')
    box('lintel',(0,-1.32,1.48),(.79,.06,.12),'wall')


def house_backyard():
    # Standalone 3 x 2.4 m attachment. Front (-Y) is open toward the house.
    for x in (-1.45,1.45):
        for y in (-1.1,0,1.1):
            box('fence_post',(x,y,.4),(.1,.1,.8),'wood')
        for z in (.25,.6):
            box('side_rail',(x,0,z),(.08,2.3,.1),'wall')
    for z in (.25,.6):
        box('back_rail',(0,1.1,z),(2.9,.08,.1),'wall')
    box('doghouse',(0,.3,.38),(1.0,.9,.76),'wall')
    # Actual dark inset appearance, without fragile booleans.
    box('dog_door',(0,-.16,.25),(.43,.025,.5),'metal')
    before=set(bpy.data.objects)
    roof(.76,1.15,1.05,.4)
    for o in set(bpy.data.objects)-before:
        o.location.y+=.3
    cone('dog_bowl',(.8,-.35,.07),.14,.18,.14,'accent')


def rock(kind):
    ball('rock',(0,0,.35 if kind=='a' else .22),
         (.65,.48,.35) if kind=='a' else (.85,.34,.22),'stone')
    if kind=='b':
        ball('moss',(-.25,.04,.37),(.28,.24,.07),'leaf')


def bush():
    for x,y,z in [(-.32,0,.28),(.28,.08,.32),(0,-.1,.43)]:
        ball('foliage',(x,y,z),(.42,.38,.38),'leaf')


def flowers():
    for x,y,h in [(-.22,0,.35),(.13,.12,.48),(.27,-.18,.27),(0,-.2,.38)]:
        beam('stem',(x,y,0),(x,y,h),.012,'leaf')
        ball('flower_center',(x,y,h),(.06,.06,.045),'hay')
        for i in range(5):
            a=i*math.tau/5
            ball('petal',(x+.08*math.cos(a),y+.08*math.sin(a),h),(.075,.06,.035),'blossom')


def tree_c():
    cone('trunk',(0,0,.75),.18,.10,1.5,'wood')
    for x,y,z,s in [(-.5,0,1.8,.65),(.5,.1,1.95,.7),(0,0,2.4,.8)]:
        beam('branch',(0,0,1),(x,y,z),.07,'wood')
        ball('blossoms',(x,y,z),(s,s*.9,s*.75),'blossom')
    for x,y in [(-.4,-.4),(.4,-.2),(.2,.4)]:
        ball('fallen_petals',(x,y,.02),(.12,.1,.02),'blossom')


def mushrooms():
    for x,y,h,r in [(-.22,0,.35,.2),(.2,.1,.5,.27),(.15,-.25,.22,.14)]:
        cone('stalk',(x,y,h/2),r*.25,r*.2,h,'wall')
        cone('cap',(x,y,h),r,r*.15,r*.6,'roof')
        for dx,dy in [(0,-.08),(.08,.04),(-.06,.03)]:
            ball('cap_spot',(x+dx*.6,y+dy*.6,h+r*.23),(.026,.026,.01),'wall')


def hat_festival():
    cone('bucket',(0,0,.17),.345,.28,.34,'accent',16)
    cone('brim',(0,0,.035),.45,.34,.07,'accent',16)
    cone('ribbon',(0,0,.11),.348,.336,.08,'blossom',16)
    disc('badge',(0,-.342,.19),.065,.025,'light')


def headphones():
    # Bottom anchor maps to Head+(0,.20,0), centered around the actual head.
    for side in (-1,1):
        box('ear_cushion',(side*.344,0,.16),(.09,.24,.29),'metal')
        box('ear_shell',(side*.405,0,.16),(.055,.25,.3),'accent')
    for i in range(10):
        a=i*math.pi/10
        b=(i+1)*math.pi/10
        beam('headband',(.39*math.cos(a),0,.23+.36*math.sin(a)),
            (.39*math.cos(b),0,.23+.36*math.sin(b)),.038,'metal')


def glasses():
    # Plane is just in front of eyes; anchor is bottom center, +Z is forward.
    for x in (-.135,.135):
        ring('round_frame',(x,-.01,.11),.10,.014,'metal',16,'Y')
        beam('temple',(x*1.77,0,.12),(x*1.77,.21,.12),.012,'metal')
    beam('nose_bridge',(-.032,-.01,.12),(.032,-.01,.12),.014,'metal')


def jacket():
    # Open-front shell follows the avatar's octagonal cone with clearance.
    verts=[]
    for z,r in [(0,.254),(.485,.315)]:
        verts.extend([(r*math.cos(i*math.tau/8),r*math.sin(i*math.tau/8),z) for i in range(8)])
    faces=[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8) if i not in (5,6)]
    obj=mesh('jacket_shell',verts,faces,'jacket')
    obj.data.materials[0].surface_render_method='DITHERED'
    obj.data.materials[0].use_backface_culling=False
    for x in (-.15,.15):
        box('jacket_lapel',(x,-.22,.37),(.09,.04,.20),'jacket')
        box('pocket',(x,-.22,.19),(.10,.035,.09),'jacket')
        ball('button',(x,-.247,.22),(.014,.009,.014),'light')


def scarf():
    ring('neck_wrap',(0,0,.22),.14,.055,'roof',12)
    box('scarf_tail',(.12,-.2,.11),(.12,.055,.22),'roof')
    for x in (.08,.12,.16):
        box('fringe',(x,-.2,.015),(.022,.055,.03),'hay')


def dog_b():
    # Corgi: low body, cream chest, short legs and large upright ears.
    for x in (-.19,.19):
        for y in (-.28,.28):
            box('short_paw',(x,y,.1),(.15,.17,.2),'wall')
    ball('body',(0,0,.35),(.33,.55,.25),'fur')
    ball('chest',(0,-.31,.35),(.28,.19,.24),'wall')
    ball('head',(0,-.42,.62),(.3,.27,.27),'fur')
    for x in (-.21,.21):
        cone('upright_ear',(x,-.37,.89),.13,.015,.34,'fur',4)
        cone('inner_ear',(x,-.40,.9),.075,0,.23,'blossom',4)
        ball('eye',(x*.66,-.655,.67),(.03,.025,.035),'metal')
    ball('muzzle',(0,-.64,.54),(.18,.16,.12),'wall')
    ball('nose',(0,-.78,.58),(.055,.03,.04),'metal')
    box('collar',(0,-.27,.44),(.49,.07,.075),'accent')
    ball('tail',(0,.52,.42),(.12,.18,.12),'wall')


def bird():
    ball('body',(0,0,.15),(.12,.21,.15),'wall')
    ball('head',(0,-.14,.29),(.11,.12,.11),'accent')
    mesh('beak',[(-.045,-.23,.27),(.045,-.23,.27),(0,-.35,.25),(0,-.23,.32)],
         [(0,2,1),(0,3,2),(1,2,3),(0,1,3)],'hay')
    for x in (-.065,.065):
        ball('eye',(x,-.23,.31),(.018,.016,.018),'metal')
    for side,label in [(-1,'l'),(1,'r')]:
        obj=mesh('wing_mesh',[(side*.08,0,.19),(side*.43,.08,.16),(side*.2,.2,.14)],
                 [(0,1,2)],'accent')
        group('wing_'+label,(side*.08,0,.19),[obj])
    mesh('tail',[(-.07,.15,.12),(.07,.15,.12),(.10,.34,.18),(-.10,.34,.18)],
         [(0,1,2,3)],'accent')


def butterfly():
    ball('body',(0,0,.03),(.025,.13,.03),'metal')
    for side,label in [(-1,'l'),(1,'r')]:
        parts=[]
        for y,s in [(-.06,.16),(.1,.11)]:
            parts.append(ball('wing_panel',(side*.11,y,.04),(s,.12,.025),'blossom' if y<0 else 'accent'))
            parts.append(ball('wing_spot',(side*.16,y,.066),(.035,.04,.005),'light'))
        group('wing_'+label,(0,0,.04),parts)
        beam('antenna',(side*.015,-.1,.04),(side*.065,-.20,.10),.006,'metal')


BUILDERS = {
    'stage_lights':stage_lights,'food_truck':food_truck,'ferris_wheel':ferris_wheel,
    'tent_merch':tent_merch,'speaker_stack':speaker_stack,'string_lights':string_lights,
    'banner_flag':banner_flag,'picnic_table':picnic_table,'hay_bale':hay_bale,
    'pet_shelter':pet_shelter,'fountain':fountain,'lake_patch':lake_patch,'bridge':bridge,
    'well':well,'garden_plot':garden_plot,'campfire':campfire,'mailbox':mailbox,'signpost':signpost,
    **{f'house_lv{i}_b':lambda i=i:alternate_house(i) for i in range(1,4)},
    'house_backyard':house_backyard,'rock_a':lambda:rock('a'),'rock_b':lambda:rock('b'),
    'bush_a':bush,'flowers_a':flowers,'tree_c':tree_c,'mushroom_cluster':mushrooms,
    'hat_festival':hat_festival,'hat_headphones':headphones,'glasses_round':glasses,
    'jacket_denim':jacket,'scarf':scarf,'pet_dog_b':dog_b,'bird':bird,'butterfly':butterfly,
}


if __name__ == '__main__':
    for name,builder in BUILDERS.items():
        reset()
        builder()
        # Rest every new standalone asset at its base; preserve custom animation pivots.
        bpy.context.view_layer.update()
        lo=min((o.matrix_world@Vector(v)).z for o in bpy.context.scene.objects
               if o.type=='MESH' for v in o.bound_box)
        for obj in bpy.context.scene.objects:
            if obj.parent is None:
                obj.location.z-=lo
        export(name)
