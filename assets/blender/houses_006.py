"""Deterministic four-sided houses. Run after older kit generators."""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *
from village_kit import roof
sys.path.insert(0, str(ROOT/'assets'))
from house_spec_006 import *

BASELINE = json.loads((ROOT/'assets/house_baseline_006.json').read_text())

def panel(name, side, u, z, w, h, material, depth=.045, out=.035):
    # Tangent u, outward normal, surface positioned on all four walls.
    if name.endswith(('_mortar','_brick_joint')):
        if side in ('front','back'):
            y=(-1 if side=='front' else 1)*(1+out)
            verts=[(u-w/2,y,z-h/2),(u+w/2,y,z-h/2),(u+w/2,y,z+h/2),(u-w/2,y,z+h/2)]
        else:
            x=(-1 if side=='left' else 1)*(1.3+out)
            verts=[(x,u-w/2,z-h/2),(x,u+w/2,z-h/2),(x,u+w/2,z+h/2),(x,u-w/2,z+h/2)]
        return mesh(name,verts,[(0,1,2,3)],material)
    if side in ('front','back'):
        return box(name, (u, (-1 if side=='front' else 1)*(1.0+out), z), (w,depth,h), material)
    return box(name, ((-1 if side=='left' else 1)*(1.30+out),u,z), (depth,w,h), material)

def window(side,u,z,style,w=.53):
    before=set(bpy.context.scene.objects)
    panel(side+'_window_frame',side,u,z,w+.12,.68,'trim')
    panel(side+'_window_glass',side,u,z,w,.54,'glass',out=.065)
    panel(side+'_window_mullion',side,u,z,.035,.54,'trim',out=.095)
    panel(side+'_window_sill',side,u,z-.36,w+.18,.06,'accent',out=.09)
    if style=='aframe' and side in ('left','right'):
        for obj in set(bpy.context.scene.objects)-before:
            obj.location.x+=(-.15 if side=='left' else .15)
    if style=='beach':
        for dx in (-w/2-.13,w/2+.13):
            panel(side+'_shutter',side,u+dx,z,.16,.66,'accent',out=.06)
            for dz in (-.2,0,.2): panel(side+'_shutter_slat',side,u+dx,z+dz,.15,.03,'trim',out=.09)

