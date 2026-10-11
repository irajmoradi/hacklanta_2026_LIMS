"""Shared PBR recipes, exported as embedded standard glTF textures/extensions."""
import json, math, struct
from common import *

LIBRARY=json.loads((ROOT/'assets/materials/library.json').read_text())

def apply(overrides=None):
    recipes={'wall':'wood','roof':'shingle','trim':'wood','door':'wood','accent':'ceramic',
             'wood':'wood','stone':'stone','metal':'metal','glass':'glass','water':'glass',
             'shirt':'fabric','jacket':'fabric','primary':'fabric','secondary':'fabric',
             'fur':'fabric','shoes':'leather','light':'brass'}
    recipes.update(overrides or {})
    for material in bpy.data.materials:
        kind=recipes.get(material.name)
        if not kind or not material.use_nodes: continue
        spec=LIBRARY[kind]
        bsdf=material.node_tree.nodes.get('Principled BSDF')
        if not bsdf: continue
        bsdf.inputs['Roughness'].default_value=spec['roughness']
        bsdf.inputs['Metallic'].default_value=spec['metalness']
        bsdf.inputs['Transmission Weight'].default_value=spec.get('transmission',0)
        material['surface']=kind
        color=PALETTE.get(material.name)
        if color:
            rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
            rgb=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
            bsdf.inputs['Base Color'].default_value=(*rgb,1)
        material['tint_factor']=list(bsdf.inputs['Base Color'].default_value)
        if 'pattern' in spec:
            tex=material.node_tree.nodes.new('ShaderNodeTexImage')
            tex.image=bpy.data.images.load(str(ROOT/'assets/materials'/(kind+'.png')),check_existing=True)
            tex.image.pack()
            # Export neutral pixels directly. Blender otherwise bakes multiplication
            # into the image, which would contaminate runtime paint colors.
            material.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH': continue
        uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='SurfaceUV')
        # World-space box projection: stable grain/mortar size across small details.
        for poly in obj.data.polygons:
            normal=obj.matrix_world.to_3x3()@poly.normal
            axis=max(range(3),key=lambda i: abs(normal[i]))
            axes=(1,2) if axis==0 else (0,2) if axis==1 else (0,1)
            for li in poly.loop_indices:
                p=obj.matrix_world@obj.data.vertices[obj.data.loops[li].vertex_index].co
                uv.data[li].uv=(p[axes[0]]*2,p[axes[1]]*2)

def export_materials(name):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',
        use_selection=True,export_yup=True,export_animations=False,export_extras=True)
    path=OUT/(name+'.glb'); raw=path.read_bytes()
    length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+length]); rest=raw[20+length:]
    for material in doc['materials']:
        factor=material.get('extras',{}).get('tint_factor')
        if factor: material['pbrMetallicRoughness']['baseColorFactor']=factor
    data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(data)+len(rest))+struct.pack('<II',len(data),0x4E4F534A)+data+rest)
