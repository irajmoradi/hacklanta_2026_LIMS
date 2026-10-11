---
id: INTEG-011
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-011 (from main)
allowed_paths: [apps/**, packages/**, docs/**]
---
# INTEG-011 — Land FEAT-013 (shop interiors + pets) onto main

`git merge --no-ff feat/FEAT-013`. It branched before INTEG-010 (coins/SOL/XP wallet, organic map, WASD/drag-to-ride, FIX-008 outfit
fit, AUDIO-001 ambience) landed, so it conflicts in catalog_registry.py, App.tsx, equipment.ts, shopState.ts, types.ts, Modals.tsx,
Wardrobe.tsx, FarmAnimals.tsx, VillageScene.tsx, catalog.schema.json, dist/catalog.ts. Keep BOTH: main's coin wallet everywhere (the
shop interior's balance chip, buy buttons and lock reasons must show **coins**, not XP), FIX-008 fit rules for mannequin outfits,
INTEG-010's player control/drag targets (add the shop + farm store entrances as drag targets that open their interiors), and
FEAT-013's interiors, checkout animation, fence and 7 pets. Regenerate the catalog dist; fix count assertions. NOTE: PERF-002 is
running in parallel on main and will code-split heavy components, so keep the interiors behind their own lazy-loadable module
(e.g. `ShopInterior` default export) so the perf pass can lazy-load them. Run all checks. Don't merge to main. Final report.
