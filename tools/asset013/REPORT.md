# ASSET-013 delivery report

Branch: `asset/ASSET-013`.

Milestones: `0b17d91` (procedural generator), `9b34b86` (assets and integration).

## Delivered

- Six bottoms: jeans, chinos, joggers, shorts, skirt, overalls.
- Six shoes: sneakers, boots, sandals, loafers, high-tops, slippers.
- Seven glasses: wire round, aviator, cat-eye, sunglasses, half-rim, heart, oversized.
- Independent `bottoms` and `shoes` inventory slots, wardrobe/shop filters, live
  skeleton binding, base-body coverage/restoration, and model-free fallbacks.
- Primary/secondary/accent materials and existing palettes on every new item.
  Exposed calves/feet retain the avatar's skin color rather than a dye channel.
- Coin prices of 20–50; overalls, boots and heart glasses require village level 2
  / Fitness Corner (500 collective XP).
- Original CC0 geometry and 512×512 RGBA thumbnails. Largest GLB: 123,956 bytes.
  One authored mesh per item, split into at most four material draws by Three.js.
  Cached geometry is shared; skeletons/materials are private to each avatar.
- Migration `055_lower_body_slots.sql`; 052 was free on fetched `origin/main`.
  Existing decorative `shoes_sneakers` and `shoes_boots` remain unchanged;
  the new wearable collection uses `footwear_*` IDs.

## Files changed

- `packages/catalog/`: catalog JSON/schema/generated TS, validator, temporary
  legacy-client type adapter.
- `apps/web/public/models/` and `apps/web/public/thumbs/`: 19 new GLBs and 19 PNGs
  with `bottoms_*`, `footwear_*`, and `eyewear_*` names.
- `apps/web/src/scene/`: `Cosmetics.tsx`, `cosmeticAssets.ts`, `outfitLayers.ts`,
  new `lowerBody.ts` and `asset013.test.ts`; new eyewear clears protruding preset eyes.
- `apps/web/src/components/Wardrobe.tsx`: reachable Shop > My wardrobe collection tab, slot filters, and footwear icon.
- `apps/web/tests/asset013.config.ts`, `asset013.spec.ts`: isolated mock browser QA.
- `apps/api/app/catalog_registry.py`, `apps/api/migrations/055_lower_body_slots.sql`,
  `apps/api/tests/test_asset013.py`.
- `tools/asset013/`: deterministic generation/install tooling, generation/catalog
  integration tests, regeneration instructions, this report, ignored intermediates.

## Verification

All heavy commands ran through `ops/remote_run.sh`. Browser configuration forces
mock mode; API tests use the runner's isolated test schema/database. No provider
calls, secrets, live demo mutations, transactions, pushes, or merges were used.

From `apps/web` (each command prefixed with `bash ../../ops/remote_run.sh`):

| Command | Result |
| --- | --- |
| `bun test ../../tools/asset013/generate.test.ts` | Exit 0; 1 pass / 166 assertions; clean pinned Blender 4.3 + NumPy 1.26 run |
| `bun test ../../tools/asset013/catalog.test.ts` | Exit 0; generation/parity check plus all 46 catalog tests pass; 320 entries validate |
| `bun test src/scene/asset013.test.ts src/scene/cosmeticAssets.test.ts` | Exit 0; 16 pass / 708 assertions |
| `bun run test` | Exit 0; 179 tests pass |
| `bun run build` | Exit 0; TypeScript and Vite production build pass; standard large-chunk advisory |
| `bunx playwright test --config tests/asset013.config.ts` | Exit 0; all 4 tests pass: 1440 px, 390 px, missing-model fallback, pose sheets |

From `apps/api`:

```
bash ../../ops/remote_run.sh python -m uv run pytest -q tests/test_asset013.py tests/test_catalog_registry.py tests/test_item_colors.py
```

Exit 0: **26 passed**. Covers migration/catalog sync, buy/equip/replace/unequip,
independent lower slots, and persistent colors.

The fit tests exercise actual GLBs in idle/walk/sit, assert shared living bones,
check bounding boxes against the body, verify coverage restoration, and refit all
seven glasses to a synthetic generated head's measured width/front frame.
Open sandals/short garments replace the chunky base mesh with smaller skin
geometry, so their test checks limb alignment rather than enclosure of a boot.

Initial bootstrap failed with HTTP 403 from Blender's archive server; it was
replaced with pinned PyPI `bpy`. An initial NumPy 2 compatibility warning was
removed by pinning NumPy 1.26 and regenerating successfully. The initial fit
test's boot-enclosure assumption for sandals was corrected before the passing run.
The first browser run passed fallback and pose-sheet checks but its two wardrobe
checks timed out on a removed profile tab. A reachable Shop > My wardrobe tab
was added within the allowed component, and the test route was updated. Visual
inspection also prompted a measured-front-plane adjustment for the new eyewear
to keep opaque lenses ahead of protruding preset eyes; existing glasses retain
their prior fit. Focused regressions and the production build passed again.

## Try it

Use the existing mock/demo app, open **Shop**, choose **Bottoms**, **Shoes**, or
**Glasses**, and buy an item. Open **Shop > My wardrobe** to equip/unequip and
save a palette. Bottoms, shoes, tops, and glasses coexist. No GPU worker is needed.
For a real development API, apply the ordinary migrations and catalog sync first;
do not run resets or debug events on the live demo.

## Scope and upstream follow-up

The task excludes `apps/web/src/api/types.ts`, profile showcase data, and contracts.
The catalog therefore supplies an explicitly documented compile-time adapter for
the frozen client union; runtime slot strings are preserved. Upstream should add
`bottoms | shoes` to `EquipmentSlot` / the HTTP contract, add those slots and labels
to the profile showcase list, then remove `legacyClientCatalog.ts`. The existing
Wardrobe, shop, renderer, API and color flow work with the scoped implementation.
No contract files were edited.

## Visual QA

Reviewed all five final screenshots: desktop/mobile wardrobe, idle, walk, and
side-view sit. Lower garments follow the living rig and opaque lenses clear the
preset eyes. The generated-head check uses synthetic geometry, not a real photo.

Local QA artifacts (generated at the task-requested path, not committed):

- `apps/web/artifacts/asset013/wardrobe-1440.png`
- `apps/web/artifacts/asset013/wardrobe-390.png`
- `apps/web/artifacts/asset013/fit-idle.png`
- `apps/web/artifacts/asset013/fit-walk.png`
- `apps/web/artifacts/asset013/fit-sit.png`

No remaining runtime blockers. This report accompanies the final wardrobe-access
and lens-clearance milestone commit.
