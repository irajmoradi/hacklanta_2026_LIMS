"""Shared deterministic geometry; Blender Z-up, front -Y exports to glTF +Z."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'apps/web/public/models'
PALETTE = {'wall': '#F1D9AD', 'roof': '#B85747', 'trim': '#714D3D',
           'accent': '#3B9790', 'glass': '#91CDD1', 'leaf': '#689B68',
           'wood': '#8A6044', 'stone': '#989C9F', 'metal': '#384852',
           'light': '#FFE4A1', 'soil': '#776550', 'path': '#C8B998',
           'skin': '#DDA77D', 'hair': '#583E35', 'shirt': '#3B9790',
           'pants': '#465B72', 'shoes': '#694C40', 'fur': '#BF8A57',
           'water': '#64B7BF', 'jacket': '#527D9D', 'blossom': '#E9A9B1',
           'fire': '#F6A34D', 'hay': '#D7B86D'}

def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.materials, bpy.data.actions):
        for item in list(collection):
            collection.remove(item)

def mat(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    rgb = [int(PALETTE[name][i:i+2], 16)/255 for i in (1,3,5)]
    rgb = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = .85
    return m

def finish(obj, name, material):
    obj.name = name
    obj.data.materials.append(mat(material))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj

def box(name, loc, size, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = size
    return finish(obj, name, material)

def cone(name, loc, r1, r2, depth, material, vertices=8):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2,
                                    depth=depth, location=loc)
    return finish(bpy.context.object, name, material)

def ball(name, loc, scale, material):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, material)

def mesh(name, verts, faces, material):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat(material))
    return obj

def beam(name, a, b, radius, material):
    a, b = Vector(a), Vector(b)
    obj = cone(name, (a+b)/2, radius, radius, (b-a).length, material)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj

def export(name):
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT / (name+'.glb')), export_format='GLB',
        use_selection=True, export_yup=True, export_animations=True,
        export_animation_mode='ACTIONS', export_force_sampling=True,
        export_optimize_animation_size=False, export_extras=True)

