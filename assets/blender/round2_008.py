"""ASSET-008 deterministic architecture, tailored clothes and unique earned rewards."""
import sys, math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
from shop_007 import soft_ball as full_ball, rounded
from festival_kit import ring, disc
import houses_006 as houses
from materials_008 import apply, export_materials

base_reset=reset
def reset():
    base_reset()
    bpy.data.orphans_purge(do_recursive=True)

REWARDS=('perfect_week_halo','competition_laurels','mayor_medal','auditor_badge','champion_mantle','streak_flame_scarf')
VARIANTS={1:('porch','bay'),2:('balcony','bay'),3:('tower','greenhouse'),4:('tower','greenhouse'),5:('tower','greenhouse')}
PALETTE.update(primary='#405C80',secondary='#D9C6A2',gold='#D8AA45',dark='#282D35',door='#664535')

def soft_ball(name,loc,scale,material):
    if name not in ('laurel_leaf','eye','eye_glint','eyebrow','nose','tongue','inner_ear'):
        return full_ball(name,loc,scale,material)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=6,radius=1,location=loc)
    obj=bpy.context.object;obj.scale=scale;finish(obj,name,material)
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def finish_asset(name, overrides=None):
    bpy.context.view_layer.update()
    apply(overrides)
    if 'gold' in bpy.data.materials:
        bsdf=bpy.data.materials['gold'].node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Metallic'].default_value=.8; bsdf.inputs['Roughness'].default_value=.23
    export_materials(name)

def variant(style,level,choice):
    reset(); PALETTE.update(houses.PALETTES[style][0]); houses.build(style,min(level,3))
    base=.52 if style=='beach' else .22
    top=base+1.5+(min(level,3)-1)*.66
    if choice in ('porch','balcony'):
        z=base if choice=='porch' else base+1.35
        box(choice+'_floor',(0,-1.42,z),(2.55,.85,.10),'wood')
        for x in (-1.2,1.2): box(choice+'_pillar',(x,-1.78,(base+z+1.05)/2),(.085,.085,z+1.05-base),'trim')
        box(choice+'_roof',(0,-1.43,z+1.12),(2.7,1,.10),'roof')
        for x in (-1.15,-.92,-.69,.69,.92,1.15): box(choice+'_baluster',(x,-1.8,z+.24),(.04,.04,.43),'trim')
        for sign in (-1,1): box(choice+'_rail',(sign*.9,-1.8,z+.47),(.68,.06,.06),'accent')
    elif choice=='bay':
        box('bay_base',(-.88,-1.23,base+.58),(.68,.58,.85),'wall')
        box('bay_glass',(-.88,-1.53,base+.83),(.53,.025,.48),'glass')
        for x in (-1.22,-.54): box('bay_side_glass',(x,-1.22,base+.83),(.015,.42,.48),'glass')
        for x in (-1.22,-.88,-.54): box('bay_mullion',(x,-1.56,base+.83),(.035,.04,.52),'trim')
        box('bay_cap',(-.88,-1.24,base+1.15),(.85,.72,.12),'roof')
    elif choice=='tower':
        cone('tower',(1,-.68,top/2),.48,.48,top,'wall',8)
        cone('tower_roof',(1,-.68,top+.52),.67,0,1.04,'roof',8)
        box('tower_window',(1,-1.135,top-.6),(.29,.03,.55),'glass')
        for x in (.82,1.18): box('tower_jamb',(x,-1.16,top-.6),(.045,.045,.62),'trim')
        cone('tower_finial',(1,-.68,top+1.11),.035,0,.18,'light')
    else:
        box('greenhouse_plinth',(.45,1.48,.15),(1.75,.95,.3),'stone')
        box('greenhouse_glazing',(.45,1.48,.85),(1.7,.9,1.1),'glass')
        for x in (-.42,.15,.73,1.32):
            for y in (1.02,1.94): box('greenhouse_frame',(x,y,.85),(.045,.045,1.2),'metal')
            beam('greenhouse_roof_bar',(x,1.02,1.45),(x,1.48,1.78),.025,'metal')
            beam('greenhouse_roof_bar',(x,1.48,1.78),(x,1.94,1.45),.025,'metal')
        mesh('greenhouse_roof',[(-.42,1.02,1.45),(1.32,1.02,1.45),(-.42,1.48,1.78),(1.32,1.48,1.78),(-.42,1.94,1.45),(1.32,1.94,1.45)],[(0,1,3,2),(2,3,5,4)],'glass')
        for x in (0,.8):
            cone('ceramic_pot',(x,1.6,.44),.14,.21,.27,'accent')
            soft_ball('greenhouse_plant',(x,1.6,.73),(.2,.2,.28),'leaf')
    bpy.context.view_layer.update()
    if level>3: houses.fit_legacy(f'house_lv{level}')
    finish_asset(f'house_{style}_lv{level}_{choice}',{'wall':'brick' if style=='townhouse' else 'wood','roof':'metal' if style=='modern' else 'shingle'})

