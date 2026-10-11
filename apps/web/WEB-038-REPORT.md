# WEB-038 ? Try on before you buy

Branch: `web/WEB-038`. Implementation commit: `1cc3151`. Verification, keyboard focus follow-up, and this report are in the subsequent commit on the same branch.

Implemented local previews on every visual shop item card in both departments. Consumables and voice styles have no try-on action. The draft uses `replaceSlot`, retains unrelated equipment and per-item metadata/colors, and updates equipped IDs without writing to the API. The shared `OptionalModel` renderer retains the existing FIX-008/012 fitting behavior. Your character moves to the boutique mirror, which renders the draft outfit; the farm shows the selected companion beside you. House paddocks and farm animals appear beside your house in its thumbnail. Done discards the draft; switching departments or leaving the shop clears it. Keyboard focus moves into the pane and returns to the card after Done or Buy. Mobile reserves enough vertical space for the pane, and reduced-motion/missing-model fallbacks work.

FEAT-006 palettes are available for clothing, the only kind supported by the existing inventory-color endpoint. Original preserves authored or previously saved colors. Buy uses the existing purchase/equip endpoint, followed by a color PATCH only when a palette was chosen. A failed purchase retains the draft; a failed color PATCH explicitly reports that the purchase succeeded and directs the user to retry colors in the wardrobe. Purchase eligibility, reward locks, funds, and prerequisites retain existing shop rules. Locked visual items can be previewed but cannot be bought from the pane. Owned items may be previewed, with Buy disabled.

Files changed (all under `apps/web/`):

- `src/components/Wardrobe.tsx`: draft lifecycle, buy/color handling, focus restoration and cards.
- `src/components/tryOn.ts`, `TryOnPane.tsx`, `tryOn.css`: immutable merge, preview UI, palettes and responsive layout.
- `src/components/Modals.tsx`, `src/scene/ShopInterior.tsx`: connect draft to the shopper, live mirror and pet scene.
- `src/components/ShowcasePreview.tsx`: house paddock/animal thumbnail.
- `src/scene/cosmeticAssets.ts`, `cosmeticAssets.test.ts`: missing-model clothing uses its primary fallback material for palette colors, with a source-isolation regression test.
- `src/components/tryOn.test.ts`, `tests/web038.spec.ts`, `tests/web038Scene.ts`, `playwright.web038.config.ts`, `package.json`: merge tests, rendered scene/color inspection, mock-only desktop/mobile/purchase-failure tests and default unit-suite registration.
- `artifacts/web038/{clothing-mirror,pet-store,house-paddock,mobile-fallback}.png` and this report.

Validation (commands run from `apps/web` unless stated):

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` | 0 | Installed dependencies; lockfile unchanged. |
| `bun run typecheck` | 0 | TypeScript passes. |
| `bun run test` | 0 | 160 tests, 40 files, 78,009 assertions pass. |
| `bun test src/components/tryOn.test.ts src/scene/cosmeticAssets.test.ts src/api/equipment.test.ts src/api/itemColors.test.ts` | 0 | 15 focused tests pass. |
| `bun run build` | 0 | Production build passes; Vite warns about existing large chunks. |
| `bunx playwright test --config playwright.web038.config.ts` | 0 | 3 tests pass: rendered item and palette, discard without spending, buy/equip/color persistence, mirror position, pet/house previews, mobile/missing GLBs, focus, purchase rejection, partial color failure. |
| `bunx playwright test --config playwright.feat013.config.ts` | 1 | 1 passes, 2 fail: entrance exceeds the suite's 400 ms limit (1,527 ms), and next mannequin rotation differs from hardcoded `outfit_sweater`. |
| Same FEAT-013 command with original `ShopInterior.tsx` from `1cc3151^`, restored afterward | 1 | Same 2 failures: 1,027 ms entrance and same different catalog rotation. Mobile fallback test passes. These failures reproduce without this task's scene changes. |
| `git diff --check` (repo root) | 0 | No whitespace errors. |

A final rendered-color assertion also exposed a real missing-model bug: catalog tint-material restrictions excluded the fallback primary material. This was fixed without changing authored-model tint rules, then the unit/build/E2E suites were rerun. Earlier attempts exposed a unit assertion that ignored `replaceSlot` sorting and a duplicate catalog name in a mobile selector; both tests were corrected. Initial typecheck commands failed before dependencies were installed / from the repository root; subsequent commands above used the app directory. An extra mobile screenshot command was initially run from the root and failed to locate its config; it was rerun from the app directory.

Screenshots were visually inspected. They use fixture characters only. No live village mutation, provider generation, secret copying, contract changes, or GPU-worker dependency.

Try it:

```powershell
cd apps/web
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5238
```

Open `http://localhost:5238`, choose a demo seat, open Shop, and select **Try on** on Cozy Beanie. Choose Woodland, inspect the mirror and pane, then Done to discard or Buy to equip. Farm Store offers companion and house-paddock previews; purchase locks remain visible. For repeatable automated verification, run `bunx playwright test --config playwright.web038.config.ts`.

Blockers: none for WEB-038. Existing FEAT-013 timing/catalog assertions remain red as documented. No contract changes proposed; optional future atomic purchase-plus-colors support would remove the current two-request partial-success case, but is not required by this implementation.
