"""ASSET-004 inventory and integration metadata; no runtime dependencies."""
PACKS = {
    'pack_festival_night': 'neon_arch glow_sticks_pile light_tower confetti_cannon dj_booth'.split(),
    'pack_spooky': 'pumpkin_lantern ghost_sheet spider_web_corner bat_garland tombstone_cartoon'.split(),
    'pack_winter': 'snowman snow_pile string_lights_icicle gift_box_stack pine_decorated'.split(),
    'pack_birthday': 'party_balloons cake_giant gift_table bunting_rainbow party_hat_villager'.split(),
    'pack_movie_night': 'projector_screen popcorn_stand bean_bags film_reel_sign'.split(),
    'pack_game_night': 'arcade_cabinet_outdoor giant_controller_statue pixel_trophy minecraft_style_block_stack'.split(),
    'weather_fx': 'cloud_rain cloud_puffy fog_bank_card rainbow_arc sun_rays_card'.split(),
}
NAMES = [name for names in PACKS.values() for name in names]
REQUIRED_NODES = {'cloud_rain': {'drops'}}
DESCRIPTIONS = {name: name.replace('_', ' ').capitalize() for name in NAMES}
DESCRIPTIONS.update({
    'cloud_rain': 'Rain cloud; translate drops locally along Y, reset periodically',
    'party_hat_villager': 'Birthday cone hat; Head bone offset (0,0.68,0)',
    'fog_bank_card': 'Double-sided translucent fog silhouette; front +Z',
    'sun_rays_card': 'Double-sided translucent radial sun card; front +Z',
    'minecraft_style_block_stack': 'Original generic colored cubes; no branded textures',
    'projector_screen': 'Freestanding blank outdoor cinema screen; front +Z',
})
