"""Original CC0 ASSET-013 geometry. Run with Blender --background --python.

Exact preset bind skeleton; one batched mesh with three material draws per item.
Outputs under artifacts on the remote runner; install.py copies reviewed assets.
"""
import sys
from pathlib import Path
import math
import os

os.environ['OMP_NUM_THREADS']='2'

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'assets/blender'))
import common as c
from common import bpy, Vector, box, beam, mesh, mat, reset, ball

OUT = ROOT / 'tools/asset013/artifacts'
c.OUT = OUT / 'models'
c.PALETTE.update(primary='#557CA7', secondary='#F1D9AD', accent='#3B9790')
BOTTOMS = ['jeans', 'chinos', 'joggers', 'shorts', 'skirt', 'overalls']
SHOES = ['sneakers', 'boots', 'sandals', 'loafers', 'high_tops', 'slippers']
GLASSES = ['round_wire', 'aviator', 'cat_eye', 'sunglasses', 'half_rim', 'heart', 'oversized']

def skeleton():
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'apps/web/public/models/villager_base.glb'))
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    for obj in list(bpy.context.scene.objects):
        if obj != rig: bpy.data.objects.remove(obj, do_unlink=True)
    rig.animation_data_clear()
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for bone in rig.pose.bones: bone.matrix_basis.identity()
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    return rig

def weight(obj, rig, bone):
    obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    obj.modifiers.new('Skeleton', 'ARMATURE').object = rig
    obj.parent = rig
    return obj

def bottoms(style):
    rig = skeleton()
    def add(obj, bone='Root'): return weight(obj, rig, bone)
    add(box('waist', (0,0,.59), (.416,.306,.19), 'primary'))
    add(box('belt', (0,-.158,.645), (.40,.018,.035), 'secondary'))
    add(box('buckle', (0,-.174,.645), (.052,.022,.038), 'accent'))
    for side, x in [('L',.14),('R',-.14)]:
        bone='Leg_'+side
        short = style in ('shorts','skirt')
        # Hidden base pants are replaced by a neutral skin calf for short styles.
        if short: add(box('calf', (x,0,.235), (.18,.22,.21), 'skin'), bone)
        width = .21 if style != 'joggers' else .23
        add(box('leg', (x,0,.455 if short else .345), (width,.252,.24 if short else .45), 'primary'), bone)
        add(box('pocket', (x,-.134,.51), (.12,.018,.085), 'secondary'), bone)
        add(box('stitch', (x+.06,-.145,.51), (.008,.012,.07), 'accent'), bone)
        if style == 'joggers': add(box('cuff',(x,0,.14),(.205,.24,.06),'secondary'),bone)
        if style == 'jeans': add(box('hem',(x,-.131,.145),(.21,.015,.035),'secondary'),bone)
        if style == 'skirt':
            # Split pleated panels follow each thigh; no rigid bridge between legs.
            add(box('pleat',(x,-.157,.44),(.274,.04,.30),'primary'),bone)
            add(box('pleat_back',(x,.15,.44),(.274,.04,.30),'primary'),bone)
            add(box('hem',(x,-.18,.305),(.274,.018,.03),'secondary'),bone)
    if style == 'overalls':
        add(box('bib',(0,-.283,.84),(.33,.038,.32),'primary'),'Spine')
        for x in [-.13,.13]:
            add(box('strap',(x,-.285,1.055),(.045,.035,.22),'secondary'),'Spine')
            add(ball('button',(x,-.31,.96),(.022,.016,.022),'accent'),'Spine')
    return rig

