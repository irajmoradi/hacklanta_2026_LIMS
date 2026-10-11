"""ASSET-010: deterministic, shared-material sandstone arena. Blender 5.x."""
import sys, random
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *

reset()
rng = random.Random(10)
PALETTE.update(stone='#AD9275', wall='#DBC39D', worn='#EBD8B7', mortar='#B39A7A', sand_line='#B7A17E')

def empty(name,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;return o

def polar(r,a,z): return (r*math.sin(a),-r*math.cos(a),z)

def radial_box(name,r,a,z,size,material):
    o=box(name,polar(r,a,z),size,material);o.rotation_euler.z=a;return o

def sector(name,ri,ro,a,b,z,h,material,segments=4):
    verts=[]
    for height in (z,z+h):
        for radius in (ri,ro):
            verts.extend(polar(radius,a+(b-a)*i/segments,height) for i in range(segments+1))
    n=segments+1;faces=[]
    for i in range(segments):
        faces.extend([(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),(i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)])
    faces.extend([(0,n,3*n,2*n),(n-1,3*n-1,4*n-1,2*n-1)])
    return mesh(name,verts,faces,material)

def arch(name,r,a,z,inner,outer,depth):
    # Wedge voussoirs follow a true semicircle, not a faceted stack of cubes.
    for j in range(9):
        t0=j*math.pi/9+.014;t1=(j+1)*math.pi/9-.014
        verts=[]
        for y in (-depth/2,depth/2):
            for radius,t in ((inner,t0),(outer,t0),(outer,t1),(inner,t1)):
                x=radius*math.cos(t)
                verts.append((r*math.sin(a)+x*math.cos(a)-y*math.sin(a),-r*math.cos(a)+x*math.sin(a)+y*math.cos(a),z+radius*math.sin(t)))
        mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'worn' if j==4 else 'wall')

def cloth(name,r,a,z,width,height,material):
    # Origin at top edge; local Z down maps to glTF -Y for runtime unfurl.
    verts=[];faces=[]
    for row in range(7):
        for col in range(5):
            verts.append(((col/4-.5)*width,.065*math.sin(col*1.5+row*.7)*row/6,-row/6*height))
    for row in range(6):
        for col in range(4):
            i=row*5+col;faces.append((i,i+1,i+6,i+5))
    o=mesh(name,verts,faces,material);o.location=polar(r,a,z);o.rotation_euler.z=a
    mat(material).use_backface_culling=False
    return o

cone('sand_floor',(0,0,.08),10,10,.16,'path',96)
# Open frontage keeps the small original footprint and the participants readable.
start,end=math.radians(26),math.radians(334)
for tier in range(5):
    for bay in range(14):
        a=start+(end-start)*bay/14+.027;b=start+(end-start)*(bay+1)/14-.027
        sector(f'stand_{tier}_{bay}',7.0+tier*.52,7.58+tier*.52,a,b,.16,.38+tier*.43,'wall' if tier%2 else 'stone')
        sector('seat_lip',7+tier*.52,7.63+tier*.52,a,b,.52+tier*.43,.065,'worn')
for aisle in range(15):
    a=start+(end-start)*aisle/14
    for step in range(10):
        radial_box('aisle_step',7.05+step*.26,a,.16+(step+1)*.107,(.42,.29,(step+1)*.214),'mortar')
# Two complete tiers of arcades, engaged pilasters and continuous mouldings.
for tier in range(2):
    base=.16+tier*2.5
    for i in range(21):
        a=start+(end-start)*i/20
        radial_box('arch_pillar',10,a,base+1.02,(.43,.65,2.04),'stone')
        radial_box('pilaster',10.39,a,base+1,(.28,.22,2),'wall')
        for z in (base+.13,base+1.75):
            radial_box('capital',10.38,a,z,(.64,.4,.19),'worn')
        if i<20:
            mid=a+(end-start)/40
            arch('arcade_voussoir',10,mid,base+1.53,.96,1.18,.66)
            if tier==1 and i%3==1:
                cloth(f'banner_{i}',9.56,mid,4.65,.8,1.65,'accent' if i%2 else 'roof')
    for z,h,ri,ro in ((base,.16,9.64,10.53),(base+2.4,.16,9.6,10.57),(base+2.58,.12,9.68,10.48)):
        sector('cornice',ri,ro,start-.025,end+.025,z,h,'worn',64)
