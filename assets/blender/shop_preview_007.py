"""Render actual shop GLBs; run --before before rebuilding, then run without it."""
import sys, json, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *

before = '--before' in sys.argv
entries = [e for e in json.loads((ROOT/'packages/catalog/catalog.json').read_text())['entries']
           if any(t in e.get('tags', []) for t in ('shop','earn_only')) and e['kind'] != 'consumable']
if '--variants' in sys.argv:
    entries = [e for e in json.loads((ROOT/'packages/catalog/catalog.json').read_text())['entries'] if 'house_variants_008' in e.get('tags', [])]
if '--priced' in sys.argv:
    entries = [e for e in json.loads((ROOT/'packages/catalog/catalog.json').read_text())['entries']
               if (e.get('price_coins') or e.get('price_xp') or 0) > 0]
dest = ROOT/('assets/previews/shop_before_tiles' if before else 'apps/web/public/thumbs')
dest.mkdir(parents=True, exist_ok=True)
for entry in entries:
    if '--resume' in sys.argv and (dest/(entry['id']+'.png')).exists(): continue
    if '--rewards-only' in sys.argv and 'earn_only' not in entry.get('tags', []): continue
    only=next((a.split('=',1)[1].split(',') for a in sys.argv if a.startswith('--only=')),None)
    if only and entry['id'] not in only: continue
    for obj in list(bpy.data.objects): bpy.data.objects.remove(obj, do_unlink=True)
    reset()
    bpy.data.orphans_purge(do_recursive=True)
    name = entry['id']
    path = ROOT/'apps/web/public'/entry.get('asset', {}).get('glb', f'/models/{name}.glb').lstrip('/')
    if before:
        path = ROOT/'assets/previews/shop_baseline_models'/path.name
    if path.exists():
        bpy.ops.import_scene.gltf(filepath=str(path))
    elif not before and name in ('villagergram', 'photo_token', 'revival_potion'):
        from shop_icons_009 import build_icon
        build_icon(name)
    elif '--priced' in sys.argv and not before:
        raise FileNotFoundError(f'No model or authored icon for {name}: {path}')
    else:
        # Honest pre-pass representation of the missing shirt / icon-only voice cards.
        box('missing_model' if entry['kind'] != 'voice_style' else 'voice_card', (0,0,.45), (.65,.18,.9), 'accent')
    if entry.get('tint'):
        rgb = [int(entry['tint'][i:i+2],16)/255 for i in (1,3,5)]
        rgb = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb]
        for material in bpy.data.materials:
            if material.use_nodes:
                bsdf = material.node_tree.nodes.get('Principled BSDF')
                if bsdf:
                    for link in list(bsdf.inputs['Base Color'].links): material.node_tree.links.remove(link)
                    bsdf.inputs['Base Color'].default_value=(*rgb,1)
    for obj in bpy.context.scene.objects:
        if obj.animation_data: obj.animation_data_clear()
        if obj.type == 'ARMATURE':
            for bone in obj.pose.bones: bone.matrix_basis.identity()
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not any(c.name.startswith('glTF_not_exported') for c in o.users_collection)]
    corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector(tuple(min(v[i] for v in corners) for i in range(3)))
    hi = Vector(tuple(max(v[i] for v in corners) for i in range(3)))
    center = (lo+hi)/2
    radius = max(hi-lo)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 8
    scene.render.resolution_x = scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.world.color = (.22,.22,.22)
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,lo.z-.006))
    bpy.context.object.is_shadow_catcher = True
    bpy.ops.object.camera_add(location=center+Vector((1.35,2.5 if name.endswith('_greenhouse') else -2.5,1.25))*radius)
    camera = bpy.context.object
    camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = radius*1.5
    scene.camera = camera
    for position, power, size, color in [(( -2,-3,4),450,3,(1,.89,.76)), ((2,1,3),550,2,(.75,.87,1)), ((1,-2,1),100,2,(1,1,1))]:
        bpy.ops.object.light_add(type='AREA', location=center+Vector(position)*radius)
        lamp = bpy.context.object
        lamp.data.energy = power*radius*radius
        lamp.data.shape = 'DISK'
        lamp.data.size = size*radius
        lamp.data.color = color
        lamp.rotation_euler = (center-lamp.location).to_track_quat('-Z','Y').to_euler()
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = str(dest/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('SHOP_RENDER', name, flush=True)