def skeleton():
    bpy.ops.import_scene.gltf(filepath=str(OUT/'villager_base.glb'))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    for obj in list(bpy.context.scene.objects):
        if obj!=rig: bpy.data.objects.remove(obj,do_unlink=True)
    rig.animation_data_clear()
    for bone in rig.pose.bones: bone.matrix_basis.identity()
    for material in list(bpy.data.materials): bpy.data.materials.remove(material)
    return rig

def garment(name):
    reset(); hoodie=name=='shirt_hoodie'; rig=skeleton()
    material='shirt' if hoodie else 'jacket'
    PALETTE[material]='#AD6243' if hoodie else '#345D85'
    cone('torso',(0,0,.88),.27,.335,.50,material,12)
    for sign in (-1,1):
        obj=beam('sleeve',(sign*.34,0,1.06),(sign*.39,0,.64),.132,material)
        obj['bone']='Arm_L' if sign==1 else 'Arm_R'
        obj=cone('cuff',(sign*.39,0,.65),.123,.126,.065,material,12); obj['bone']='Arm_L' if sign==1 else 'Arm_R'
        for k in range(8):
            a=k*math.tau/8
            obj=beam('knit_rib',(sign*.39+.128*math.cos(a),.128*math.sin(a),.62),(sign*.39+.128*math.cos(a),.128*math.sin(a),.68),.004,'wall')
            obj['bone']='Arm_L' if sign==1 else 'Arm_R'
    if hoodie:
        ring('hood',(0,.09,1.13),.21,.075,material,20)
        soft_ball('hood_back',(0,.22,1.18),(.25,.13,.20),material)
        rounded(box('kangaroo_pocket',(0,-.272,.79),(.34,.06,.16),material),.025)
        for x in (-.16,.16): beam('pocket_opening',(x,-.311,.76),(x*.72,-.316,.86),.009,'accent')
        for x in (-.08,.08):
            beam('drawstring',(x,-.29,1.10),(x*1.2,-.32,.95),.009,'wall')
            beam('aglet',(x*1.2,-.32,.95),(x*1.2,-.32,.926),.011,'metal')
    else:
        for sign in (-1,1):
            mesh('collar',[(sign*.035,-.34,1.13),(sign*.25,-.21,1.13),(sign*.13,-.34,.97)],[(0,1,2)],material)
            rounded(box('chest_pocket',(sign*.15,-.285,.97),(.13,.045,.12),material),.01)
            beam('pocket_stitch',(sign*.15-.06,-.312,1.02),(sign*.15+.06,-.312,1.02),.003,'light')
            for z in (.68,.77,.86,.95,1.04):
                beam('seam',(sign*.06,-.31,z),(sign*.06,-.31,z+.045),.0025,'light')
        for z in (.71,.82,.93,1.04): disc('button',(0,-.329,z),.016,.009,'light')
        beam('hem_stitch',(-.2,-.22,.65),(.2,-.22,.65),.004,'light')
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH': continue
        obj.vertex_groups.new(name=obj.get('bone','Spine')).add(list(range(len(obj.data.vertices))),1,'REPLACE')
        obj.modifiers.new('Skeleton','ARMATURE').object=rig; obj.parent=rig
    finish_asset(name,{'wall':'fabric','accent':'fabric'})

