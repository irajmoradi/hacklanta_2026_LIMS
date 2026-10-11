"""CPU-render the exported GLBs, plus representative poses of each baked clip."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *
sys.path.insert(0, str(ROOT/'assets'))
from kit_spec import ATTACHMENTS
import town_spec as town
import event_spec as events

reset()
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=24
cosmetics='--cosmetics' in sys.argv
outfits='--outfits' in sys.argv
wardrobe='--wardrobe' in sys.argv or outfits
shop_fit='--shop-fit' in sys.argv
motion='--motion' in sys.argv
event_preview='--events' in sys.argv
cosmetics=cosmetics or wardrobe or shop_fit
scene.render.resolution_x=2600 if wardrobe else 2400 if cosmetics else 3200
scene.render.resolution_y=1800 if wardrobe else 1100 if cosmetics else 6000
scene.render.resolution_percentage=100
scene.world.color=(.35,.35,.35)
scene.view_settings.view_transform='Standard'
names=[p.stem for p in sorted(OUT.glob('*.glb'))]
entries=[(name,None) for name in names]+[('villager_base',clip) for clip in ('idle','walk','wave','cheer')]
if event_preview:
    entries=[(name,None) for name in events.NAMES]+[('villager_base','fit:party_hat_villager')]
    ATTACHMENTS['party_hat_villager']=('Head',(0,.68,0))
    scene.render.resolution_x=2800
    scene.render.resolution_y=2600
if cosmetics:
    entries=[('villager_base','fit:'+name) for name in ATTACHMENTS]
if wardrobe:
    entries=[('villager_base','fit:'+name) for name in town.SKINNED+list(town.ATTACH)]
    entries += [('pet_dog','fit:'+name) for name in ('pet_collar','pet_bandana')]
if outfits:
    from outfits_spec import NAMES, TOPS, entry
    entries=[('villager_base','fit:'+name) for name in NAMES]
    town.SKINNED = list(town.SKINNED) + ['outfit_'+style for style in TOPS]
    for name in NAMES:
        attach=entry(name)['asset']['attach']
        if 'bone' in attach: town.ATTACH[name]=(attach['bone'],tuple(attach['offset']))
if shop_fit:
    ATTACHMENTS.update({n:('Head',(0,.68,0)) for n in ('hat_beanie','hat_cap','hat_crown','hat_cowboy')})
    entries=[('villager_base','fit:'+n) for n in ('hat_beanie','hat_cap','hat_crown','hat_cowboy','hat_festival','hat_headphones','glasses_round','jacket_denim','scarf','shirt_hoodie','shirt_stripes')]
    scene.render.resolution_x=2200
    scene.render.resolution_y=1800
columns=4 if outfits else 5 if cosmetics or event_preview else 7
rows=math.ceil(len(entries)/columns)
for index,(name,clip) in enumerate(entries):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
    objects=set(bpy.data.objects)-before
    animated_fit=motion and name=='villager_base' and clip and clip.startswith('fit:')
    if (clip and not clip.startswith('fit:')) or animated_fit:
        rig=next(o for o in objects if o.type=='ARMATURE')
        animation=('walk' if any(s in clip for s in ('pants','shoes')) else 'wave') if animated_fit else clip
        # Importer creates an NLA track for each clip. Activate one at a time.
        for track in rig.animation_data.nla_tracks:
            track.mute=not track.name.startswith(animation)
        rig.animation_data.action=None
        scene.frame_set(10)
    else:
        for obj in objects:
            if obj.animation_data:
                obj.animation_data_clear()
            if obj.type=='ARMATURE':
                for bone in obj.pose.bones:
                    bone.matrix_basis.identity()
    if clip and clip.startswith('fit:'):
        accessory=clip[4:]
        before_accessory=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(OUT/(accessory+'.glb')))
        additions=set(bpy.data.objects)-before_accessory
        if accessory in town.SKINNED or accessory=='shirt_stripes':
            base_rig=next(o for o in objects if o.type=='ARMATURE')
            for obj in list(additions):
                if obj.type=='MESH':
                    for mod in obj.modifiers:
                        if mod.type=='ARMATURE': mod.object=base_rig
                    obj.parent=base_rig
            for obj in list(additions):
                if obj.type=='ARMATURE':
                    additions.remove(obj)
                    bpy.data.objects.remove(obj,do_unlink=True)
            position=Vector((0,0,0))
        elif accessory.startswith('pet_'):
            position=Vector((0,0,0))
        else:
            joint,offset=({**ATTACHMENTS,**town.ATTACH})[accessory]
            height={'Head':1.13,'Spine':.7,'Arm_L':1.08}[joint]
            position=Vector((offset[0]+(.37 if joint=='Arm_L' else 0),-offset[2],height+(-offset[1] if joint=='Arm_L' else offset[1])))
        for obj in additions:
            if obj.parent is None:
                obj.location+=position
                if animated_fit and accessory in town.ATTACH:
                    bpy.context.view_layer.update()
                    bone=rig.pose.bones[joint]
                    deformation=rig.matrix_world @ bone.matrix @ bone.bone.matrix_local.inverted() @ rig.matrix_world.inverted()
                    obj.matrix_world=deformation @ obj.matrix_world
        objects.update(additions)
    meshes=[o for o in objects if o.type=='MESH' and
            not any(c.name.startswith('glTF_not_exported') for c in o.users_collection)]
    bpy.context.view_layer.update()
    # Freeze evaluated poses so later imports/frame changes cannot alter earlier cells.
    depsgraph=bpy.context.evaluated_depsgraph_get()
    frozen=[]
    for obj in meshes:
        data=bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
        copy=bpy.data.objects.new('preview_'+obj.name,data)
        bpy.context.collection.objects.link(copy)
        copy.matrix_world=obj.matrix_world.copy()
        frozen.append(copy)
    for obj in objects:
        bpy.data.objects.remove(obj,do_unlink=True)
    corners=[o.matrix_world@Vector(v) for o in frozen for v in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in corners) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in corners) for i in range(3)))
    scale=min(3.5/max(hi.x-lo.x,hi.y-lo.y),3.1/max(.001,hi.z-lo.z))
    x=(index%columns-(columns-1)/2)*4.8
    spacing=7.5 if outfits else 5.3 if cosmetics else 6.8
    y=((rows-1)/2-index//columns)*spacing
    center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    for obj in frozen:
        obj.location=(obj.location-center)*scale+Vector((x,y,.025))
        obj.scale*=scale
    if wardrobe and clip in ('fit:backpack','fit:outfit_backpack','fit:pet_collar','fit:pet_bandana'):
        bpy.context.view_layer.update()
        from mathutils import Matrix
        angle=math.pi if clip in ('fit:backpack','fit:outfit_backpack') else -.9
        pivot=Vector((x,y,0))
        rotation=Matrix.Rotation(angle,4,'Z')
        for obj in frozen:
            obj.matrix_world=Matrix.Translation(pivot) @ rotation @ Matrix.Translation(-pivot) @ obj.matrix_world
    PALETTE['display_paper']='#EFE4CF'
    PALETTE['display_ink']='#354C43'
    box('display_plinth',(x,y,-.10),(4.4,spacing-.8,.2),'display_paper' if shop_fit else 'wall')
    bpy.ops.object.text_add(location=(x-1.95,y-spacing/2+.6,.015))
    label=bpy.context.object
    label.data.body=name if not clip else clip
    label.data.size=.25
    label.data.materials.append(mat('display_ink' if shop_fit else 'metal'))

box('ground',(0,0,-.28),(columns*4.8+2,rows*spacing+2,.2),'path')
bpy.ops.object.camera_add(location=(0,-50,60) if not cosmetics else (0,-28,20))
camera=bpy.context.object
if outfits: camera.location=(0,-28,40)
camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=max(38,rows*6.1) if not cosmetics else 27 if wardrobe else 25
if outfits:
    camera.data.ortho_scale=33
    scene.render.resolution_x=2200
    scene.render.resolution_y=2600
scene.camera=camera
if cosmetics:
    bpy.ops.object.light_add(type='AREA',location=(-7,-8,20))
    bpy.context.object.data.energy=5500
    bpy.context.object.data.shape='DISK'
    bpy.context.object.data.size=15
else:
    bpy.ops.object.light_add(type='SUN',location=(-7,-8,20))
    bpy.context.object.rotation_euler=(.35,-.4,-.2)
    bpy.context.object.data.energy=2
    bpy.context.object.data.angle=.35
target=ROOT/'assets/previews'/('outfits_motion.png' if outfits and motion else 'outfits_fit.png' if outfits else 'events.png' if event_preview else 'wardrobe_motion.png' if motion else 'wardrobe_fit.png' if wardrobe else 'cosmetic_fit.png' if cosmetics else 'contact_sheet.png')
if shop_fit: target=ROOT/'assets/previews/shop_fit.png'
target.parent.mkdir(parents=True,exist_ok=True)
scene.render.filepath=str(target)
bpy.ops.render.render(write_still=True)