# A shallow parapet with alternating stone blocks.
for i in range(70):
    a=start+(end-start)*i/70;b=start+(end-start)*(i+1)/70-.009
    sector('parapet',9.74,10.35,a,b,5.38,.32,'wall' if i%3 else 'stone',1)
# Gate remains at original +Z=9.6 after export. All bars parented to one lift pivot.
for x in (-2.25,2.25):
    box('gate_pier',(x,-9.6,1.95),(.8,1.05,3.9),'stone')
    box('gate_cap',(x,-9.6,4), (1.06,1.25,.25),'worn')
arch('entry_arch',9.6,0,2.3,1.85,2.18,.95)
box('entry_lintel',(0,-9.6,4.65),(5.3,1.1,.3),'worn')
gate=empty('gate')
for i in range(11):
    o=box(f'gate_bar_{i}',(-1.75+i*.35,-9.6,1.78),(.07,.1,3.24),'metal');o.parent=gate
for z in (.5,1.5,2.7,3.36):
    o=box('gate_crossbar',(0,-9.6,z),(3.7,.13,.08),'metal');o.parent=gate
for x in (-2.25,2.25):
    o=cloth('banner_gate',9.0,0,3.8,.5,1.5,'accent');o.location.x=x
# Numbered podium coordinates match arenaPosition exactly.
for rank,x,h in ((1,0,1.05),(2,-2,.7),(3,2,.4)):
    box(f'podium_{rank}',(x,0,h/2+.16),(1.8,1.8,h),'accent' if rank==1 else 'wall')
    box('podium_rim',(x,0,h+.17),(1.85,1.85,.045),'worn')
    bpy.ops.object.text_add(location=(x,-.912,.24),rotation=(math.pi/2,0,0))
    o=bpy.context.object;o.name=f'place_{rank}';o.data.body=str(rank);o.data.align_x='CENTER';o.data.size=.52;o.data.resolution_u=2;o.data.materials.append(mat('metal'));bpy.ops.object.convert(target='MESH')
# Rear VIP loggia and cloth canopy.
box('vip_dais',(0,8.2,2.8),(3.7,2,.3),'worn')
for x in (-1.7,1.7):
    for y in (7.4,9):beam('vip_post',(x,y,2.8),(x,y,5.8),.065,'metal')
for stripe in range(8):
    x=-1.9+stripe*.475
    mesh('vip_canopy',[(x,7.1,5.5),(x+.475,7.1,5.5),(x+.475,8.2,5.95),(x,8.2,5.95),(x,9.3,5.5),(x+.475,9.3,5.5)],[(0,1,2,3),(3,2,5,4)],'accent' if stripe%2 else 'worn')
cloth('banner_vip',7.2,math.pi,3.3,2.8,.7,'roof')
for x in (-.9,0,.9):
    box('vip_chair',(x,8.25,3.2),(.58,.58,.45),'wood');box('vip_back',(x,8.5,3.65),(.58,.1,.6),'roof')
# Swaying flags, catenary light strings.
for i in range(7):
    a=start+(end-start)*i/6
    p=polar(10.15,a,5.55);q=polar(10.15,a,7.05)
    beam('flagpole',p,q,.035,'metal');cloth(f'flag_{i}',10.15,a,7,.95,.6,'accent' if i%2 else 'roof')
for half in (-1,1):
    points=[(half*(3+5.9*i/16),-5.4+9*i/16,5.7-.9*math.sin(math.pi*i/16)) for i in range(17)]
    for i in range(16):beam('light_wire',points[i],points[i+1],.013,'metal')
    for p in points:ball('string_bulb',p,(.07,.07,.095),'light')
# Four emissive braziers retain legacy torch_flame anchor.
for i,(x,y) in enumerate(((-3,-8),(3,-8),(-6,4),(6,4))):
    cone('brazier_foot',(x,y,.22),.35,.23,.12,'stone')
    cone('brazier_stem',(x,y,.85),.12,.17,1.25,'metal')
    cone('brazier_bowl',(x,y,1.5),.2,.48,.3,'metal')
    o=cone('torch_flame' if i==0 else f'flicker_{i}',(x,y,1.95),.28,0,.8,'fire',7)
for name,strength in (('fire',2.8),('light',2)):
    bsdf=mat(name).node_tree.nodes.get('Principled BSDF');bsdf.inputs['Emission Color'].default_value=mat(name).diffuse_color;bsdf.inputs['Emission Strength'].default_value=strength
