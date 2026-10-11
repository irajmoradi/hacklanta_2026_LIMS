"""Render exported models at actual scale on a rectangular 4 m street grid."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
reset()

def place(name,x,y,z=0,angle=0):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
    for obj in set(bpy.data.objects)-before:
        if obj.parent is None:
            from mathutils import Matrix
            obj.matrix_world=Matrix.Translation((x,y,z)) @ Matrix.Rotation(angle,4,'Z') @ obj.matrix_world

cells={(x,y) for x in range(-18,19,4) for y in range(-12,13,4)
       if x in (-18,-6,6,18) or y in (-12,0,12)}
patterns={'road_cross':{0,1,2,3},'road_t':{0,1,3},'road_corner':{0,1},'road_straight':{0,2}}
for x,y in sorted(cells):
    connections={i for i,(dx,dy) in enumerate(((0,-4),(4,0),(0,4),(-4,0))) if (x+dx,y+dy) in cells}
    for name,pattern in patterns.items():
        match=next((r for r in range(4) if {(i+r)%4 for i in pattern}==connections),None)
        if match is not None:
            place(name,x,y,angle=match*math.pi/2)
            break
for x,y,name in [(-12,-6,'house_lv4'),(0,-6,'storefront_records'),(12,-6,'gym'),
                 (-12,6,'storefront_cafe'),(0,6,'town_hall'),(12,6,'studio_art')]:
    for dx in (-2,2):
        for dy in (-2,2): place('plaza_tile',x+dx,y+dy)
    place(name,x,y,.12)
    place('streetlight',x-3.5,y-3.5,.12)
    place('planter',x+3.35,y+3.2,.12)
place('bus_stop',-12,2.9,.12)
place('bike_rack',11,2.8,.12)
box('terrain',(0,0,-.15),(42,30,.3),'leaf')
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=24
scene.render.resolution_x=2200; scene.render.resolution_y=1500; scene.render.resolution_percentage=100
scene.world.color=(.4,.4,.4)
scene.view_settings.view_transform='Standard'
bpy.ops.object.camera_add(location=(30,-42,36))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=53; scene.camera=camera
bpy.ops.object.light_add(type='SUN',location=(-7,-8,20))
bpy.context.object.rotation_euler=(.35,-.4,-.2); bpy.context.object.data.energy=2
bpy.context.object.data.angle=.35
scene.render.filepath=str(ROOT/'assets/previews/town_grid.png')
bpy.ops.render.render(write_still=True)
