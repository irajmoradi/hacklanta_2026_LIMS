"""Original, texture-free Mayor event props; run with Blender in background."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *
sys.path.insert(0, str(ROOT/'assets'))
from event_spec import NAMES

COLORS = ['blossom', 'accent', 'fire', 'light', 'leaf', 'glass']


def orb(name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=loc)
    bpy.context.object.scale = scale
    return finish(bpy.context.object, name, material)


def disc(name, loc, radius, depth, material):
    obj = cone(name, loc, radius, radius, depth, material, 16)
    obj.rotation_euler.x = math.pi/2
    return obj


def ribbon(name, points, material, radius=.025):
    for i, (a, b) in enumerate(zip(points, points[1:])):
        beam(name+str(i), a, b, radius, material)


def arc(name, radius, width, center, material, start=0, end=math.pi):
    # Flat ribbon in the X/Z plane, deliberately double-sided.
    verts=[]
    for i in range(25):
        a=start+(end-start)*i/24
        for r in (radius, radius+width):
            verts.append((center[0]+r*math.cos(a), center[1], center[2]+r*math.sin(a)))
    mesh(name, verts, [(2*i,2*i+1,2*i+3,2*i+2) for i in range(24)], material)


def stand(width=1.5, height=1.8):
    for x in (-width/2,width/2):
        box('foot',(x,0,.06),(.55,.8,.12),'metal')
        beam('post',(x,0,.12),(x,0,height),.055,'metal')


def gift(loc, size, color):
    x,y,z=loc
    box('gift',loc,(size,size,size),color)
    box('ribbon_x',(x,y,z),(size+.015,.09,size+.02),'light')
    box('ribbon_y',(x,y,z),(.09,size+.015,size+.025),'light')
    for dx in (-.1,.1):
        orb('bow',(x+dx,y,z+size/2+.05),(.13,.055,.07),'light')


def table():
    box('tabletop',(0,0,.9),(2.4,1,.15),'wood')
    for x in (-1,1):
        for y in (-.35,.35):
            box('leg',(x,y,.42),(.12,.12,.84),'wood')


def cloud():
    for i,(x,z,s) in enumerate([(-.75,.45,.55),(0,.6,.8),(.8,.4,.5)]):
        orb('cloud_lobe'+str(i),(x,0,z),(s,.42,s*.65),'wall')


def build(name):
    if name=='neon_arch':
        stand(3,2)
        for x in (-1.5,1.5):
            beam('neon_upright',(x,-.02,0),(x,-.02,2),.065,'blossom')
        arc('neon_crown',1.5,.12,(0,0,2),'blossom')
        arc('inner_glow',1.32,.07,(0,-.01,2),'accent')
    elif name=='glow_sticks_pile':
        for i in range(12):
            a=i*2.399
            x,y=.45*math.cos(a),.3*math.sin(a)
            beam('glow_stick',(x,y,.06+i*.018),(x+.5*math.cos(a+.5),y+.5*math.sin(a+.5),.09+i*.018),.035,COLORS[i%6])
    elif name=='light_tower':
        box('base',(0,0,.12),(1,1,.24),'metal')
        for x in (-.28,.28):
            beam('truss',(x,0,.24),(x,0,2.8),.045,'metal')
        for i in range(6):
            ribbon('brace',[(-.28,0,.3+i*.4),(.28,0,.7+i*.4)],'stone')
        for z in (1,1.8,2.6):
            box('lamp',(0,0,z),(.65,.35,.35),'metal')
            disc('lens',(0,-.19,z),.13,.04,'light')
    elif name=='confetti_cannon':
        box('base',(0,0,.08),(.8,.8,.16),'metal')
        beam('barrel',(0,0,.2),(0,-.3,1.05),.2,'accent')
        disc('mouth',(0,-.32,1.05),.17,.035,'metal')
        for i in range(18):
            a=i*2.4
            obj=box('confetti',(.65*math.cos(a),-.4+.3*math.sin(a),1.2+(i%6)*.16),(.09,.035,.14),COLORS[i%6])
            obj.rotation_euler.y=a
    elif name=='dj_booth':
        box('console',(0,0,.65),(2.2,.9,1.3),'metal')
        box('front_panel',(0,-.46,.65),(1.95,.03,.75),'accent')
        for x in (-.6,.6):
            cone('turntable',(x,0,1.32),.3,.3,.04,'stone',16)
            cone('label',(x,0,1.35),.09,.09,.02,'blossom')
        for i in range(5):
            box('fader',(-.2+i*.1,0,1.34),(.035,.28,.04),'light')
    elif name=='pumpkin_lantern':
        orb('pumpkin',(0,0,.48),(.55,.42,.48),'fire')
        cone('stem',(0,0,1),.09,.055,.22,'leaf')
        for x in (-.19,.19):
            mesh('eye',[(x-.09,-.397,.62),(x+.09,-.397,.62),(x,-.43,.76)],[(0,1,2)],'metal')
        mesh('grin',[(-.28,-.424,.43),(0,-.46,.32),(.28,-.424,.43),(.18,-.44,.24),(-.18,-.44,.24)],[(0,1,2,3,4)],'metal')
    elif name=='ghost_sheet':
        verts=[]
        for z,r in ((0,.65),(.65,.52),(1.1,.46),(1.38,.26),(1.48,.01)):
            for i in range(12):
                a=i*math.tau/12
                verts.append((r*math.cos(a),r*.65*math.sin(a),z+(.09*(i%2) if z==0 else 0)))
        mesh('sheet',verts,[(j*12+i,j*12+(i+1)%12,(j+1)*12+(i+1)%12,(j+1)*12+i) for j in range(4) for i in range(12)],'wall')
        for x in (-.16,.16): orb('eye',(x,-.3,1.07),(.065,.035,.11),'metal')
    elif name=='spider_web_corner':
        for i in range(6):
            a=i*math.pi/10
            beam('spoke',(0,0,0),(1.6*math.cos(a),0,1.6*math.sin(a)),.012,'wall')
        for r in (.4,.8,1.2,1.6): arc('web',r,.018,(0,0,0),'wall',0,math.pi/2)
        orb('spider',(.8,-.025,.65),(.1,.06,.13),'metal')
        for i in range(4):
            for sign in (-1,1):
                ribbon('leg',[(.8,-.025,.65),(.8+sign*.17,-.025,.51+i*.08),(.8+sign*.24,-.025,.47+i*.08)],'metal',.012)
    elif name=='bat_garland':
        ribbon('cord',[(-2,0,.8),(0,0,.55),(2,0,.8)],'metal',.018)
        for x in (-1.5,-.75,0,.75,1.5):
            z=.55+abs(x)*.125
            mesh('bat',[(x,0,z),(x-.32,0,z+.12),(x-.22,0,z-.08),(x-.14,0,z-.04),(x,0,z-.22),(x+.14,0,z-.04),(x+.22,0,z-.08),(x+.32,0,z+.12)],[(0,1,2,3,4,5,6,7)],'metal')
    elif name=='tombstone_cartoon':
        box('base',(0,0,.08),(1.1,.65,.16),'stone')
        box('stone',(0,0,.65),(.8,.25,1.1),'stone')
        disc('round_top',(0,0,1.2),.4,.25,'stone')
        box('cross_vertical',(0,-.14,.85),(.09,.035,.45),'wall')
        box('cross_horizontal',(0,-.14,.95),(.34,.035,.09),'wall')
        ball('flower',(.32,-.23,.23),(.13,.13,.13),'blossom')
    elif name=='snowman':
        for z,r in ((.48,.48),(1.1,.36),(1.61,.27)): orb('snow',(0,0,z),(r,r,r),'wall')
        cone('hat',(0,0,1.99),.23,.23,.3,'metal')
        cone('brim',(0,0,1.85),.34,.34,.06,'metal')
        for x in (-.09,.09): orb('eye',(x,-.25,1.65),(.035,.03,.035),'metal')
        beam('carrot',(0,-.25,1.56),(0,-.55,1.56),.055,'fire')
        for z in (.98,1.16): orb('button',(0,-.35,z),(.04,.035,.04),'metal')
        for sign in (-1,1): beam('arm',(sign*.27,0,1.14),(sign*.75,0,1.4),.035,'wood')
        cone('scarf',(0,0,1.37),.29,.28,.12,'roof')
    elif name=='snow_pile':
        for x,y,r in ((0,0,.8),(-.7,.1,.5),(.6,-.2,.6)):
            orb('snow',(x,y,.12),(r,r*.7,.28),'wall')
    elif name=='string_lights_icicle':
        beam('cable',(-2,0,1),(2,0,1),.02,'metal')
        for i in range(17):
            h=.3+(i%3)*.18
            cone('icicle',(-2+i*.25,0,1-h/2),.005,.055,h,'glass')
    elif name=='gift_box_stack':
        gift((-.4,0,.4),.8,'roof'); gift((.45,0,.3),.6,'accent'); gift((-.4,0,1.04),.48,'blossom')
    elif name=='pine_decorated':
        cone('trunk',(0,0,.3),.14,.14,.6,'wood')
        for z,r in ((.95,.9),(1.5,.7),(2,.5)): cone('pine',(0,0,z),r,0,1.2,'leaf')
        for i in range(18):
            a=i*2.4; z=.6+i*.095; r=.88-(z-.6)*.34
            ball('ornament',(r*math.cos(a),r*math.sin(a),z),(.085,.085,.085),COLORS[i%6])
        ball('star',(0,0,2.65),(.18,.12,.23),'light')
    elif name=='party_balloons':
        cone('weight',(0,0,.06),.2,.17,.12,'metal')
        for i in range(5):
            x=(i-2)*.3; y=.17*(i%2); z=1.65+(i%3)*.25
            beam('string',(0,0,.12),(x,y,z),.008,'wall')
            orb('balloon',(x,y,z),(.27,.25,.36),COLORS[i])
    elif name=='cake_giant':
        cone('plate',(0,0,.06),1.1,1.1,.12,'accent',24)
        for z,r,h in ((.42,.95,.6),(.95,.65,.45)):
            cone('cake',(0,0,z),r,r,h,'blossom',24)
            cone('icing',(0,0,z+h/2),r+.02,r+.02,.08,'wall',24)
        for i in range(7):
            a=i*math.tau/7; x,y=.45*math.cos(a),.45*math.sin(a)
            cone('candle',(x,y,1.36),.035,.035,.3,COLORS[i%6])
            ball('flame',(x,y,1.56),(.045,.045,.09),'fire')
    elif name=='gift_table':
        table()
        for x,c in ((-.75,'blossom'),(0,'accent'),(.75,'roof')): gift((x,0,1.2),.45,c)
    elif name=='bunting_rainbow':
        stand(3.6,2.2)
        beam('cord',(-1.8,0,2.2),(1.8,0,2.2),.02,'metal')
        for i in range(9):
            x=-1.6+i*.4
            mesh('flag',[(x-.17,0,2.18),(x+.17,0,2.18),(x,0,1.7)],[(0,1,2)],COLORS[i%6])
    elif name=='party_hat_villager':
        cone('hat',(0,0,.3),.32,0,.6,'blossom',12)
        cone('band',(0,0,.04),.325,.29,.08,'accent',12)
        orb('pom',(0,0,.63),(.09,.09,.09),'light')
        for i in range(6):
            a=i*math.tau/6
            ball('dot',(.19*math.cos(a),.19*math.sin(a),.22),(.04,.04,.04),'light')
    elif name=='projector_screen':
        stand(3.6,3)
        box('frame',(0,0,2),(4,.16,2.35),'metal')
        box('screen',(0,-.09,2),(3.8,.025,2.15),'wall')
    elif name=='popcorn_stand':
        box('cart',(0,0,.7),(1.3,.8,1.1),'roof')
        for x in (-.5,.5): disc('wheel',(x,0,.22),.22,.9,'metal')
        for x in (-.6,.6): beam('post',(x,0,1.2),(x,0,2.2),.04,'wood')
        box('canopy',(0,0,2.22),(1.6,1,.16),'wall')
        for x in (-.6,-.2,.2,.6): box('stripe',(x,-.51,2.22),(.2,.025,.16),'roof')
        for i in range(21):
            a=i*2.4; r=.36*(i%4)/3
            ball('popcorn',(r*math.cos(a),r*.7*math.sin(a),1.3+.04*(i%3)),(.1,.1,.1),'light')
    elif name=='bean_bags':
        for x,y,c in ((-.65,0,'accent'),(.65,.15,'blossom')):
            orb('seat',(x,y,.28),(.6,.65,.28),c)
            orb('back',(x,y+.32,.54),(.52,.3,.5),c)
    elif name=='film_reel_sign':
        stand(.6,1.3)
        disc('reel',(0,0,1.65),.65,.16,'stone')
        disc('hub',(0,-.1,1.65),.1,.04,'metal')
        for i in range(5):
            a=i*math.tau/5
            disc('reel_hole',(.37*math.cos(a),-.095,1.65+.37*math.sin(a)),.15,.035,'metal')
    elif name=='arcade_cabinet_outdoor':
        box('base',(0,0,.12),(1,.85,.24),'metal')
        box('cabinet',(0,.05,.9),(.9,.7,1.6),'accent')
        box('screen_frame',(0,-.33,1.35),(.78,.12,.65),'metal')
        box('screen',(0,-.4,1.35),(.62,.025,.48),'glass')
        for i in range(5): box('pixel',((i-2)*.09,-.42,1.35+(i%2)*.09),(.07,.025,.07),'light')
        box('controls',(0,-.42,.88),(.9,.45,.13),'metal')
        beam('joystick',(-.22,-.5,.95),(-.22,-.5,1.09),.035,'metal')
        ball('knob',(-.22,-.5,1.1),(.06,.06,.06),'roof')
        for x in (.12,.29): cone('button',(x,-.5,.97),.055,.055,.035,'blossom')
        box('awning',(0,-.06,1.87),(1.15,1.1,.16),'roof')
    elif name=='giant_controller_statue':
        box('plinth',(0,0,.15),(2.5,.8,.3),'stone')
        box('controller',(0,0,.95),(1.9,.45,.65),'wall')
        for x in (-.8,.8): orb('grip',(x,0,.75),(.4,.25,.55),'wall')
        for size in ((.45,.055,.14),(.14,.055,.45)): box('dpad',(-.55,-.26,1),size,'metal')
        for i in range(4):
            a=i*math.pi/2
            disc('button',(.55+.17*math.cos(a),-.26,1+.17*math.sin(a)),.065,.055,COLORS[i])
    elif name=='pixel_trophy':
        box('base',(0,0,.12),(.9,.7,.24),'wood')
        box('stem',(0,0,.5),(.2,.2,.6),'light')
        for z,w in ((.7,.5),(.9,.8),(1.1,1)):
            box('cup',(0,0,z),(w,.45,.2),'light')
        for sign in (-1,1):
            ribbon('handle',[(sign*.45,0,.75),(sign*.72,0,.75),(sign*.72,0,1.16),(sign*.5,0,1.16)],'light',.065)
    elif name=='minecraft_style_block_stack':
        for x,y,z,c in ((-.5,0,.4,'leaf'),(.35,0,.4,'soil'),(0,.8,.4,'stone'),(0,.4,1.2,'accent')):
            box('generic_cube',(x,y,z),(.8,.8,.8),c)
            box('top_inset',(x,y,z+.405),(.6,.6,.01),'wall')
    elif name in ('cloud_rain','cloud_puffy'):
        cloud()
        if name=='cloud_rain':
            for obj in bpy.context.scene.objects: obj.location.z+=1.5
            pivot=bpy.data.objects.new('drops',None); bpy.context.collection.objects.link(pivot)
            for i in range(15):
                x=(i%5-2)*.4; y=(i//5-1)*.22; z=.15+(i%3)*.3
                obj=cone('raindrop',(x,y,z),.045,0,.2,'water',6); obj.parent=pivot
    elif name=='rainbow_arc':
        for i,c in enumerate(('roof','fire','light','leaf','accent','blossom')): arc('rainbow_band',1.5+i*.13,.13,(0,0,0),c)
    elif name=='fog_bank_card':
        mesh('fog', [(-2,0,0),(2,0,0),(2,0,.35),(1.6,0,.6),(1.1,0,.58),(.8,0,.85),(.2,0,.9),(-.2,0,.65),(-.8,0,.78),(-1.4,0,.65),(-2,0,.32)], [tuple(range(11))], 'glass')
        transparent('glass',.28)
    elif name=='sun_rays_card':
        disc('sun',(0,0,1),.4,.015,'light')
        for i in range(12):
            a=i*math.tau/12
            mesh('ray',[(.5*math.cos(a-.1),0,1+.5*math.sin(a-.1)),(.5*math.cos(a+.1),0,1+.5*math.sin(a+.1)),(math.cos(a),0,1+math.sin(a))],[(0,1,2)],'light')
        transparent('light',.55)
    else:
        raise ValueError(name)


def transparent(material, alpha):
    m=mat(material)
    m.diffuse_color=(*m.diffuse_color[:3],alpha)
    m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=alpha
    m.surface_render_method='DITHERED'


def main():
    for name in NAMES:
        reset()
        build(name)
        # Normalize ground/bottom anchors, including hanging strands and FX cards.
        bpy.context.view_layer.update()
        low=min((o.matrix_world@Vector(v)).z for o in bpy.context.scene.objects if o.type=='MESH' for v in o.bound_box)
        for obj in bpy.context.scene.objects:
            if obj.parent is None: obj.location.z-=low
        export(name)


if __name__=='__main__': main()
