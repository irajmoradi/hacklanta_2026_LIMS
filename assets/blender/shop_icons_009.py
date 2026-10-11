"""Small display-only sculptures, rendered with the ASSET-007 camera and lights."""
from common import *


def rounded(name, loc, size, material):
    obj = box(name, loc, size, material)
    bevel = obj.modifiers.new('Soft edges', 'BEVEL')
    bevel.width = min(size) * .2
    bevel.segments = 3
    return obj


def sphere(name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    finish(obj, name, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def sparkle(x, y, z, size):
    mesh('sparkle', [(x,y,z+size),(x+size*.22,y,z+size*.22),
         (x+size,y,z),(x+size*.22,y,z-size*.22),(x,y,z-size),
         (x-size*.22,y,z-size*.22),(x-size,y,z),(x-size*.22,y,z+size*.22)],
         [tuple(range(8))], 'light')


def build_icon(name):
    if name == 'revival_potion':
        PALETTE['potion'] = '#F575B7'
        sphere('pink_bottle', (0,0,.43), (.33,.26,.37), 'potion')
        cone('bottle_neck', (0,0,.78), .13,.13,.2, 'blossom', vertices=32)
        cone('cork', (0,0,.91), .105,.115,.12, 'wood', vertices=32)
        rounded('label', (0,-.254,.45), (.27,.025,.24), 'wall')
        rounded('cross_vertical', (0,-.274,.45), (.04,.015,.15), 'potion')
        rounded('cross_horizontal', (0,-.275,.45), (.15,.015,.04), 'potion')
        sphere('glint', (-.15,-.22,.58), (.035,.014,.09), 'light')
        shader = mat('potion').node_tree.nodes.get('Principled BSDF')
        shader.inputs['Emission Color'].default_value = (1,.08,.35,1)
        shader.inputs['Emission Strength'].default_value = .25
        sparkle(.42,0,.83,.13)
        sparkle(-.42,0,.62,.09)
    elif name == 'photo_token':
        rounded('polaroid', (0,0,.52), (.76,.09,.94), 'wall')
        rounded('picture', (0,-.055,.6), (.64,.025,.61), 'water')
        sphere('sun', (.18,-.079,.76), (.075,.018,.075), 'light')
        mesh('mountains', [(-.29,-.082,.31),(-.10,-.082,.62),(.09,-.082,.31),
             (.01,-.085,.31),(.16,-.085,.53),(.30,-.085,.31)], [(0,1,2),(3,4,5)], 'leaf')
        sparkle(.39,-.10,.99,.19)
    else:
        rounded('phone', (-.1,0,.52), (.56,.13,1.02), 'metal')
        rounded('screen', (-.1,-.078,.54), (.46,.025,.81), 'water')
        rounded('speaker', (-.1,-.094,.98), (.13,.015,.022), 'stone')
        sphere('home_button', (-.1,-.084,.065), (.028,.01,.028), 'wall')
        rounded('speech_bubble', (.32,-.13,.77), (.55,.11,.48), 'wall')
        mesh('bubble_tail', [(.13,-.19,.57),(.11,-.19,.43),(.28,-.19,.57)], [(0,1,2)], 'wall')
        sphere('villager_face', (.31,-.20,.78), (.13,.025,.14), 'skin')
        sphere('hair', (.31,-.21,.89), (.13,.023,.05), 'hair')
        for x in (.265,.355):
            sphere('eye', (x,-.233,.79), (.014,.012,.018), 'metal')
        rounded('smile', (.31,-.236,.72), (.065,.012,.018), 'hair')
