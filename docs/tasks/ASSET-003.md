---
id: ASSET-003
owner: codex (gpt-6-astra, medium)
branch: asset/ASSET-003
allowed_paths: [assets/**, apps/web/public/models/**]
---
# ASSET-003 — Content for a big rectangular town + a wardrobe's worth of outfits

Read assets/README.md, assets/CATALOG.md, assets/VALIDATION.md (conventions, validator, tintable materials).
The town is moving to a **rectangular street grid** (blocks, streets, plazas, festival district). Another agent
(ARCH-001) is creating `packages/catalog/catalog.json` as the single registry — for every GLB you add, also write a
matching entry suggestion into `assets/catalog_additions.json` (same fields as described in docs/tasks/ARCH-001.md:
id, kind, slot, name, description, price_xp, requires, asset.glb, asset.attach{bone|anchor, offset, rotation, scale},
tint_materials) so the integrator can merge it into the registry.

Street/block kit (tileable on a 4 m grid, origin at tile center): `road_straight`, `road_corner`, `road_t`,
`road_cross`, `crosswalk`, `sidewalk`, `curb_corner`, `streetlight` (node `lamp`), `bus_stop`, `bike_rack`,
`trash_bin`, `planter`, `traffic_cone`, `plaza_tile`, `hedge_row`.
Buildings (fit one block lot 8×8 m): `house_lv4`, `house_lv5` (+ `_b` variants), `storefront_cafe`, `storefront_records`
(vinyl shop — festival theme), `storefront_bakery`, `town_hall` (Mayor HQ), `apartment_small`, `gym` (Lance!),
`studio_art` (Stefanny!), `library`, `arcade` (Minecraft-hours vibes).
Outfits (fit villager_base; torso/legs overlays use tintable materials): `shirt_tee`, `shirt_hoodie`, `shirt_flannel`,
`pants_jeans`, `pants_shorts`, `shoes_sneakers`, `shoes_boots`, `backpack`, `hat_cowboy`, `hat_beret`, `hat_party`,
`glasses_sun`, `necklace_chain`, `wristband_festival`. Pet decorations: `pet_collar`, `pet_bandana` (attach to pet_dog).
House upgrades: `upgrade_solar_roof`, `upgrade_porch`, `upgrade_garden_gnome`, `upgrade_neon_sign`.
Keep each ≤3k tris (buildings ≤6k). Validator must pass for ALL files; update contact sheet + CATALOG.md.
Final report per AGENTS.md.