# Sparse sand rake arcs leave the participant anchors clear.
for r in (3.2,3.35,3.5,4.5,4.65,4.8,5.8,5.95,6.1):
    mesh('rake_mark',[polar(radius,.3+5.6*i/48,.166) for radius in (r,r+.018) for i in range(49)],[(i,i+1,i+50,i+49) for i in range(48)],'sand_line')
# Training corner, shields, weapon rack and strapped hay bales.
for x in (-5.8,-4.2):beam('rack_post',(x,1.9,.16),(x,1.9,1.75),.07,'wood')
beam('rack_crossbar',(-5.8,1.9,1.4),(-4.2,1.9,1.4),.08,'wood')
for x in (-5.5,-5,-4.5):
    beam('practice_spear',(x,1.65,.2),(x,1.9,2.2),.025,'wood');cone('spear_tip',(x,1.9,2.3),.09,0,.25,'metal',4)
for x in (-5.7,-4.3):
    o=cone('shield',(x,1.55,.65),.4,.4,.08,'accent' if x<-5 else 'roof',12);o.rotation_euler.x=math.pi/2
    ball('shield_boss',(x,1.49,.65),(.12,.08,.12),'metal')
beam('dummy_pole',(5,1.5,.16),(5,1.5,1.9),.09,'wood')
beam('dummy_arms',(4.4,1.5,1.25),(5.6,1.5,1.25),.1,'hay')
cone('dummy_body',(5,1.5,1.1),.26,.22,.65,'hay');ball('dummy_head',(5,1.5,1.75),(.23,.23,.25),'hay')
for x,y,z in ((5.5,3,.45),(6.1,2.8,.45),(5.7,3,.98)):
    box('hay_bale',(x,y,z),(.8,.58,.52),'hay')
    for dx in (-.23,.23):box('bale_strap',(x+dx,y,z),(.035,.595,.535),'wood')
# Shared silhouette geometry + palette; instanced and idle-bobbed in the browser.
verts=[(-.18,0,0),(.18,0,0),(.22,0,.33),(.1,0,.43),(.13,0,.57),(.07,0,.68),(-.07,0,.68),(-.13,0,.57),(-.1,0,.43),(-.22,0,.33)]
prototype=mesh('crowd_0',verts,[tuple(range(10))],'roof')
for i in range(105):
    o=prototype if i==0 else bpy.data.objects.new(f'crowd_{i}',prototype.data)
    if i:bpy.context.collection.objects.link(o)
    tier=i%3+1;bay=(i//3)%14;seat=(i//3)//14;a=start+(end-start)*(bay+.2+seat*.3)/14
    o.location=polar(7.1+tier*.52,a,.56+tier*.43);o.rotation_euler.z=a;o.scale=(.85+rng.random()*.35,1,.85+rng.random()*.3)
empty('confetti_emitter',(0,0,4.7))
# Subtle per-face weathering survives GLB and material batching as COLOR_0.
for o in list(bpy.context.scene.objects):
    if o.type!='MESH' or not o.data.materials or o.data.materials[0].name not in ('wall','stone','worn','mortar'):continue
    attr=o.data.color_attributes.new(name='weathering',type='FLOAT_COLOR',domain='CORNER')
    for poly in o.data.polygons:
        v=rng.uniform(.84,1)
        for idx in poly.loop_indices:attr.data[idx].color=(v,v*.99,v*.96,1)
    # Bevel just larger podium/pier boxes: worn corners without ballooning arches.
    if o.name.startswith(('gate_pier','podium_')):
        bevel=o.modifiers.new('worn edges','BEVEL');bevel.width=.045;bevel.segments=1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
# Retain animation anchors; merge static architecture by material at export.
keep=('stand_','crowd_','banner_','flag_','gate_bar','gate_crossbar','podium_','sand_floor','entry_lintel','torch_flame','flicker_')
groups={}
for o in list(bpy.context.scene.objects):
    if o.type=='MESH' and not o.name.startswith(keep):groups.setdefault(o.data.materials[0].name,[]).append(o)
for material,objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='architecture_'+material
from materials_008 import apply, export_materials
apply({'wall':'stone','worn':'stone','mortar':'stone','accent':'fabric'})
export_materials('colosseum')
