---
id: ASSET-013
owner: codex (gpt-6-astra, high)
branch: asset/ASSET-013
allowed_paths: [packages/catalog/**, apps/web/public/models/**, apps/web/public/thumbs/**, apps/web/src/scene/**, apps/web/src/components/Wardrobe.tsx, apps/web/src/api/mock.ts, apps/api/app/**, apps/api/tests/**, apps/api/migrations/**, tools/**, apps/web/tests/**]
---
# ASSET-013 — Shoes, pants (with colors) and more glasses (R-122, Stefanny)

Teammate: "can we also add options for shoes and pants? diff colors etc. more glasses as well."
1. **Pants/bottoms slot.** If the preset body has no separate bottoms slot, add one end to end: catalog slot, equip API,
   wardrobe tab, renderer. 6+ styles (jeans, chinos, joggers, shorts, skirt, overalls) as recolorable meshes fitted to the
   preset body's legs, skinned to the same skeleton so walking and sitting animations deform them. No clipping in
   idle/walk/sit.
2. **Shoes slot:** 6+ styles (sneakers, boots, sandals, loafers, high-tops, slippers), recolorable, on both feet, skinned.
3. **Glasses:** 6+ more (round, aviator, cat-eye, sunglasses, half-rim, heart, oversized), fitted with the existing measured
   head frame so they sit right on generated heads too.
Colors: every new item uses the existing primary/secondary/accent color-channel system and palettes. Prices in coins, a couple
behind XP level locks, 512 px RGBA thumbnails like the rest (`apps/web/public/thumbs`). Build meshes procedurally or from CC0
sources with the license noted (no paid generation). Keep glb files small (<150 KB each), instanced/batched where the village
renders many avatars. Migrations if needed: next free number on main. Tests: catalog validation, thumbnail guard, fit tests
(bounding boxes vs body), wardrobe Playwright screenshots (desktop + 390 px) in apps/web/artifacts/asset013/ via
`ops/remote_run.sh` (AGENTS.md); mock mode only. Final report per AGENTS.md.
