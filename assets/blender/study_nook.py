"""Original texture-free FEAT-009 geometry. Run with Blender --background --python."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *

reset()
PALETTE.update(wood='#A47B59', wall='#F1E6CD', leaf='#91A58A', chalk='#344B43')
# Helpers accept glTF X/Y/Z so seat anchors match studySeats.ts exactly.
def cube(name, p, s, material):
    return box(name, (p[0],-p[2],p[1]), (s[0],s[2],s[1]), material)
def orb(name,p,s,material):
    return ball(name,(p[0],-p[2],p[1]),(s[0],s[2],s[1]),material)
cube('rug_patch',(0,.025,0),(8.5,.05,4.4),'leaf')
for x in [-2.8,0,2.8]:
    prefix=f'table_{int((x+2.8)/2.8)}'
    cube(prefix,(x,1.65,0),(2.3,.16,1.2),'wood')
    for dx in [-.85,.85]:
        cube(prefix+'_leg',(x+dx,.81,0),(.16,1.62,.9),'wood')
    for z in [-1,1]:
        cube(prefix+'_bench',(x,.95,z),(2.3,.16,.46),'wood')
        for dx in [-.85,.85]: cube(prefix+'_bench_leg',(x+dx,.46,z),(.14,.92,.35),'wood')
    cube(prefix+'_book_cover',(x-.6,1.758,.08),(.7,.035,.48),'leaf')
    for dx in [-.175,.175]:
        page=cube(prefix+'_open_pages',(x-.6+dx,1.79,.08),(.33,.035,.44),'wall')
        page.rotation_euler.y=.1 if dx<0 else -.1
    cube(prefix+'_laptop_base',(x+.48,1.755,0),(.65,.035,.45),'metal')
    cube(prefix+'_laptop_screen',(x+.48,1.98,-.23),(.65,.45,.04),'metal')
    cube(prefix+'_screen_glow',(x+.48,1.98,-.204),(.57,.37,.008),'glass')
    cone(prefix+'_mug',(x,-.26,1.86),.1,.11,.23,'wall',12)
    cone(prefix+'_coffee',(x,-.26,1.98),.085,.085,.005,'wood',12)
    orb(prefix+'_mug_handle',(x+.13,1.86,.26),(.08,.07,.035),'wall')
# Open pergola: posts outside table/aisle paths, slats cast a soft shade.
for x in [-4.45,4.45]:
    for z in [-2.6,2.6]: cube('pergola_post',(x,1.9,z),(.18,3.8,.18),'wood')
for z in [-2.6,2.6]: cube('pergola_beam',(0,3.8,z),(9.2,.22,.2),'wood')
for x in [-4,-2,0,2,4]: cube('pergola_slat',(x,3.97,0),(.18,.16,5.6),'wall')
light=mat('light').node_tree.nodes.get('Principled BSDF')
light.inputs['Emission Color'].default_value=(1,.65,.22,1)
light.inputs['Emission Strength'].default_value=2
for i in range(13):
    x=-4.4+i*8.8/12;y=3.6-.38*math.sin(i/12*math.pi)
    orb(f'string_light_{i}',(x,y,2.6),(.095,.12,.095),'light')
    if i:
        prev=-4.4+(i-1)*8.8/12;py=3.6-.38*math.sin((i-1)/12*math.pi)
        beam('light_cable',(prev,-2.6,py),(x,-2.6,y),.015,'metal')
cube('lamp_stem',(-.15,1.99,-.35),(.035,.5,.035),'metal')
cone('lamp_shade',(-.15,.35,2.24),.22,.12,.2,'light')
for x in [-3.4,3.4]:
    orb('beanbag',(x,.3,-3.6),(.7,.3,.55),'wall')
    cube('plant_pot',(x,.28,3.4),(.5,.56,.5),'wood')
    for dx in [-.2,0,.2]: orb('plant_leaf',(x+dx,.85,3.4),(.18,.4,.22),'leaf')
cube('library_post',(0,.6,-3.7),(.18,1.2,.18),'wood')
cube('little_library',(0,1.65,-3.9),(1.8,1.3,.18),'wood')
for x in [-.85,.85]: cube('library_side',(x,1.65,-3.6),(.12,1.3,.65),'wood')
for y in [1,1.6,2.3]: cube('library_shelf',(0,y,-3.6),(1.8,.1,.7),'wall')
for i in range(9): cube('library_book',(-.7+i*.17,1.3,-3.56),(.12,.42,.36),'leaf' if i%2 else 'wall')
cube('chalkboard_frame',(0,1.05,3.55),(2.15,1.3,.15),'wood')
cube('chalkboard',(0,1.07,3.64),(1.95,1.1,.035),'chalk')
for x in [-.8,.8]: cube('sign_leg',(x,.45,3.55),(.12,.9,.12),'wood')
bpy.ops.object.text_add(location=(0,-3.67,1.06),rotation=(math.pi/2,0,0))
t=bpy.context.object;t.name='Study_Spot_lettering';t.data.body='Study Spot';t.data.align_x='CENTER';t.data.align_y='CENTER';t.data.size=.3;t.data.resolution_u=2;t.data.materials.append(mat('wall'));bpy.ops.object.convert(target='MESH')
export('study_nook')

# Contact sheet renders the actual exported GLB, not source objects.
reset()
bpy.ops.import_scene.gltf(filepath=str(OUT/'study_nook.glb'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world.color=(.35,.35,.35);scene.view_settings.view_transform='Standard'
box('ground',(0,0,-.12),(200,200,.2),'wall')
bpy.ops.object.camera_add(location=(10,-15,12));cam=bpy.context.object
cam.rotation_euler=(Vector((0,0,1.4))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=13;scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-3,-6,13));bpy.context.object.data.energy=2100;bpy.context.object.data.size=8
scene.render.filepath=str(ROOT/'assets/previews/study_nook_contact.png');bpy.ops.render.render(write_still=True)
