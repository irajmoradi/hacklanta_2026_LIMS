"""Deterministic shop art pass. Reuses authored anchors, rigs and material names.

Run after shop_preview_007.py --before. Does not touch FEAT-006 outfits or ASSET-006 houses.
"""
import sys, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *
import village_kit as village
import festival_kit as festival
import town_kit as town


def soft_ball(name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8 if name.startswith(('petal', 'flower_center')) else 12, ring_count=6 if name.startswith(('petal', 'flower_center')) else 8, radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    finish(obj, name, material)
    for p in obj.data.polygons: p.use_smooth = True
    return obj


def rounded(obj, width=None):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('Soft tailored edges', 'BEVEL')
    mod.width = width or min(obj.dimensions)*.16
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def stitch(a, b, material='wall', radius=.003):
    return beam('stitch', a, b, radius, material)


def detail(name):
    if name == 'hat_beanie':
        for i in range(24):
            a = i*math.tau/24
            stitch((.350*math.cos(a),.350*math.sin(a),.025),(.350*math.cos(a),.350*math.sin(a),.11),'roof',.004)
    elif name == 'hat_cap':
        # A rounded visor and a sewn crest replace the old square slab.
        bill = bpy.data.objects.get('bill')
        bpy.data.objects.remove(bill,do_unlink=True)
        soft_ball('bill',(0,-.28,.04),(.30,.36,.045),'accent')
        soft_ball('embroidered_crest',(0,-.303,.19),(.052,.015,.055),'accent')
        for x in (-.065,.065): stitch((x,-.297,.1),(x*.7,-.25,.28),'accent',.005)
    elif name == 'hat_cowboy':
        soft_ball('band_clasp',(0,-.285,.12),(.055,.018,.035),'roof')
        for i in range(16):
            a=i*math.tau/16
            stitch((.46*math.cos(a),.46*math.sin(a),.073),(.46*math.cos(a+.11),.46*math.sin(a+.11),.073),'wood')
    elif name == 'hat_crown':
        bpy.context.view_layer.update()
        for point in [o for o in bpy.context.scene.objects if o.name.startswith('point')]:
            tip=max((point.matrix_world@v.co).z for v in point.data.vertices)
            soft_ball('pearl',(point.location.x,point.location.y,tip+.012),(.032,.032,.032),'light')
    elif name == 'hat_festival':
        for i in range(16):
            a=i*math.tau/16
            stitch((.397*math.cos(a),.397*math.sin(a),.037),(.397*math.cos(a+.13),.397*math.sin(a+.13),.037),'light',.003)
    elif name == 'hat_headphones':
        for x in (-.435,.435):
            for z in (.13,.17,.21): rounded(box('earcup_groove',(x,-.03,z),(.007,.105,.008),'metal'))
    elif name == 'jacket_denim':
        for x in (-.15,.15):
            stitch((x-.038,-.244,.16),(x+.038,-.244,.16),'light')
            stitch((x-.038,-.244,.16),(x-.038,-.244,.215),'light')
    elif name == 'scarf':
        for z in (.055,.075): rounded(box('woven_stripe',(.12,-.232,z),(.115,.005,.008),'hay'))
        # Connect hanging end to the ring instead of leaving a floating strip.
        rounded(box('fold',(.105,-.16,.19),(.125,.11,.085),'roof'))
    elif name.startswith('pet_dog'):
        for obj in list(bpy.context.scene.objects):
            if obj.name.startswith('eye'):
                p=obj.location
                soft_ball('eye_glint',(p.x-.007,p.y-.024,p.z+.013),(.009,.006,.009),'wall')
        soft_ball('collar_tag',(0,-.308,.43 if name.endswith('_b') else .46),(.038,.012,.04),'accent')
    elif name == 'lantern':
        festival.ring('carrying_loop',(0,0,2.32),.12,.022,'metal',12,'Y')


def shade():
    # COLOR_0 is a neutral multiply, so all existing named runtime tints still work.
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH': continue
        zs = [v.co.z for v in obj.data.vertices]
        low, span = min(zs), max(zs)-min(zs)
        attr = obj.data.color_attributes.new(name='CozyAO',type='FLOAT_COLOR',domain='POINT')
        for v, c in zip(obj.data.vertices, attr.data):
            value = .76 + .24*(v.co.z-low)/max(span,.001)
            c.color = (value,value,value,1)


def export_shop(name):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')), export_format='GLB',
        use_selection=True, export_yup=True, export_animations=False, export_extras=True,
        export_vertex_color='NAME', export_vertex_color_name='CozyAO', export_all_vertex_colors=False)