def reward(name):
    reset(); PALETTE.update(primary='#314971',secondary='#DECBA4',accent='#CA6A32')
    if name=='perfect_week_halo':
        ring('halo',(0,0,.10),.38,.016,'gold',48)
        bsdf=mat('gold').node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Emission Color'].default_value=(1,.65,.12,1)
        bsdf.inputs['Emission Strength'].default_value=2
    elif name=='competition_laurels':
        for sign in (-1,1):
            for i in range(10):
                a=-math.pi/2+sign*(.3+i*.25)
                x,y=.34*math.cos(a),.34*math.sin(a)
                leaf=soft_ball('laurel_leaf',(x,y,.08+i*.003),(.065,.135,.022),'accent')
                leaf.rotation_euler.z=a-.7*sign
                beam('leaf_vein',(x-.035*math.sin(a),y+.035*math.cos(a),.104+i*.003),(x+.06*math.sin(a),y-.06*math.cos(a),.104+i*.003),.003,'gold')
        PALETTE['accent']='#587A39'
        bsdf=mat('accent').node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value=(.17,.32,.06,1)
        ring('stem',(0,0,.04),.30,.014,'gold',32)
    elif name in ('mayor_medal','auditor_badge'):
        if name=='mayor_medal':
            for sign in (-1,1):
                beam('ribbon',(sign*.17,0,.20),(sign*.055,-.24,-.10),.042,'primary')
            disc('gold_disc',(0,-.255,-.18),.115,.026,'gold')
            ring('medal_rim',(0,-.278,-.18),.095,.008,'gold',24,'Y')
            # Raised sun emblem, readable without text at thumbnail size.
            disc('sun',(0,-.28,-.18),.036,.012,'secondary')
            for i in range(8):
                a=i*math.tau/8
                beam('ray',(.05*math.cos(a),-.291,-.18+.05*math.sin(a)),(.073*math.cos(a),-.291,-.18+.073*math.sin(a)),.004,'secondary')
        else:
            rounded(box('badge_plate',(0,-.01,0),(.18,.025,.24),'gold'),.015)
            rounded(box('badge_enamel',(0,-.029,0),(.15,.01,.20),'accent'),.01)
            beam('check',(-.047,-.043,0),(-.013,-.043,-.04),.012,'secondary')
            beam('check',(-.013,-.043,-.04),(.055,-.043,.055),.012,'secondary')
            box('badge_clip',(0,0,.14),(.07,.045,.045),'metal')
    elif name=='champion_mantle':
        verts=[]
        for row in range(6):
            t=row/5
            for col in range(13):
                u=col/12; a=math.pi*.08+u*math.pi*.84
                r=.32+.12*t
                verts.append((math.cos(a)*r,math.sin(a)*r+.027*math.cos(u*math.tau*6)*t,.43-.83*t))
        mesh('pleated_cape',verts,[(r*13+c,r*13+c+1,(r+1)*13+c+1,(r+1)*13+c) for r in range(5) for c in range(12)],'primary')
        for sign in (-1,1):
            soft_ball('shoulder_drape',(sign*.24,0,.39),(.16,.16,.09),'primary')
            beam('clasp_chain',(sign*.22,-.13,.4),(0,-.29,.32),.012,'gold')
        disc('clasp',(0,-.3,.32),.045,.02,'gold')
        for i in range(12): beam('gold_hem',verts[65+i],verts[66+i],.012,'gold')
    else:
        PALETTE.update(primary='#853629',accent='#F28A32',secondary='#FFC857')
        ring('neck_wrap',(0,0,.16),.17,.055,'primary',20)
        rounded(box('scarf_tail',(.10,-.21,-.01),(.15,.055,.35),'primary'),.015)
        for i in range(5):
            x=.035+i*.033
            mesh('flame_trim',[(x-.024,-.245,-.10),(x+.022,-.245,-.10),(x+.025,-.245,-.18),(x+.01,-.245,-.16),(x+.005,-.245,-.26),(x-.011,-.245,-.20),(x-.025,-.245,-.21)],[(0,1,2,3,4,5,6)],'accent')
            mesh('flame_core',[(x-.012,-.248,-.10),(x+.012,-.248,-.10),(x+.002,-.248,-.20)],[(0,1,2)],'secondary')
        for z in (-.08,-.04,0,.04): beam('knit_rib',(.045,-.246,z),(.16,-.246,z),.003,'secondary')
    finish_asset(name,{'accent':'ceramic' if name=='auditor_badge' else 'fabric','secondary':'brass' if name=='mayor_medal' else 'fabric'})

