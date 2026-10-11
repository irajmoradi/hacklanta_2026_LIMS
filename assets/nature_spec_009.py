"""Nature inventory, weighted placement and material presets (meters, glTF axes)."""
TREES = 'oak maple_autumn birch pine_tall pine_wide palm cherry_pink cherry_white willow apple dead sapling'.split()
BUSHES = 'boxwood flowering_bush berry_bush topiary_ball topiary_spiral hedge'.split()
GARDENS = 'tulips sunflowers lavender vegetable_patch pumpkin_patch tomatoes rock_garden wildflowers'.split()
DETAILS = 'rocks log mushrooms tall_grass lily_pads fern stump'.split()
NAMES = ['nature_' + n for n in TREES + BUSHES + GARDENS + DETAILS]
BUILDINGS = 'shop storefront_cafe storefront_records storefront_bakery town_hall gym studio_art library arcade pet_shelter colosseum'.split()
COLORS = {'maple_autumn': '#EF822C', 'birch': '#91AD46', 'pine_tall': '#326D59',
          'pine_wide': '#447A64', 'cherry_pink': '#EA91BB', 'cherry_white': '#F5E3DC',
          'willow': '#91B55B', 'palm': '#438F68'}

def shade(color, factor):
    return '#' + ''.join(f'{min(255,round(int(color[i:i+2],16)*factor)):02X}' for i in (1,3,5))

def metadata(name):
    key = name.removeprefix('nature_')
    group = 'tree' if key in TREES else 'bush' if key in BUSHES else 'garden' if key in GARDENS else 'detail'
    surface = 'water' if key == 'lily_pads' else 'ground'
    hint = 'pond_surface' if surface == 'water' else 'garden_border' if group in ('bush', 'garden') else 'woodland_edge'
    leaf = COLORS.get(key, '#689B68')
    flower = '#F4BD3F' if key == 'sunflowers' else '#986CC4' if key == 'lavender' else '#EB7094'
    flower = '#D84D38' if key in ('apple', 'tomatoes', 'berry_bush') else '#ED8C32' if key=='pumpkin_patch' else '#514539' if key=='birch' else flower
    if key in ('stump','log'): flower='#D6B380'
    bark = '#E9E1CC' if key=='birch' else '#969A98' if key in ('rocks','rock_garden') else '#805A40'
    return {'group': group, 'placement': {'surface': surface, 'hint': hint,
            'weight': 1 if key in ('dead', 'palm', 'topiary_spiral') else 3 if group == 'tree' else 5,
            'clearance_m': 2.2 if group == 'tree' else 1.4 if group == 'garden' else .8},
            'variants': [
                {'id': 'standard', 'scale': 1, 'materials': {'leaf': leaf, 'bark': bark, 'flower': flower}},
                {'id': 'young', 'scale': .72, 'materials': {'leaf': shade(leaf,1.15), 'bark': shade(bark,1.12), 'flower': shade(flower,1.14)}},
                {'id': 'mature', 'scale': 1.18, 'materials': {'leaf': shade(leaf,.86), 'bark': shade(bark,.82), 'flower': shade(flower,.9)}},
            ]}
