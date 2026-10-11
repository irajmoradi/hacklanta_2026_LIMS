"""Contact sheet of the exported farm GLBs (CPU render)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from farm_kit import *
from mathutils import Vector
reset()
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=24
scene.render.resolution_x=1600; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.world.color=(.4,.4,.4)
for i,name in enumerate(NAMES):
    x=(i%4-1.5)*5; y=(i//4)*5
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
    imported=set(bpy.data.objects)-before
    points=[obj.matrix_world @ Vector(corner) for obj in imported if obj.type=='MESH' for corner in obj.bound_box]
    lo=Vector(tuple(min(p[a] for p in points) for a in range(3)))
    hi=Vector(tuple(max(p[a] for p in points) for a in range(3)))
    center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    factor=2.6/max(hi-lo)
    for obj in imported:
        if obj.parent is None:
            obj.location=(obj.location-center)*factor+Vector((x,y,0))
            obj.scale*=factor
    bpy.ops.object.text_add(location=(x-1.6,y-2,.03))
    label=bpy.context.object; label.data.body=name; label.data.size=.28; label.data.materials.append(mat('metal'))
box('ground',(0,2,-.15),(24,14,.25),'wall')
bpy.ops.object.camera_add(location=(6,-12,30)); camera=bpy.context.object
camera.rotation_euler=(Vector((0,2,1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=26; scene.camera=camera
bpy.ops.object.light_add(type='AREA',location=(-3,-6,15)); bpy.context.object.data.energy=3000; bpy.context.object.data.size=12
bpy.ops.object.light_add(type='SUN'); bpy.context.object.data.energy=1.3
scene.render.filepath=str(ROOT/'assets/previews/farm_contact_sheet.png')
bpy.ops.render.render(write_still=True)
