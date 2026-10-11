"""Render the exported GLB for a four-view contact sheet and catalog thumbnail."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *

dest=ROOT/'assets/previews/patio_012';dest.mkdir(parents=True,exist_ok=True)
for name,location,night in [('front',(10,-13,10),False),('rear',(-10,13,9),False),('detail',(7,-10,6),False),('night',(10,-13,10),True)]:
    reset();bpy.ops.import_scene.gltf(filepath=str(OUT/'cafe_patio.glb'))
    for m in bpy.data.materials:
        if m.name=='patio_bulb': m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=3 if night else .05
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=900;scene.render.resolution_y=650;scene.render.resolution_percentage=100
    scene.world.use_nodes=True;bg=scene.world.node_tree.nodes['Background'];bg.inputs[0].default_value=(.18,.24,.4,1) if night else (.55,.61,.7,1);bg.inputs[1].default_value=.3 if night else .7
    scene.view_settings.view_transform='AgX'
    box('ground',(0,0,-.11),(200,200,.2),'stone')
    bpy.ops.object.light_add(type='AREA',location=(-3,-5,11));bpy.context.object.data.energy=180 if night else 1900;bpy.context.object.data.size=8
    if night:
        for x in [-3,0,3]:
            bpy.ops.object.light_add(type='POINT',location=(x,1.3,3));bpy.context.object.data.energy=45;bpy.context.object.data.color=(1,.65,.25);bpy.context.object.data.shadow_soft_size=.6
    bpy.ops.object.camera_add(location=location);cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.4))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=12.5;scene.camera=cam
    scene.render.filepath=str(dest/(name+'.png'));bpy.ops.render.render(write_still=True)
