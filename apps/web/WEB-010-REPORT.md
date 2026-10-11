# WEB-010 handoff

Branch: `web/WEB-010`. Implementation: `3812395`; rendering/refresh fixes:
`6e5520d`. This report is the subsequent handoff commit. No push or merge.
All changes are within `apps/web/**`; `public/models/**` is unchanged.

## Delivered

- Typed API-008 equipment objects and IDs replace the temporary normalization.
  Equip/unequip use the authenticated member routes. Voice requests include the
  selected village, including the existing profile's Hear them action.
- Hats/headphones, glasses, scarf and denim attach to each cloned rig's Head or
  Spine. Visible generated-head bounds determine hat height/width and glasses
  placement; attachments refit when a generated head appears or is removed.
  Each cosmetic owns its cloned materials. Only the `jacket` material receives
  the denim tint. Original single/array material shape is preserved so GLB
  geometries without material groups actually draw.
- Dogs follow their owner's moving group. House equipment chooses the cottage
  mesh or backyard; decorations use their catalog assets. Weekly crowns remain
  independent of purchased equipment, with a raised crown when another hat is
  worn. Scene labels leave more space above the dressed villagers.
- Shop displays slot, ownership, active equipment, price, and both item/building
  prerequisites. Owned items can be equipped or removed without spending XP.
  My profile has a Wardrobe tab with owned items and a rotating 3D preview;
  rotation respects reduced-motion preferences. Shop conflicts refresh the local
  catalog and the main profile/balance.
- Owned talking styles have a picker and an explicit sample-line button. Picking
  a style only equips it. Only clicking the sample requests `/voice/lines`.
  Audio cleanup stops playback and releases blob URLs when leaving the panel.
- Offline fixtures use all 22 API-008 catalog entries and the dressed demo cast.
  Ownership persists separately from active slots; replacing a slot preserves
  other slots and other villagers. Both dogs require backyard ownership and the
  shelter. Missing models retain procedural villagers/cosmetics and usable UI.
  Mock voice samples are scripted text and never call a voice provider.

## Files changed

All paths below are relative to `apps/web/`:

- `src/api/client.ts`, `types.ts`, `equipment.ts`, `fixtures.ts`, `mock.ts`,
  `world.ts`: payloads, catalog, inventory, outfit fixtures and offline shelter.
- `src/components/Wardrobe.tsx`, `Modals.tsx`, `ProfilePanel.tsx`,
  `Onboarding.tsx`, `src/styles.css`: shop, wardrobe, preview and style controls.
- `src/scene/Cosmetics.tsx`, `cosmeticAssets.ts`, `OptionalModel.tsx`,
  `VillageScene.tsx`, `headAssets.ts`: clone-local attachments, fitting, cleanup,
  outfit rendering and head-change notification.
- `src/api/equipment.test.ts`, `mock.test.ts`,
  `src/scene/cosmeticAssets.test.ts`, `tests/equipment.spec.ts`,
  `tests/village.spec.ts`, `tests/real.spec.ts`: unit/browser coverage and current
  catalog expectations.
- `package.json`, `playwright.config.ts`: include the new tests in normal suites.
- `WEB-010-REPORT.md`: this handoff.

## Verification

Commands ran from `apps/web` unless noted. Final completed runs:

| Command | Exit | Result |
| --- | --- | --- |
| `bun install` | 0 | Installed existing lockfile; no dependency or lockfile changes |
| `bun run typecheck` | 0 | Clean |
| `bun run test` | 0 | 32 tests; 214 assertions passed |
| `bun run build` | 0 | Production bundle built |
| `bunx playwright test --project=mock tests/equipment.spec.ts` | 0 | 2 passed |
| `bun run test:e2e` | 0 | All 35 browser tests passed |
| `bunx playwright test --config playwright.real.config.ts --grep WEB-010` | 0 | 1 passed; API available; no skips or mutations |
| `git diff --check` (repository root) | 0 | Clean |
| `git diff --cached --check` (repository root) | 0 | Clean before implementation commits |

New tests exercise slot replacement, retained ownership, user/village isolation,
both pet gates, voice-slot replacement, per-clone materials/bones, head bounds,
head replacement, shop/wardrobe equip and unequip, explicit-only voice requests,
and all-models-offline behavior. The browser test inspects the actual R3F scene:
the equipped cap must contain drawable meshes under the owner's Head bone and
must be absent from the neighbor. Live verification waits for ready generated
heads and captures the dressed plaza without changing API state.

Earlier runs are not counted as passing: initial typechecking needed dependency
installation; a new inventory test incorrectly assumed ownership would transfer
to a newly created village; the first full browser run found the missing conflict
refresh and had two failures during source hot reload. A subsequent intermediate
run was interrupted to correct the material rendering issue found in visual QA.
The final uninterrupted suite passed. Unit execution retains the existing
multiple-Three-instance warning; production build retains large chunk warnings.

Runtime-only live configuration used
`VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env` through the existing
Vite public-setting loader. No secrets, portraits, voice recordings, model files,
or environment files were copied or committed. No paid generation was requested.

Visually reviewed screenshots, local and ignored:

- `test-results/web010-plaza-real.png`: live dressed village overview.
- `test-results/web010-outfits-real.png`: zoomed live outfits with generated heads.
- `test-results/web010-wardrobe-mock.png`: glasses/headphones and rotating preview.
- `test-results/web010-plaza-mock.png`: fixture cast.
- `test-results/web010-offline-mock.png`: functional shop with every GLB unavailable.

Live screenshots contain portraits and intentionally remain uncommitted.
Pre-existing tracked screenshots regenerated by regression tests were restored.

## Teammate trial

From `apps/web`, run `bun install`, then in PowerShell:

```powershell
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
$env:VITE_DEMO_AUTH='1'
$env:VITE_MOCK='1'
bun run dev
```

Open http://localhost:5173/. In Shop, buy Village Cap, equip Headphones again,
then remove/re-equip Round Glasses. Other villagers and unrelated slots retain
their outfits. Open My profile > Wardrobe to rotate the preview and change owned
items. Select Hype coach or Natural voice; click Preview sample line to see the
scripted mock sample. Buy Pirate in Shop to add another picker option.

For the live dressed cast, set `VITE_MOCK='0'` with API :8010 running and choose
Hacklanta Crew. Live sample preview is an explicit provider action and was not
invoked by this verification. Zoom into the plaza to inspect the outfits.

## Choices, blockers and proposed contract changes

No implementation blockers. House unequip retains earned `house_level`; a dog
keeps its owner's backyard visible. Bought crowns do not grant weekly-winner
status. Legacy catalog entries with null mesh keys use generic slot geometry.
The offline shelter threshold is 1500 aggregate fixture XP; production unlocks
come from the API. The web fixture catalog now mirrors API-008 prices/names,
so older mock purchase expectations were updated.

Contracts were not edited. Integrator should adopt the API-008 shapes already
documented in `apps/api/API-008-REPORT.md`: `equipped` objects, `equipped_ids`,
slot/asset/voice-style metadata and both prerequisites on shop items, the two
inventory routes, and optional `village_id` on voice-line requests. No additional
server behavior or contract change is needed for this implementation.
