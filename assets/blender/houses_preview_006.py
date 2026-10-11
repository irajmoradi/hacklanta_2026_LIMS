"""Render the actual GLBs from opposite corners, plus all runtime palettes."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
sys.path.insert(0,str(ROOT/'assets'))
from house_spec_006 import *

DEST=ROOT/'assets/previews/houses_006'
DEST.mkdir(parents=True,exist_ok=True)

def render(name,view,palette=None):
    reset()
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
    if palette:
        for key,color in palette.items():
            rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
            rgb=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
            bpy.data.materials[key].diffuse_color=(*rgb,1)
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    pts=[o.matrix_world@Vector(v) for o in objs for v in o.bound_box]
    lo=Vector([min(p[i] for p in pts) for i in range(3)])
    hi=Vector([max(p[i] for p in pts) for i in range(3)])
    center=(lo+hi)/2
    extent=max(hi-lo)
    scene=bpy.context.scene
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO'
    scene.display.shading.studiolight_rotate_z=.35
    scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_shadows=True
    scene.display.shading.show_cavity=True
    scene.display.shading.cavity_type='BOTH'
    scene.display.shading.show_object_outline=False
    scene.display.shading.background_type='WORLD'
    scene.world.color=(.075,.09,.115)
    scene.view_settings.view_transform='Standard'
    scene.render.resolution_x=400
    scene.render.resolution_y=350
    scene.render.resolution_percentage=100
    bpy.ops.object.camera_add(location=center+Vector((extent*(1.3 if view=='front' else -1.3),extent*(-2 if view=='front' else 2),extent*1.05)))
    camera=bpy.context.object
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=extent*1.66
    scene.camera=camera
    suffix=view if palette is None else 'palette_'+str(PALETTES[MODELS[name][0]].index(palette))
    scene.render.filepath=str(DEST/(name+'_'+suffix+'.png'))
    bpy.ops.render.render(write_still=True)

for name in MODELS:
    if '--aframe-only' in sys.argv and MODELS[name][0]!='aframe': continue
    for view in ('front','back'):
        if '--resume' in sys.argv and view=='front' and (DEST/(name+'_front.png')).exists(): continue
        render(name,view)
for style in STYLES:
    if '--aframe-only' in sys.argv and style!='aframe': continue
    for palette in PALETTES[style]: render(f'house_{style}_lv2','front',palette)
