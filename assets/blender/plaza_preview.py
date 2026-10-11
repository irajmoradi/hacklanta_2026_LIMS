"""Side-by-side actual-scale assembly of exported civic and festival GLBs."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from plaza_kit import *
from mathutils import Vector

reset()
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=32
scene.render.resolution_x=2200
scene.render.resolution_y=1150
scene.render.resolution_percentage=100
scene.world.color=(.35,.35,.35)
scene.view_settings.view_transform='Standard'

def asset(name, position):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
    for obj in set(bpy.data.objects)-before:
        if obj.parent is None: obj.location+=Vector(position)

box('civic_paving',(-5,0,-.12),(9.3,8.3,.24),'civic_white')
box('festival_paving',(5,0,-.12),(9.3,8.3,.24),'path')
asset('mayor_podium',(-5,1,0))
asset('mayor_statue',(-7.7,-2.1,0))
asset('notice_board',(-2.25,-1.7,0))
asset('festival_main_stage',(5,.6,0))
for x,title,subtitle in ((-5,"MAYOR'S PLAZA",'CIVIC  /  CENTRAL PLAZA'),(5,'FESTIVAL STAGE','CONCERT  /  FESTIVAL DISTRICT')):
    # Vertical labels remain legible from the camera without covering models.
    lettering('title',title,(x,-4.3,.15),.46,'civic_green')
    lettering('subtitle',subtitle,(x,-4.32,-.29),.21,'metal')
box('ground',(0,0,-.6),(200,200,.2),'wall')
bpy.ops.object.camera_add(location=(10,-27,17))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.3))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=23.5
scene.camera=camera
bpy.ops.object.light_add(type='AREA',location=(-6,-10,17))
bpy.context.object.data.energy=4200
bpy.context.object.data.size=10
bpy.ops.object.light_add(type='SUN')
bpy.context.object.rotation_euler=(.4,-.3,-.4)
bpy.context.object.data.energy=1.5
bpy.context.object.data.angle=.3
scene.render.filepath=str(ROOT/'assets/previews/mayor_vs_festival.png')
bpy.ops.render.render(write_still=True)
