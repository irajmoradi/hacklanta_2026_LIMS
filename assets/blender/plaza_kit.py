"""Original, texture-free civic plaza and contrasting concert stage."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *

PALETTE.update(civic_white='#E6E9E2', civic_green='#205647', brass='#C69D4D',
               paper='#FFF0CC', neon_cyan='#47E6EA', neon_pink='#F15AC0')


def lettering(name, body, loc, size, material):
    bpy.ops.object.text_add(location=loc, rotation=(math.pi/2, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = 'CENTER'
    obj.data.size = size
    obj.data.extrude = 0
    obj.data.materials.append(mat(material))
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def scroll(loc, scale=1):
    x, y, z = loc
    box('scroll', loc, (.38*scale, .06*scale, .5*scale), 'paper')
    for dz in (-.25, .25):
        beam('scroll_roll', (x-.23*scale,y,z+dz*scale),
             (x+.23*scale,y,z+dz*scale), .045*scale, 'paper')
    for dz in (-.08, .02, .12):
        box('ink', (x,y-.033*scale,z+dz*scale), (.24*scale,.008,.012*scale), 'civic_green')


def mayor_podium():
    cone('stone_base', (0,0,.16), 2.15,2.15,.32,'stone',32)
    cone('floor', (0,0,.36), 1.99,1.99,.08,'civic_white',32)
    for i in range(3):
        box('front_step', (0,-2.36+i*.24,.065+i*.06), (1.55,.5,.13+i*.12),'stone')
    for angle in (0,60,120,180,240,300):
        a=math.radians(angle)
        x,y=1.68*math.cos(a),1.68*math.sin(a)
        cone('column_foot',(x,y,.5),.2,.2,.2,'civic_white',12)
        cone('column',(x,y,1.57),.105,.085,1.94,'civic_white',12)
        cone('capital',(x,y,2.59),.21,.21,.13,'brass',12)
    cone('cornice',(0,0,2.73),2.06,2.06,.16,'civic_white',32)
    # Hemisphere rings create a true domed silhouette, with a flat underside.
    verts=[]
    for j in range(7):
        theta=(math.pi/2)*j/7
        r=2.12*math.cos(theta)
        for i in range(32):
            a=2*math.pi*i/32
            verts.append((r*math.cos(a),r*math.sin(a),2.82+.97*math.sin(theta)))
    verts.append((0,0,3.79))
    faces=[tuple(reversed(range(32)))]
    for j in range(6):
        for i in range(32):
            a=j*32+i; b=j*32+(i+1)%32
            faces.append((a,b,b+32,a+32))
    for i in range(32): faces.append((192+i,192+(i+1)%32,224))
    mesh('dome',verts,faces,'civic_green')
    cone('finial',(0,0,3.91),.12,0,.28,'brass',12)
    box('lectern',(0,-.9,.89),(.65,.48,.98),'civic_green')
    box('lectern_top',(0,-.92,1.41),(.84,.65,.1),'brass')
    scroll((-.13,-1.15,1.7),.65)
    beam('gavel_handle',(.1,-.9,1.48),(.34,-.9,1.48),.025,'civic_green')
    beam('gavel',(.34,-1.01,1.5),(.34,-.79,1.5),.065,'brass')
    cone('seal',(0,-1.15,1.0),.13,.13,.03,'brass',12).rotation_euler.x=math.pi/2
    beam('bell_hanger',(0,-1.75,2.7),(0,-1.75,2.42),.025,'brass')
    cone('bell',(0,-1.75,2.31),.16,.07,.21,'brass',16)
    ball('clapper',(0,-1.75,2.19),(.045,.045,.06),'brass')
    cone('flag_foot',(-2.52,.3,.12),.25,.2,.24,'stone',12)
    beam('flagpole',(-2.52,.3,.22),(-2.52,.3,3.72),.035,'brass')
    box('civic_flag',(-2.17,.3,3.32),(.68,.035,.42),'civic_green')
    ball('flag_emblem',(-2.17,.27,3.32),(.09,.025,.09),'brass')


def mayor_statue():
    box('plinth_foot',(0,0,.1),(1.25,1.1,.2),'stone')
    box('plinth',(0,0,.49),(.95,.85,.58),'civic_white')
    box('plinth_cap',(0,0,.82),(1.08,.98,.08),'stone')
    box('plaque',(0,-.435,.49),(.63,.025,.24),'brass')
    lettering('mayor_title','MAYOR',(0,-.453,.44),.12,'civic_green')
    for x in (-.22,.22):
        ball('shoe',(x,-.1,.96),(.18,.25,.11),'civic_green')
        beam('leg',(x,0,.99),(x,0,1.25),.1,'brass')
    ball('round_belly',(0,0,1.49),(.53,.38,.55),'brass')
    ball('head',(0,-.02,2.1),(.34,.3,.34),'brass')
    ball('nose',(0,-.31,2.12),(.085,.075,.08),'brass')
    for x in (-.12,.12): ball('eye',(x,-.292,2.19),(.035,.02,.042),'civic_green')
    for i in range(5):
        x=(i-2)*.04
        ball('smile',(x,-.301,2.0+.5*x*x),(.023,.015,.018),'civic_green')
    cone('hat_brim',(0,-.02,2.38),.43,.43,.075,'civic_green',16)
    cone('top_hat',(0,-.02,2.61),.27,.3,.4,'civic_green',16)
    cone('hat_band',(0,-.02,2.45),.277,.277,.07,'brass',16)
    for z in (1.3,1.5,1.7): ball('button',(0,-.37,z),(.035,.025,.035),'civic_green')
    beam('arm_left',(-.39,0,1.77),(-.61,-.16,1.53),.12,'brass')
    beam('arm_right',(.38,0,1.77),(.62,-.18,1.92),.12,'brass')
    ball('hand',(.63,-.18,1.98),(.13,.11,.14),'brass')
    scroll((-.57,-.3,1.55),.85)


def notice_board():
    for x in (-.85,.85):
        box('foot',(x,0,.09),(.4,.55,.18),'stone')
        box('post',(x,0,1.15),(.12,.16,2.12),'civic_green')
        ball('post_cap',(x,0,2.25),(.13,.13,.13),'brass')
    box('backboard',(0,0,1.52),(1.85,.15,1.28),'civic_green')
    box('cork',(0,-.085,1.47),(1.62,.025,.87),'wood')
    box('header',(0,-.09,2),(1.7,.04,.23),'brass')
    lettering('gazette_header','VILLAGE GAZETTE',(0,-.117,1.955),.115,'civic_green')
    for i,(x,z) in enumerate(((-.5,1.58),(0,1.44),(.5,1.58))):
        box('notice_'+str(i),(x,-.115,z),(.4,.035,.57),'paper')
        ball('pin',(x,-.142,z+.22),(.03,.02,.03),'brass')
        for j in range(4): box('notice_ink',(x,-.136,z+.09-j*.075),(.26 if j<3 else .16,.008,.015),'civic_green')
    mesh('board_roof',[(-1.06,-.4,2.17),(1.06,-.4,2.17),(-1.06,0,2.4),(1.06,0,2.4),(-1.06,.4,2.17),(1.06,.4,2.17)],
         [(0,1,3,2),(2,3,5,4),(0,2,4),(1,5,3),(0,4,5,1)],'civic_green')


def festival_main_stage():
    box('stage_deck',(0,0,.34),(6.8,3.8,.68),'metal')
    box('neon_apron',(0,-1.91,.44),(6.6,.035,.12),'neon_pink')
    for i in range(3): box('stage_step',(0,-2.42+i*.2,.11+i*.1),(1.6,.45,.22+i*.2),'metal')
    # Two rails and diagonal bracing trace a broad concert arch.
    points=[(-3.15,0,.68),(-3.15,0,3.7),(-2.25,0,4.75),(2.25,0,4.75),(3.15,0,3.7),(3.15,0,.68)]
    for side in (-.22,.22):
        for i in range(len(points)-1):
            a,b=points[i],points[i+1]
            beam('arch_top' if side<0 and i==2 else 'truss_rail',(a[0],a[1]+side,a[2]),(b[0],b[1]+side,b[2]),.085,'metal')
    for a,b in zip(points,points[1:]):
        a,b=Vector(a),Vector(b)
        for j in range(6):
            u=a.lerp(b,j/6); v=a.lerp(b,(j+1)/6)
            beam('truss_diagonal',(u.x,-.22,u.z),(v.x,.22,v.z),.035,'stone')
            beam('truss_rung',(u.x,-.22,u.z),(u.x,.22,u.z),.035,'stone')
    box('screen_frame',(0,.5,2.68),(4.5,.24,2.7),'neon_cyan')
    box('led_screen',(0,.35,2.68),(4.25,.1,2.45),'metal')
    for i,h in enumerate((.45,.8,1.3,.95,1.65,1.25,.65,1.5,.9)):
        for j in range(round(h/.18)):
            box('led_pixel',(i*.4-1.6,.285,1.68+j*.18),(.24,.025,.11),'neon_cyan' if i%2 else 'neon_pink')
    lettering('live_title','VILLAGE LIVE',(0,.275,3.46),.28,'neon_cyan')
    for x,side in ((-2.7,'left'),(2.7,'right')):
        box('speaker_'+side,(x,-.65,1.64),(.68,.7,1.9),'metal')
        for z in (1.12,1.77,2.3):
            cone('speaker_cone',(x,-1.025,z),.24,.2,.06,'stone',16).rotation_euler.x=math.pi/2
            ball('speaker_dustcap',(x,-1.08,z),(.11,.04,.11),'metal')
        beam('neon_rail',(x,-.25,3.1),(x,-.25,3.7),.055,'neon_pink')
        box('barrier_'+side,(x,-3.0,.75),(1.8,.12,.12),'stone')
        for dx in (-.75,-.375,0,.375,.75): beam('barrier_bar',(x+dx,-3,.12),(x+dx,-3,.75),.025,'metal')
        for dx in (-.75,.75): box('barrier_foot',(x+dx,-3,.045),(.16,.6,.09),'metal')


if __name__ == '__main__':
    for build in (mayor_podium, mayor_statue, notice_board, festival_main_stage):
        reset()
        build()
        export(build.__name__)
