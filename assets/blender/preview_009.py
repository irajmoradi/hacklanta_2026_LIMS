"""Render exported GLBs and every registry preset for review, using CPU Workbench."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
sys.path.insert(0,str(ROOT/'assets'))
from nature_spec_009 import NAMES, BUILDINGS

DEST=ROOT/'assets/previews/pack_009'
DEST.mkdir(parents=True,exist_ok=True)
registry=json.loads((ROOT/'packages/catalog/catalog.json').read_text())
entries={e['id']:e for e in registry['entries']}

def render(name,source,suffix,variant=None):
    reset()
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.import_scene.gltf(filepath=str(source/(name+'.glb')))
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    if variant:
        for key,color in variant['materials'].items():
            rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
            rgb=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
            bpy.data.materials[key].diffuse_color=(*rgb,1)
    pts=[o.matrix_world@Vector(v) for o in objs for v in o.bound_box]
    lo=Vector([min(p[i] for p in pts) for i in range(3)])
    hi=Vector([max(p[i] for p in pts) for i in range(3)])
    center=(lo+hi)/2
    extent=max(hi-lo)
    scene=bpy.context.scene
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO'
    scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_shadows=True
    scene.display.shading.show_cavity=True
    scene.display.shading.cavity_type='BOTH'
    scene.display.shading.show_object_outline=False
    scene.display.shading.background_type='WORLD'
    scene.world.color=(.065,.08,.105)
    scene.view_settings.view_transform='Standard'
    scene.render.resolution_x=420
    scene.render.resolution_y=340
    scene.render.resolution_percentage=100
    bpy.ops.object.camera_add(location=center+Vector((extent*1.1,extent*-2.1,extent*1.3)))
    camera=bpy.context.object
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=extent*1.65/(variant['scale'] if variant else 1)
    scene.camera=camera
    scene.render.filepath=str(DEST/(name+'_'+suffix+'.png'))
    bpy.ops.render.render(write_still=True)

for name in NAMES:
    for variant in entries[name]['asset']['variants']:
        render(name,OUT,variant['id'],variant)
for name in BUILDINGS:
    render(name,ROOT/'assets/baseline_009','before')
    render(name,OUT,'after')
