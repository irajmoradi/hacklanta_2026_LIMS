"""Original, texture-free three-channel clothing, generated without providers."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *
from town_kit import clothing, ring
sys.path.insert(0, str(ROOT / 'assets'))
from outfits_spec import TOPS, HATS, ACCESSORIES

PALETTE.update(primary='#BC6651', secondary='#F1D9AD', accent='#3B9790')


def top(style):
    clothing('shirt_' + (style if style in ('hoodie', 'flannel', 'tee') else 'hoodie' if style == 'sweater' else 'tee'))
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    for obj in list(bpy.context.scene.objects):
        if style == 'sweater' and obj.name.startswith(('hood', 'drawstring', 'pocket')):
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        if obj.type == 'MESH':
            for i, material in enumerate(obj.data.materials):
                obj.data.materials[i] = mat({'shirt':'primary','wall':'secondary','accent':'accent'}.get(material.name, 'primary'))
    def detail(obj):
        obj.vertex_groups.new(name='Spine').add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        obj.modifiers.new('Skeleton', 'ARMATURE').object = rig
        obj.parent = rig
    if style == 'overalls':
        detail(box('bib', (0,-.274,.9), (.34,.038,.31), 'secondary'))
        for x in (-.13,.13):
            detail(box('strap',(x,-.247,1.08),(.06,.055,.17),'secondary'))
            detail(ball('button',(x,-.299,1.01),(.023,.013,.023),'accent'))
    elif style == 'varsity':
        for obj in bpy.context.scene.objects:
            if obj.type == 'MESH' and obj.name.startswith('sleeve'): obj.data.materials[0] = mat('secondary')
        detail(box('placket',(0,-.282,.88),(.04,.018,.43),'secondary'))
        detail(box('letter_patch',(.13,-.254,1.02),(.075,.035,.1),'accent'))
    else:
        detail(box('hem',(0,-.239,.652),(.3,.025,.033),'secondary'))
        detail(box('label',(.15,-.25,.71),(.065,.026,.04),'accent'))


def hat(style):
    if style == 'beanie':
        ball('knit',(0,0,.13),(.36,.32,.27),'primary')
        cone('cuff',(0,0,.025),.36,.36,.10,'secondary',16)
        ball('pom',(0,0,.38),(.09,.09,.09),'accent')
    elif style in ('bucket','sunhat'):
        cone('brim',(0,0,.025),.48 if style=='bucket' else .6,.39,.05,'secondary',20)
        cone('crown',(0,0,.18),.34,.27,.3,'primary',16)
        cone('ribbon',(0,0,.11),.329,.313,.07,'accent',16)
    elif style == 'beret':
        cone('band',(0,0,.02),.32,.32,.04,'secondary',16)
        ball('cap',(.055,0,.12),(.39,.33,.16),'primary')
        beam('stem',(.06,0,.23),(.09,0,.31),.025,'accent')
    elif style == 'bow':
        ring('band',(0,0,.02),.31,.018,'secondary')
        for x in (-.15,.15): ball('bow',(x,-.03,.12),(.18,.075,.13),'primary')
        ball('knot',(0,-.07,.12),(.075,.07,.075),'accent')
    elif style == 'flower_crown':
        ring('vine',(0,0,.025),.34,.027,'primary')
        for i in range(8):
            a=i*math.tau/8; x,y=.34*math.cos(a),.34*math.sin(a)
            for j in range(5):
                b=j*math.tau/5
                ball('petal',(x+.06*math.cos(b),y+.06*math.sin(b),.06),(.052,.052,.025),'secondary')
            ball('pollen',(x,y,.083),(.03,.03,.022),'accent')
    else:
        ring('headband',(0,0,.02),.32,.025,'secondary')
        for x in (-.35,.35):
            ball('muff',(x,0,.035),(.075,.12,.12),'primary')
            ball('heart',(x,-.09,.055),(.04,.035,.045),'accent')


def accessory(style):
    if style == 'bandana':
        ring('collar',(0,0,.0),.19,.035,'secondary')
        mesh('kerchief',[(-.22,-.18,0),(.22,-.18,0),(0,-.30,-.23)],[(0,1,2)],'primary')
        ball('knot',(.2,0,0),(.06,.065,.05),'accent')
    elif style == 'backpack':
        box('pack',(0,.31,.22),(.43,.22,.44),'primary')
        box('pocket',(0,.44,.14),(.3,.065,.17),'secondary')
        for x in (-.18,.18): ring('strap',(x,.08,.24),.23,.025,'accent',True,scale=(.3,1,1))
    else:
        box('bag',(.38,-.04,.03),(.25,.17,.38),'primary')
        ring('handle',(.38,-.04,.33),.16,.022,'secondary',True,scale=(.7,1,1.25))
        box('patch',(.38,-.132,.06),(.12,.015,.1),'accent')


if __name__ == '__main__':
    for style in TOPS + HATS + ACCESSORIES:
        reset()
        (top if style in TOPS else hat if style in HATS else accessory)(style)
        export('outfit_' + style)
