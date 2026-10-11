"""FEAT-006 collection; no new equipment slots required."""
TOPS = ['hoodie', 'sweater', 'tee', 'flannel', 'overalls', 'varsity']
HATS = ['beanie', 'bucket', 'beret', 'bow', 'flower_crown', 'sunhat', 'earmuffs']
ACCESSORIES = ['backpack', 'tote', 'bandana']
NAMES = ['outfit_' + name for name in TOPS + HATS + ACCESSORIES]


def entry(name):
    style = name.removeprefix('outfit_')
    slot = 'head' if style in HATS else 'neck' if style == 'bandana' else 'torso'
    return {
        'id': name, 'kind': 'clothing', 'slot': slot,
        'name': 'Cozy ' + style.replace('_', ' ').title(),
        'description': 'Three-channel palette wearable fitted to villager_base. '
                       + ('Shares the torso slot with tops.' if style in ('backpack', 'tote') else ''),
        'price_xp': 40 + (TOPS + HATS + ACCESSORIES).index(style) * 10,
        'rarity': 'uncommon' if style in ('varsity', 'flower_crown', 'overalls') else 'common',
        'tags': ['shop', 'tintable'] + (['skinned'] if style in TOPS else []),
        'asset': {'glb': '/models/' + name + '.glb',
                  'tint_materials': ['primary', 'secondary', 'accent'],
                  'attach': ({'anchor': 'villager_base', 'offset': [0, 0, 0],
                              'rotation': [0, 0, 0], 'scale': 1} if style in TOPS else
                             {'bone': 'Spine' if slot == 'torso' else 'Head',
                              'offset': [0, -.065 if slot == 'torso' else -.165 if slot == 'neck' else .68, 0],
                              'rotation': [0, 0, 0], 'scale': 1})},
    }
