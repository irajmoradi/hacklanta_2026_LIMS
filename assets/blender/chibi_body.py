"""Rigid-weighted low-poly fallback avatar with four baked skeletal clips."""
import sys
from pathlib import Path
import math
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *

def build():
    reset()
    parts = []
    def part(obj, bone):
        parts.append((obj,bone))
    part(cone('torso',(0,0,.88),.24,.3,.48,'shirt'), 'Spine')
    part(box('hips',(0,0,.59),(.39,.28,.18),'pants'), 'Root')
    for side,x in [('L',.14),('R',-.14)]:
        part(box('leg_'+side,(x,0,.34),(.18,.22,.42),'pants'),'Leg_'+side)
        part(box('shoe_'+side,(x,-.06,.09),(.22,.36,.18),'shoes'),'Leg_'+side)
        x = .37 if side=='L' else -.37
        part(cone('sleeve_'+side,(x,0,.98),.105,.12,.24,'shirt'),'Arm_'+side)
        part(cone('forearm_'+side,(x,0,.78),.075,.085,.22,'skin'),'Arm_'+side)
        part(ball('hand_'+side,(x,0,.64),(.095,.09,.105),'skin'),'Arm_'+side)
    part(cone('neck',(0,0,1.17),.09,.09,.15,'skin'),'Head')
    part(ball('head',(0,-.015,1.46),(.35,.3,.36),'skin'),'Head')
    part(ball('hair_cap',(0,.025,1.66),(.355,.29,.2),'hair'),'Head')
    for x in (-.13,.13):
        part(ball('eye',(x,-.277,1.48),(.028,.02,.038),'hair'),'Head')
    part(ball('nose',(0,-.30,1.40),(.055,.055,.055),'skin'),'Head')
    bpy.ops.object.armature_add(location=(0,0,0))
    rig=bpy.context.object
    rig.name='VillagerRig'
    bpy.ops.object.mode_set(mode='EDIT')
    rig.data.edit_bones.remove(rig.data.edit_bones[0])
    specs=[('Root',(0,0,.52),(0,0,.7),None),
           ('Spine',(0,0,.7),(0,0,1.13),'Root'),
           ('Head',(0,0,1.13),(0,0,1.7),'Spine'),
           ('Arm_L',(.37,0,1.08),(.37,0,.65),'Spine'),
           ('Arm_R',(-.37,0,1.08),(-.37,0,.65),'Spine'),
           ('Leg_L',(.14,0,.55),(.14,0,.12),'Root'),
           ('Leg_R',(-.14,0,.55),(-.14,0,.12),'Root')]
    for name,head,tail,parent in specs:
        bone=rig.data.edit_bones.new(name)
        bone.head=head
        bone.tail=tail
        if parent:
            bone.parent=rig.data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for obj,bone in parts:
        group=obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
        modifier=obj.modifiers.new('Skeleton','ARMATURE')
        modifier.object=rig
        obj.parent=rig
    scene=bpy.context.scene
    scene.render.fps=24
    scene.frame_start=1
    scene.frame_end=49
    rig.animation_data_create()
    for clip in ('idle','walk','wave','cheer'):
        action=bpy.data.actions.new(clip)
        action.use_fake_user=True
        rig.animation_data.action=action
        for f in range(1,50):
            t=(f-1)/48*math.tau
            for bone in rig.pose.bones:
                bone.rotation_mode='XYZ'
                bone.rotation_euler=(0,0,0)
                bone.location=(0,0,0)
            rig.pose.bones['Root'].location.y=.012*(1-math.cos(t))
            rig.pose.bones['Head'].rotation_euler.y=.035*math.sin(t)
            if clip=='walk':
                for side,sign in [('L',1),('R',-1)]:
                    rig.pose.bones['Leg_'+side].rotation_euler.x=.48*sign*math.sin(t*2)
                    rig.pose.bones['Arm_'+side].rotation_euler.x=-.35*sign*math.sin(t*2)
                rig.pose.bones['Root'].location.y=.035*(1-math.cos(t*4))
            elif clip=='wave':
                rig.pose.bones['Arm_L'].rotation_euler.z=-2.25+.23*math.sin(t*3)
            elif clip=='cheer':
                rig.pose.bones['Arm_L'].rotation_euler.z=-2.45+.12*math.sin(t*2)
                rig.pose.bones['Arm_R'].rotation_euler.z=2.45-.12*math.sin(t*2)
                rig.pose.bones['Root'].location.y=.1*(1-math.cos(t*2))
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_euler',frame=f,group=bone.name)
                bone.keyframe_insert('location',frame=f,group=bone.name)
    rig.animation_data.action=None
    for bone in rig.pose.bones:
        bone.rotation_euler=(0,0,0)
        bone.location=(0,0,0)
    scene.frame_set(1)
    export('villager_base')

if __name__ == '__main__':
    build()
