# FIX-009 — Every priced shop item has a picture

Branch: `fix/FIX-009`. Thumbnail milestone: `8227b52`. The subsequent
`fix(shop): display thumbnails across shop and farm menus` commit contains the
card changes, regression tests, UI screenshots, and this report.

## Result and files

- Added all **74 missing** `apps/web/public/thumbs/<id>.png` files. All **96
  positively priced** catalog entries now have transparent 512×512 PNGs.
  The complete new-item list is `assets/fix009-items.json`.
- Extended `assets/blender/shop_preview_007.py` with `--priced`; it retains
  ASSET-007's camera, lighting, soft shadow, framing, and transparent output.
  Missing models now fail explicitly in this mode instead of rendering a box.
- `assets/blender/shop_icons_009.py` authors display-only sculptures for the
  three items without GLBs: phone/face/bubble for villagergram, sparkling
  Polaroid for photo_token, and glowing pink bottle for revival_potion.
  The other 71 images use the actual catalog GLBs, including shared animal
  models for their Friend variants. The paddock has a GLB, so its thumbnail
  depicts that existing fence asset. Existing voice-style thumbnails remain.
- `apps/web/src/components/ItemThumbnail.tsx` requests art for every item,
  removing the old 29-item display restriction. The original live-model
  fallback behavior is preserved for that original pack; newer items retain
  their supplied icons when art is unavailable, without allocating per-card
  WebGL canvases. `PhotoItems.tsx` and `Villagergram.tsx` now show their icons
  beside their specialized purchase forms.
- `ItemThumbnail.test.tsx` adds the catalog coverage gate to the existing
  `bun run test` suite and tests farm/outfit image requests and error fallback.
  `assets/fix009_sheet.py` also fully decodes every priced image, checks
  dimensions, RGBA, transparency, and visible pixels, and produces the sheet.
- `assets/fix009.playwright.config.ts` and `assets/tests/fix009.spec.ts` cover
  regular shop pets, outfits and consumables, every farm animal and Friend,
  the actual farm-building click handler, and offline image/model fallback.
  In this worktree the farm building opens `ShopModal` with the farm department
  selected; it already shares `EquipmentPanel` and `ItemThumbnail`. No separate
  interior card implementation required changes.

## Validation

Commands ran from the repository root; all final commands below exited **0**:

| Command | Result |
| --- | --- |
| `& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python assets/blender/shop_preview_007.py -- --priced --resume` | 74 new images rendered |
| `python assets/fix009_sheet.py` | All 96 priced images decoded and validated; 74-image sheet produced |
| `bun run --cwd apps/web test` | 126 passed, 0 failed |
| `node apps/web/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json` | Passed |
| `node apps/web/node_modules/typescript/bin/tsc -b apps/web` | Passed |
| `node apps/web/node_modules/vite/bin/vite.js build apps/web --outDir ../../assets/previews/fix009-build` | Production build passed; existing large-chunk advisory |
| `node apps/web/node_modules/@playwright/test/cli.js test --config assets/fix009.playwright.config.ts` | 3 browser tests passed |

An initial coverage run before rendering finished failed on a missing image,
demonstrating the gate rejects incomplete catalogs. The first typecheck lacked
the isolated pot dependencies; linking the existing local dependencies resolved
it. The first browser launch timed out because Vite bound localhost while the
test waited on IPv4; the committed config explicitly binds 127.0.0.1.
No credentials or paid services were needed; all browser work used fixtures.
Temporary build output, renderer logs, and browser scratch files remain local
and are excluded through `assets/previews/.gitignore`.

## Visual review and teammate steps

- Contact sheet: `assets/previews/fix009-contact-sheet.png`
- Regular shop: `assets/previews/fix009-shop.png`
- Farm department: `assets/previews/fix009-farm.png`
- Farm building entry: `assets/previews/fix009-farm-entry.png`

All were inspected. Reproduce the automated review with the Playwright command
above. For manual use, start the web app with `VITE_MOCK=1` and
`VITE_DEMO_AUTH=1`, choose Iraj, open Shop, inspect the dogs, then select Farm
Store. The unlocked farm building opens the same department directly. With
thumbnail requests blocked, new cards retain their icons and purchase controls.

Only allowed source/artifact paths changed. No GLBs, catalog entries, root
configuration, secrets, or contracts were changed. Zero-price scene-only entries
are intentionally excluded from the priced-item gate. No blockers or proposed
contract changes.