def build(style,lv):
    base=.52 if style=='beach' else .22
    h=1.50+(lv-1)*.66
    top=base+h
    box('foundation',(0,0,.075),(2.85,2.25,.15),'stone')
    if style=='beach':
        for x in (-1.17,0,1.17):
            for y in (-.86,.86): box('stilt',(x,y,.31),(.13,.13,.62),'wood')
    box('walls',(0,0,base+h/2),(2.6,2,h),'wall')
    box('floor_trim',(0,0,base),(2.68,2.08,.10),'trim')
    if style=='modern':
        box('flat_roof',(0,0,top+.08),(2.95,2.3,.16),'roof')
        for x in (-1.43,1.43): box('parapet',(x,0,top+.23),(.09,2.3,.20),'trim')
        box('roof_terrace',(0,.78,top+.24),(2.8,.08,.24),'accent')
        for x in (-.65,.25): box('solar_panel',(x,-.15,top+.20),(.72,1.1,.08),'glass')
    elif style=='aframe':
        ridge=top+1.0
        mesh('a_frame_gables',[(-1.6,-1,.55),(1.6,-1,.55),(0,-1,ridge),(-1.6,1,.55),(1.6,1,.55),(0,1,ridge)],[(0,2,1),(3,4,5)],'wall')
        for sign in (-1,1):
            mesh('steep_roof',[(0,-1.17,ridge),(0,1.17,ridge),(sign*1.6,1.17,.55),(sign*1.6,-1.17,.55)],[(0,1,2,3)],'roof')
            for y in (-1.19,1.19): beam('a_frame_edge',(0,y,ridge),(sign*1.6,y,.55),.055,'trim')
        # Narrow the opaque core under the roof; side windows become roof dormers.
        bpy.data.objects['walls'].scale.x=.39
        bpy.data.objects['walls'].scale.z=.7
        bpy.data.objects['walls'].location.z=base+h*.35
        for side,sign in (('left',-1),('right',1)):
            box(side+'_dormer',(sign*1.26,0,base+.85),(.40,.9,.85),'wall')
            box(side+'_dormer_cap',(sign*1.23,0,base+1.30),(.7,1.02,.10),'roof')
    else:
        roof(top,3.15,2.38,.9 if style in ('cottage','tudor') else .45)
        if style=='cottage':
            for sign in (-1,1):
                for i in range(1,6):
                    x=sign*i*.255
                    beam('thatch_course',(x,-1.20,top+.9-abs(x)*.9/1.575+.025),(x,1.20,top+.9-abs(x)*.9/1.575+.025),.045,'roof')
            for y in (-.8,0,.8): ball('ridge_bundle',(0,y,top+.91),(.13,.43,.10),'roof')
        if style=='townhouse':
            for y in (-1.07,1.07):
                for i in range(4): box('stepped_gable',(0,y,top+.12+i*.14),(2.85-i*.65,.12,.16),'wall')
    for side in ('front','back','left','right'):
        us=(-.87,.87) if side in ('front','back') else (-.48,.48)
        if style=='aframe' and side in ('left','right'): us=(0,)
        for u in us: window(side,u,base+.85,style,.62 if style=='modern' else .46)
        if lv>=2 and style!='aframe':
            for u in us: window(side,u,base+1.62,style,.46)
        if lv==3 and style!='aframe':
            for u in us: panel(side+'_upper_lintel',side,u,top-.13,.65,.08,'accent')
        if style=='tudor':
            for u in (-1.20,0,1.20) if side in ('front','back') else (-.92,.92):
                panel(side+'_timber',side,u,base+h/2,.08,h,'trim',out=.09)
            panel(side+'_timber_band',side,0,top-.07,2.6 if side in ('front','back') else 2,.10,'trim',out=.08)
        if style=='townhouse':
            for row in range(int(h/.19)):
                z=base+.1+row*.19
                panel(side+'_mortar',side,0,z,2.58 if side in ('front','back') else 1.98,.012,'trim',out=.024)
                for u in (-1.0,-.5,0,.5,1) if side in ('front','back') else (-.75,-.25,.25,.75):
                    panel(side+'_brick_joint',side,u+(.12 if row%2 else 0),z+.09,.014,.17,'trim',out=.024)
    for side,sign in (('front',-1),('back',1)):
        panel(side+'_door_frame',side,0,base+.56,.62,1.2,'trim',out=.06)
        panel(side+'_door',side,0,base+.54,.49,1.07,'door',out=.09)
        panel(side+'_door_panel',side,0,base+.75,.33,.27,'accent',out=.12)
        ball(side+'_door_knob',(.16,sign*1.15,base+.55),(.035,.025,.035),'light')
        box(side+'_deck',(0,sign*1.24,base-.055),(1.18,.44,.11),'wood')
        for i in range(2): box(side+'_step',(0,sign*(1.48+i*.13),base*(.65-i*.26)),(.7,.14,base*.26),'stone')
        for x in (-.51,.51):
            box(side+'_porch_post',(x,sign*1.38,base+.6),(.055,.055,1.2),'trim')
        box(side+'_porch_canopy',(0,sign*1.22,base+1.23),(1.23,.65,.08),'roof')
    box('back_garden_bed',(-.99,1.30,.25),(.66,.45,.24),'wood')
    box('back_garden_soil',(-.99,1.30,.38),(.59,.38,.04),'soil')
    for x in (-1.18,-.99,-.80):
        ball('back_plant',(x,1.30,.5),(.12,.12,.16),'leaf')
        ball('back_flower',(x,1.30,.63),(.07,.07,.07),'blossom')
    box('back_ac_unit',(.98,1.25,.42),(.49,.36,.44),'metal')
    for z in (.29,.38,.47,.56): box('back_ac_grille',(.98,1.44,z),(.39,.02,.027),'stone')
    drain_top=.55+(top+1-.55)*(1-1.26/1.6) if style=='aframe' else top
    beam('back_downspout',(1.26,1.12,drain_top),(1.26,1.12,.21),.04,'metal')
    beam('back_downspout_elbow',(1.26,1.12,.21),(1.26,1.4,.13),.04,'metal')
    if style in ('aframe','cottage','tudor'):
        x=(-.6 if lv%2 else .6)
        box('chimney',(x,.4,top+.67),(.25,.3,.9),'stone')
        box('chimney_cap',(x,.4,top+1.14),(.33,.38,.09),'trim')
    else:
        cone('roof_vent',(.65 if lv%2 else -.65,.35,top+.7),.12,.12,.42,'metal')
        cone('vent_cap',(.65 if lv%2 else -.65,.35,top+.93),.20,.07,.12,'roof')

def fit_legacy(name):
    old=BASELINE[name]
    low=(old['min'][0],-old['max'][2],old['min'][1])
    high=(old['max'][0],-old['min'][2],old['max'][1])
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    pts=[o.matrix_world@Vector(v) for o in objs for v in o.bound_box]
    lo=[min(p[i] for p in pts) for i in range(3)]
    hi=[max(p[i] for p in pts) for i in range(3)]
    for obj in objs:
        for v in obj.data.vertices:
            p=obj.matrix_world@v.co
            v.co=[low[i]+(p[i]-lo[i])*(high[i]-low[i])/(hi[i]-lo[i]) for i in range(3)]
        obj.matrix_world.identity()

if __name__=='__main__':
    for name,(style,lv,palette) in MODELS.items():
        if '--townhouse-only' in sys.argv and style!='townhouse': continue
        if '--aframe-only' in sys.argv and style!='aframe': continue
        reset()
        PALETTE.update(PALETTES[style][palette])
        build(style,lv)
        if name in LEGACY: fit_legacy(name)
        export(name)
