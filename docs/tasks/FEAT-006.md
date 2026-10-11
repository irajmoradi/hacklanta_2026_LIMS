---
id: FEAT-006
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-006 (parallel; integrator resolves conflicts)
allowed_paths: [assets/**, apps/web/public/models/**, packages/catalog/**, apps/web/**, apps/api/**, packages/contracts/api.md]
request: R-36 (Stefanny, Discord 13:45) "more outfit options and styles, with color palettes so people can choose what color they wear"
---
# FEAT-006 — More outfits + wearable color palettes

1. **Assets:** add ~16 new clothing GLBs that fit villager_base (assets/ conventions, attach anchors, ≤3k tris each, validator 0
   failures) across slots: tops (hoodie, sweater, tee, flannel, overalls, varsity jacket), bottoms if supported (shorts, jeans,
   skirt), headwear (beanie, bucket hat, beret, bow, flower crown), accessories (backpack, tote, bandana). Each has named
   tintable materials (`primary`, `secondary`, `accent`). Add registry entries (source shop, sensible XP prices 40–300, rarity),
   then the contact sheet + CATALOG.md.
2. **Color choice:** per owned clothing item, a `colors {primary, secondary?, accent?}` (hex, validated). API: store on the
   inventory row (migration with suffix `_item_colors`), `PATCH /villages/{vid}/inventory/{item_id}/colors`, exposed in
   equipped data for everyone; pytest + api.md.
3. **Web:** Wardrobe gets a color panel for the selected item: 16-swatch cozy palette + 3 presets per item + a custom hex, and a
   live preview on the rotating villager. The scene, profile showcase and name tags apply tints via the material names.
   Also make existing clothing items tintable where their materials allow it.
Tests: unit (tint application), e2e (mock wardrobe recolor), pytest, real screenshots. Final report per AGENTS.md.
