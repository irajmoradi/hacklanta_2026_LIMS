"""ASSET-003 inventory and attachment contract (glTF meters)."""
STREETS = 'road_straight road_corner road_t road_cross crosswalk sidewalk curb_corner streetlight bus_stop bike_rack trash_bin planter traffic_cone plaza_tile hedge_row'.split()
BUILDINGS = 'house_lv4 house_lv4_b house_lv5 house_lv5_b storefront_cafe storefront_records storefront_bakery town_hall apartment_small gym studio_art library arcade'.split()
SKINNED = 'shirt_tee shirt_hoodie shirt_flannel pants_jeans pants_shorts shoes_sneakers shoes_boots'.split()
ACCESSORIES = 'backpack hat_cowboy hat_beret hat_party glasses_sun necklace_chain wristband_festival pet_collar pet_bandana'.split()
UPGRADES = 'upgrade_solar_roof upgrade_porch upgrade_garden_gnome upgrade_neon_sign'.split()
TILES = STREETS[:7] + ['plaza_tile']
ATTACH = {
    'backpack': ('Spine', (0,.12,-.26)),
    'hat_cowboy': ('Head',(0,.68,0)), 'hat_beret': ('Head',(0,.68,0)),
    'hat_party': ('Head',(0,.68,0)), 'glasses_sun': ('Head',(0,.25,.31)),
    'necklace_chain': ('Spine',(0,.37,.02)),
    'wristband_festival': ('Arm_L',(0,.35,0)),
}
MATERIALS = {n: {'shirt' if n.startswith('shirt') else 'pants' if n.startswith('pants') else 'shoes'} for n in SKINNED}
MATERIALS.update({n: {'wall','roof','accent'} for n in BUILDINGS})
MATERIALS.update({n: {'path'} for n in TILES})
MATERIALS.update({'streetlight': {'metal','light'}, 'pet_collar': {'accent'}, 'pet_bandana': {'roof'}})
DESCRIPTIONS = {
    'road_straight':'4 m road; north/south connections (+/-Z)',
    'road_corner':'4 m road; north/east connections (+Z,+X)',
    'road_t':'4 m road; north/east/west connections (+Z,+/-X)',
    'road_cross':'4 m four-way road', 'crosswalk':'4 m north/south road with zebra crossing',
    'sidewalk':'4 m paved pedestrian tile', 'curb_corner':'4 m sidewalk with rounded southwest curb',
    'plaza_tile':'4 m decorative plaza paving', 'streetlight':'Street lamp; named lamp pivot',
    'storefront_cafe':'Cafe with coffee-cup sign and outdoor table',
    'storefront_records':'Festival vinyl shop with record sign',
    'storefront_bakery':'Bakery with bread sign', 'town_hall':'Mayor HQ with columns and clock',
    'apartment_small':'Three-storey apartments with balconies', 'gym':'Lance gym with dumbbell sign',
    'studio_art':'Stefanny art studio with paint palette sign', 'library':'Community library with book sign',
    'arcade':'Arcade with voxel mascot sign',
}
NAMES = STREETS + BUILDINGS + SKINNED + ACCESSORIES + UPGRADES
ADDITIONS = {n: (MATERIALS.get(n,set()), DESCRIPTIONS.get(n,n.replace('_',' ').capitalize())) for n in NAMES}
