"""Deterministic original patio; glTF metres match scene/layout/cafeSeats.ts."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *
from mathutils import Matrix
from materials_008 import apply, export_materials

reset()
PALETTE.update(sage='#8EAA91', cream='#FFF5E6', copper='#B47750', chalk='#293F38',
               patio_bulb='#FFE8B5', flower='#E9A9B1')
def cube(n,p,s,m): return box(n,(p[0],-p[2],p[1]),(s[0],s[2],s[1]),m)
def orb(n,p,s,m): return ball(n,(p[0],-p[2],p[1]),(s[0],s[2],s[1]),m)
def rod(n,a,b,r,m):
    a,b=Vector((a[0],-a[2],a[1])),Vector((b[0],-b[2],b[1]))
    obj=cone(n,(a+b)/2,r,r,(b-a).length,m,5)
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj
def cyl(n,p,r,h,m,v=12): return cone(n,(p[0],-p[2],p[1]),r,r,h,m,v)
def ring(n,p,r,t,m):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=10,minor_segments=3,location=(p[0],-p[2],p[1]),rotation=(math.pi/2,0,0))
    return finish(bpy.context.object,n,m)

cube('patio_pavers',(0,.025,0),(9.5,.05,3.7),'stone')
for i,x in enumerate([-3,0,3]):
    cyl(f'table_{i}',(x,1.45,0),.62,.10,'cream',20)
    cyl('table_pedestal',(x,.73,0),.07,1.40,'copper')
    for dx,dz in [(-.4,0),(.4,0),(0,-.4),(0,.4)]: rod('table_foot',(x,.17,0),(x+dx,.08,dz),.045,'copper')
    for j,z in enumerate([-1,1]):
        cube(f'chair_{i}_{j}',(x,.85,z),(.7,.12,.65),'sage')
        for dx in [-.27,.27]:
            for dz in [-.24,.24]: rod('chair_leg',(x+dx,.05,z+dz),(x+dx,.83,z+dz),.035,'copper')
        for dx in [-.28,.28]: rod('chair_back_post',(x+dx,.82,z+z*.29),(x+dx,1.55,z+z*.29),.03,'copper')
        for y in [1.15,1.42]: cube('chair_back_slat',(x,y,z+z*.29),(.7,.13,.07),'sage')
    cyl(f'parasol_post_{i}',(x,1.7,0),.035,3.35,'copper')
    # Alternating radial fabric panels with a shallow draped scallop at the rim.
    for k in range(12):
        a=k*math.tau/12;b=(k+1)*math.tau/12
        verts=[(x,0,3.45),(x+1.3*math.cos(a),-1.3*math.sin(a),2.95),(x+1.3*math.cos(b),-1.3*math.sin(b),2.95),
               (x+1.3*math.cos(a),-1.3*math.sin(a),2.8),(x+1.3*math.cos(b),-1.3*math.sin(b),2.8)]
        mesh(f'parasol_{i}_stripe_{k}',verts,[(0,1,2),(1,3,4,2)],'sage' if k%2 else 'cream')
    for dx,dz in [(-.28,.22),(.27,-.2)]:
        cyl('coffee_cup',(x+dx,1.60,dz),.09,.19,'cream')
        cyl('coffee',(x+dx,1.699,dz),.075,.006,'wood')
        ring('cup_handle',(x+dx+.105,1.60,dz),.045,.014,'cream')
    cyl('pastry_plate',(x+.25,1.52,.28),.19,.024,'cream')
    orb('croissant',(x+.25,1.57,.28),(.14,.055,.07),'hay')

for side in [-1,1]:
    x=side*4.5
    cube('planter_soil',(x,.31,0),(.4,.48,3.35),'soil')
    for dx in [-.24,.24]:
        for y in [.17,.38,.59]: cube('planter_wood',(x+dx,y,0),(.07,.18,3.5),'wood')
    for z in [-1.72,1.72]: cube('planter_end',(x,.35,z),(.55,.65,.07),'wood')
    for i,z in enumerate([-1.4,-.95,-.5,0,.5,.95,1.4]):
        for dx in [-.12,.12]:
            rod('herb_stem',(x,.5,z),(x+dx,.95,z),.016,'leaf')
            orb('herb_leaf',(x+dx,.76,z),(.14,.14,.12),'leaf')
        if i%2: orb('flower',(x,.98,z),(.13,.09,.13),'flower')

# A-frame chalkboard faces the approaching sidewalk.
for z in [1.05,1.6]:
    for x in [-1.55,-.85]: rod('menu_leg',(x,.05,z),(x,1.3,1.3),.035,'wood')
cube('menu_frame',(-1.2,.91,1.5),(.87,.97,.08),'wood')
cube('menu_chalkboard',(-1.2,.91,1.55),(.73,.83,.025),'chalk')
for label,y,size in [('CAFE',1.16,.18),('COFFEE',.93,.11),('PASTRIES',.76,.10),('~ ~ ~',.57,.10)]:
    bpy.ops.object.text_add(location=(-1.2,-1.569,y),rotation=(math.pi/2,0,0))
    obj=bpy.context.object;obj.name='menu_'+label;obj.data.body=label;obj.data.size=size;obj.data.resolution_u=1;obj.data.align_x='CENTER';obj.data.materials.append(mat('cream'));bpy.ops.object.convert(target='MESH')

for x in [-4.4,0,4.4]: cyl('string_post',(x,1.9,-1.65),.045,3.8,'copper')
for i in range(17):
    x=-4.4+i*.55;y=3.55-.25*math.sin((i%8)/8*math.pi)
    orb(f'bulb_{i}',(x,y-.1,-1.65),(.07,.09,.07),'patio_bulb')
    rod('bulb_socket',(x,y,-1.65),(x,y-.06,-1.65),.025,'metal')
    if i:
        py=3.55-.25*math.sin(((i-1)%8)/8*math.pi)
        rod('light_cable',(x-.55,py,-1.65),(x,y,-1.65),.012,'metal')

# Bicycle lies parallel to the right planter, with a slight lean toward it.
before=set(bpy.context.scene.objects)
for z in [-.72,.72]:
    wheel=ring('bike_wheel',(4.04,.43,z),.39,.035,'metal');wheel.rotation_euler.z=math.pi/2
    for k in range(8):
        a=k*math.tau/8;rod('bike_spoke',(4.04,.43,z),(4.04,.43+.37*math.sin(a),z+.37*math.cos(a)),.008,'copper')
for a,b in [((.43,-.72),(.48,0)),((.48,0),(.98,-.27)),((.98,-.27),(.43,-.72)),((.98,-.27),(1,.5)),((1,.5),(.48,0)),((1,.5),(.43,.72))]:
    rod('bike_frame',(4.04,*a),(4.04,*b),.025,'sage')
cube('bike_saddle',(4.04,1.07,-.3),(.23,.08,.30),'wood')
rod('bike_handle_stem',(4.04,1,.5),(4.04,1.22,.5),.025,'copper')
rod('bike_handlebar',(3.82,1.22,.5),(4.25,1.22,.5),.025,'copper')
rod('bike_crank',(3.93,.48,0),(4.18,.48,0),.02,'metal')
for obj in set(bpy.context.scene.objects)-before:
    # Lean top towards planter without moving the ground contact.
    obj.matrix_world = Matrix(((1,0,.07,0),(0,1,0,0),(0,0,1,0),(0,0,0,1))) @ obj.matrix_world

apply({'sage':'fabric','cream':'ceramic','copper':'metal','chalk':'stone','patio_bulb':'ceramic','leaf':'fabric','flower':'fabric','hay':'fabric','soil':'stone'})
bsdf=mat('patio_bulb').node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Emission Color'].default_value=(1,.65,.25,1);bsdf.inputs['Emission Strength'].default_value=3
export_materials('cafe_patio')
print('ASSET-012 exported cafe_patio.glb')