def dog(name):
    reset(); corgi=name.endswith('_b')
    PALETTE.update(fur='#BB7842' if corgi else '#896049',wall='#EAD5AC',accent='#375F65')
    soft_ball('body',(0,.1,.34),(.28,.44,.24),'fur')
    for x in (-.19,.19):
        for y in (-.18,.36): rounded(box('paw',(x,y,.09),(.16,.20,.18),'wall'),.04)
    soft_ball('chest',(0,-.19,.37),(.24,.14,.23),'wall')
    soft_ball('head',(0,-.34,.62),(.28,.25,.26),'fur')
    for sign in (-1,1):
        if corgi:
            ear=soft_ball('ear',(sign*.20,-.29,.89),(.10,.085,.23),'fur'); ear.rotation_euler.y=sign*.28
            soft_ball('inner_ear',(sign*.20,-.362,.9),(.05,.023,.14),'blossom')
        else:
            ear=soft_ball('floppy_ear',(sign*.25,-.3,.59),(.10,.13,.23),'fur'); ear.rotation_euler.y=sign*.3
        soft_ball('eye',(sign*.11,-.559,.68),(.053,.03,.066),'dark')
        soft_ball('eye_glint',(sign*.11-.014,-.588,.702),(.013,.008,.015),'wall')
        soft_ball('eyebrow',(sign*.12,-.544,.764),(.058,.025,.02),'wall')
        for i in range(2): cone('cheek_tuft',(sign*(.23+i*.025),-.3,.48+i*.08),.075,0,.15,'fur',5)
    soft_ball('muzzle',(0,-.56,.55),(.15,.12,.09),'wall')
    soft_ball('nose',(0,-.667,.579),(.06,.028,.037),'dark')
    soft_ball('tongue',(.026,-.635,.485),(.035,.025,.05),'blossom')
    beam('tail',(0,.44,.37),(.12,.65,.57),.065,'fur')
    beam('tail_tip',(.12,.65,.57),(.24,.64,.66),.045,'wall')
    ring('collar',(0,-.20,.48),.20,.027,'accent',16)
    disc('collar_tag',(0,-.42,.40),.034,.014,'light')
    finish_asset(name,{'wall':'fabric','accent':'leather','fur':'fabric'})

if __name__=='__main__':
    only=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--only=')),None)
    if only:
        assert only in REWARDS
        reward(only);sys.exit(0)
    if '--shop-only' not in sys.argv:
        for name,(style,lv,palette) in houses.MODELS.items():
            if '--resume' in sys.argv: continue
            reset(); bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
            PALETTE.update(houses.PALETTES[style][palette])
            finish_asset(name,{'wall':'brick' if style=='townhouse' else 'wood','roof':'metal' if style=='modern' else 'shingle'})
        for style in houses.STYLES:
            for level,choices in VARIANTS.items():
                for choice in choices:
                    if '--resume' in sys.argv and (OUT/f'house_{style}_lv{level}_{choice}.glb').exists(): continue
                    variant(style,level,choice)
    if '--houses-only' not in sys.argv:
        for name in ('shirt_hoodie','jacket_denim'): garment(name)
        for name in REWARDS: reward(name)
        for name in ('pet_dog','pet_dog_b'): dog(name)
        for name in ('bench','fence','house_backyard','lantern','fountain','flowers_a','hat_cowboy','hat_headphones','glasses_round'):
            reset(); bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
            finish_asset(name,{'wood':'leather'} if name=='hat_cowboy' else None)