def build(name):
    reset()
    # Warmer textile and biscuit tones pair with the houses; material identifiers stay fixed.
    PALETTE.update(roof='#BF796B',accent='#69A49A',fur='#C99D72',wood='#997557',metal='#43565B')
    village.ball=festival.ball=soft_ball
    if name == 'hat_cowboy': town.accessory(name)
    elif name.startswith('shirt_'):
        town.clothing('shirt_hoodie' if name == 'shirt_hoodie' else 'shirt_tee')
        if name == 'shirt_stripes':
            rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
            for z in (.72,.82,.92,1.02):
                r=.257+.06*(z-.63)/.5+.004
                obj=cone('woven_stripe',(0,0,z),r,r+.003,.028,'wall',8)
                obj.vertex_groups.new(name='Spine').add(list(range(len(obj.data.vertices))),1,'REPLACE')
                obj.modifiers.new('Skeleton','ARMATURE').object=rig
                obj.parent=rig
    elif name in village.BUILDERS: village.BUILDERS[name]()
    else: festival.BUILDERS[name]()
    # Bevel hard edges without changing the attachment origin or outer dimensions.
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH' and len(obj.data.vertices) <= 32 and not obj.name.startswith(('headband', 'stem')):
            rounded(obj)
    detail(name)
    # The festival source historically grounded all exports, including rigid wearables.
    if name in festival.BUILDERS:
        bpy.context.view_layer.update()
        lo=min((o.matrix_world@Vector(v)).z for o in bpy.context.scene.objects if o.type=='MESH' for v in o.bound_box)
        for obj in bpy.context.scene.objects:
            if obj.parent is None: obj.location.z-=lo
    shade()
    export_shop(name)


def voice(name):
    reset()
    # Display-only sculpted voice cards; no audio generation or catalog model contract.
    rounded(box('card',(0,.045,.55),(.82,.10,1.1),'wall'),.045)
    if name == 'voice_pirate':
        festival.ring('ship_wheel',(0,-.04,.64),.21,.025,'wood',16,'Y')
        for i in range(8):
            a=i*math.tau/8
            beam('wheel_spoke',(0,-.04,.64),(.28*math.cos(a),-.04,.64+.28*math.sin(a)),.018,'wood')
        soft_ball('hub',(0,-.065,.64),(.048,.025,.048),'light')
    elif name == 'voice_shakespearean':
        rounded(box('book',(0,-.07,.39),(.54,.12,.25),'roof'),.025)
        beam('quill_stem',(-.1,-.15,.5),(.18,-.15,.9),.014,'wood')
        obj=soft_ball('quill',(.1,-.14,.79),(.085,.028,.24),'light'); obj.rotation_euler.y=.5
    else:
        obj=cone('megaphone',(0,-.09,.65),.22,.10,.36,'accent',16)
        obj.rotation_euler.x=math.pi/2
        rounded(box('handle',(0,-.02,.39),(.1,.1,.25),'wood'))
        for x in (-.29,.29): beam('energy',(x,-.08,.6),(x*1.15,-.08,.8),.018,'light')
    for i,h in enumerate((.06,.12,.18,.1,.15)):
        rounded(box('waveform',((i-2)*.09,-.02,.16),(.035,.035,h),'accent'))
    shade(); export_shop(name)


if __name__ == '__main__':
    for name in ('hat_beanie','hat_cap','hat_crown','hat_cowboy','hat_festival','hat_headphones',
                 'glasses_round','jacket_denim','scarf','shirt_hoodie','shirt_stripes',
                 'pet_dog','pet_dog_b','house_backyard','flowers_a','lantern','fountain'):
        build(name)
    for name in ('voice_pirate','voice_shakespearean','voice_hype_coach'): voice(name)
