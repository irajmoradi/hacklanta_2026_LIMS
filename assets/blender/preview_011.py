"""Render actual PBR GLBs with identical cameras/lighting before and after."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *
sys.path.insert(0, str(ROOT / 'assets'))
from palette_011 import PALETTES, BASE

DEST = ROOT / 'assets/previews/palette_011'
DEST.mkdir(parents=True, exist_ok=True)
for name in PALETTES:
    for version, source in [('before', BASE), ('after', OUT)]:
        reset()
        bpy.data.orphans_purge(do_recursive=True)
        bpy.ops.import_scene.gltf(filepath=str(source / (name + '.glb')))
        points = [o.matrix_world @ Vector(v) for o in bpy.context.scene.objects if o.type == 'MESH' for v in o.bound_box]
        lo = Vector([min(p[i] for p in points) for i in range(3)])
        hi = Vector([max(p[i] for p in points) for i in range(3)])
        center = (lo + hi) / 2
        extent = max(hi - lo)
        scene = bpy.context.scene
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 24
        scene.cycles.use_denoising = True
        scene.render.resolution_x = 560
        scene.render.resolution_y = 440
        scene.render.resolution_percentage = 100
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.38, .43, .5, 1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65
        scene.view_settings.view_transform = 'AgX'
        # Neutral floor and soft studio lights expose roughness/metal and texture.
        box('preview_ground', (0, 0, -.12), (200, 200, .2), 'stone')
        for loc, energy, color in [((-5, -8, 12), 1900, (1, .87, .72)), ((7, 1, 9), 1450, (.77, .86, 1))]:
            bpy.ops.object.light_add(type='AREA', location=loc)
            light = bpy.context.object
            light.data.energy = energy
            light.data.color = color
            light.data.shape = 'DISK'
            light.data.size = 7
            light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.ops.object.camera_add(location=center + Vector((extent * 1.05, extent * -2.1, extent * 1.05)))
        camera = bpy.context.object
        camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.type = 'ORTHO'
        camera.data.ortho_scale = extent * 1.55
        scene.camera = camera
        scene.render.filepath = str(DEST / f'{name}_{version}.png')
        bpy.ops.render.render(write_still=True)