def shoes(style):
    rig=skeleton()
    for side,x in [('L',.14),('R',-.14)]:
        def add(obj): return weight(obj,rig,'Leg_'+side)
        add(box('sole',(x,-.065,.025),(.254,.40,.05),'secondary'))
        if style=='sandals':
            add(box('foot',(x,-.055,.085),(.205,.33,.085),'skin'))
            for y in [-.18,.045]: add(box('strap',(x,y,.133),(.236,.065,.035),'primary'))
        else:
            height=.16 if style in ('loafers','slippers') else .185
            add(box('upper',(x,-.065,.045+height/2),(.242,.38,height),'primary'))
        if style in ('boots','high_tops'):
            add(box('ankle',(x,.025,.215),(.248,.265,.25 if style=='boots' else .19),'primary'))
        if style in ('sneakers','high_tops','boots'):
            for y in [-.16,-.10,-.04]: add(box('lace',(x,y,.239),(.14,.021,.018),'accent'))
        elif style=='loafers': add(box('penny',(x,-.09,.216),(.18,.055,.025),'accent'))
        elif style=='slippers': add(ball('pom',(x,-.17,.24),(.065,.06,.06),'accent'))
        else: add(box('buckle',(x+.1,.045,.155),(.035,.045,.022),'accent'))
    return rig

def glasses(style):
    n=32
    for side in [-1,1]:
        points=[]
        for i in range(n):
            t=i*math.tau/n
            x,z=math.cos(t)*.13, math.sin(t)*.11
            if style=='heart': x,z=.009*16*math.sin(t)**3,.008*(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))
            if style in ('sunglasses','oversized'): x,z=math.copysign(abs(math.cos(t))**.4,t and math.cos(t) or 1)*.14,math.copysign(abs(math.sin(t))**.4,math.sin(t))*.11
            if style=='aviator': z-=.035*(1-math.sin(t)); x*=1+.15*math.sin(t)
            if style=='cat_eye': z+=max(0,side*x)*.6
            if style=='oversized': x*=1.15; z*=1.2
            points.append((side*.17+x,0,z))
        for i in range(n):
            material='secondary' if style=='half_rim' and i>=n//2 else 'primary'
            beam('rim',points[i],points[(i+1)%n],.012 if style=='round_wire' else .017,material)
        if style in ('sunglasses','aviator','oversized'):
            mesh('lens',[(x,.009,z) for x,y,z in points],[tuple(range(n))],'secondary')
        beam('arm',(side*.30,0,.035),(side*.30,.24,.01),.012,'secondary')
        ball('hinge',(side*.30,-.015,.035),(.023,.02,.023),'accent')
    beam('bridge',(-.045,0,.015),(.045,0,.015),.012,'accent')

def batch():
    bpy.ops.object.select_all(action='DESELECT')
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for obj in meshes: obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.join()
    bpy.context.object.name='wearable'

def thumbnail(name):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'; scene.cycles.samples=12
    scene.render.threads_mode='FIXED'; scene.render.threads=2
    scene.render.resolution_x=scene.render.resolution_y=512
    scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
    objs=[o for o in scene.objects if o.type=='MESH']
    pts=[o.matrix_world @ Vector(p) for o in objs for p in o.bound_box]
    low=Vector(tuple(min(p[i] for p in pts) for i in range(3)))
    high=Vector(tuple(max(p[i] for p in pts) for i in range(3)))
    center=(low+high)/2; size=max(high-low)
    bpy.ops.object.camera_add(location=center+Vector((1,-3,1.3))*size)
    camera=bpy.context.object; camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; camera.data.ortho_scale=size*1.45; scene.camera=camera
    scene.world.color=(.6,.6,.6)
    for pos,energy in [((2,-3,4),180),((-3,-1,2),110)]:
        bpy.ops.object.light_add(type='AREA',location=center+Vector(pos)*size)
        light=bpy.context.object; light.data.energy=energy*size*size; light.data.shape='DISK'; light.data.size=size*3
        light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    (OUT/'thumbs').mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(OUT/'thumbs'/f'{name}.png')
    bpy.ops.render.render(write_still=True)

for prefix,styles,build in [('bottoms',BOTTOMS,bottoms),('footwear',SHOES,shoes),('eyewear',GLASSES,glasses)]:
    for style in styles:
        reset(); build(style); batch()
        name=f'{prefix}_{style}'; c.export(name); thumbnail(name)
