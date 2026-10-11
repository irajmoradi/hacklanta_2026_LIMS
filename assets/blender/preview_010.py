"""Matched cameras/lighting: render exported before/after GLBs."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
for version,source in [('before',ROOT/'assets/baseline_009'),('after',OUT)]:
    reset()
    bpy.ops.import_scene.gltf(filepath=str(source/'colosseum.glb'))
    gate=bpy.data.objects.get('gate')
    if gate:gate.location.z=3.5
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.world.color=(.19,.16,.24)
    box('ground',(0,0,-.15),(200,200,.2),'soil')
    for loc,energy,color,size in [((-8,-10,16),3300,(1,.73,.46),8),((8,8,12),2200,(.57,.69,1),10)]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(16,-25,23));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.6))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=29;scene.camera=camera
    scene.render.filepath=str(ROOT/f'assets/previews/colosseum_{version}.png');bpy.ops.render.render(write_still=True)
