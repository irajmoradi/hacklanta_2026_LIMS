---
id: ASSET-009
owner: codex (gpt-6-astra, medium)
branch: asset/ASSET-009 (parallel)
allowed_paths: [assets/**, apps/web/public/models/**, packages/catalog/**]
request: R-59 part (Iraj 14:59) "the gardens/trees look the same"
---
# ASSET-009 — Nature variety pack

Add varied vegetation (assets/ conventions, validator 0 failures, contact sheet, CATALOG.md + registry entries tagged `nature`
with placement hints and weights, so the layout can scatter them): ≥12 tree species and sizes (oak, maple in autumn orange,
birch, pine variants, palm, cherry blossom ×2, willow, fruit tree with apples, dead/bare tree, sapling), ≥6 bushes/hedges
(boxwood, flowering bush, berry bush, topiary ball and spiral), ≥8 garden beds/flower types (tulips, sunflowers, lavender rows,
vegetable patch, pumpkin patch, raised bed with tomatoes, rock garden, wildflower meadow patch), plus rocks, logs, mushrooms,
tall grass tufts and lily pads. Each comes in 2–3 color/size variants via named materials (`leaf`, `bark`, `flower`), ≤1.5k tris
(trees ≤2.5k). They must instance well (single mesh + few materials). Render `assets/previews/nature_pack.png`. Final report
per AGENTS.md.

## Also: distinct shop and arcade buildings (R-60, Iraj 15:02 "arcade/stores and most buildings look the same")
Rebuild every commercial/civic building in the registry (arcade, cafe/bakery, general store, bookshop, gym, etc.; see packages/catalog for ids) with its own silhouette and signage: arcade = neon marquee, glowing cabinets in the window, checkerboard floor; bakery = striped awning, bread display, chimney smoke node; bookshop = bay window stacked with books; etc. Same ids, footprints and attach anchors. Before/after sheet `assets/previews/buildings_before_after.png`.
