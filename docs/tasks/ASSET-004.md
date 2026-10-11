---
id: ASSET-004
owner: codex (gpt-6-astra, medium)
branch: asset/ASSET-004
allowed_paths: [assets/**, apps/web/public/models/**]
---
# ASSET-004 — "Village cosmetic events" packs (Stefanny's list) + weather FX props

Read assets/README.md, assets/CATALOG.md, assets/catalog_additions.json (format for registry suggestions), packages/catalog/
README.md (registry fields). Same conventions/validator. For every new GLB add an entry suggestion to
`assets/catalog_additions_004.json` (kind `decoration` or `building`, plus an `event_pack` tag).

Event packs the Mayor can trigger as village-wide cosmetic events (each 4–6 pieces, ≤2k tris each):
- `pack_festival_night`: neon_arch, glow_sticks_pile, light_tower, confetti_cannon, dj_booth.
- `pack_spooky`: pumpkin_lantern, ghost_sheet, spider_web_corner, bat_garland, tombstone_cartoon.
- `pack_winter`: snowman, snow_pile, string_lights_icicle, gift_box_stack, pine_decorated.
- `pack_birthday`: party_balloons, cake_giant, gift_table, bunting_rainbow, party_hat_villager (head slot).
- `pack_movie_night` (the demo's failed event!): projector_screen, popcorn_stand, bean_bags, film_reel_sign.
- `pack_game_night`: arcade_cabinet_outdoor, giant_controller_statue, pixel_trophy, minecraft_style_block_stack (generic
  cubes — no trademarked textures).
Weather/FX props: `cloud_rain` (node `drops` for animation), `cloud_puffy`, `fog_bank_card`, `rainbow_arc`, `sun_rays_card`.
Upgrade the contact sheet + CATALOG.md; validator 0 failures. Final report per AGENTS.md.
