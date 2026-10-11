# FIX-005 handoff

Branch: `fix/FIX-005`. Implementation commit: `a0a461e`; the following QA/report commit completes the task.

Generated heads now normalize uniformly to 1.05 times the measured base face height. The fitter measures skinned sibling meshes in Head-bone space, centers the head in X/Z, and seats its bottom on the body's neck with a 1% base-head-height overlap to seal sloped mesh bottoms. Detaching restores the original transform and preset visibility.

The generated-head frame uses the loaded mesh bounds and +Z front direction. Ear points sit at half height on the two X bounds. For texture-baked heads without named landmarks, a narrow central anterior surface estimates the nose; the eye line is 12% of head height above it, bounded to 43–58% height. The anterior eye band estimates face width, excluding broad rear hair. These are geometric estimates, not face recognition or new CV generation.

Glasses span 0.9 times face width and inset from the front surface. Headphones use authored cushion centers to align both ears, with the band clearing the crown by 4% of head height. Hats span 1.08 times head width, tilt forward 0.08 radians, and seat 18% into the crown. Existing preset/card behavior remains intact. No GLB assets were edited, leaving the parallel ASSET-007 headphone remodel independent.

Catalog entries accept optional `fit.generated.offset` and `fit.generated.scale` triples. Offset uses fractions of head width/height/depth; scale multiplies the slot fit. Round glasses demonstrate a further 2% depth inset. Overrides resolve locally by item ID, including real API equipment, without changing HTTP contracts. Catalog validation rejects malformed vectors and nonpositive scales.

## Files changed

- `src/scene/headFit.ts`: shared bounds, landmarks and normalization math.
- `src/scene/headAssets.ts`: head normalization, neck seating, cached frame and restoration.
- `src/scene/cosmeticAssets.ts`: generated-head slot fitting and catalog overrides.
- `src/scene/generatedHead.test.ts`, `src/scene/cosmeticAssets.test.ts`: geometry, rotated/scaled rigs, restoration, fitting, overrides and idempotence tests.
- `../../packages/catalog/catalog.schema.json`, `catalog.json`, `dist/catalog.ts`, `validate.test.ts`: optional fit metadata, generated types and validation tests.
- `playwright.fix005.config.ts`, `tests/fix005.html`, `tests/fix005-review.ts`, `tests/fix005-real.spec.ts`: read-only visual regression harness using production loading and attachment functions.
- `FIX-005-REPORT.md`: this report.

## Validation

All commands below finished with exit code **0**. Web commands run from `apps/web`; catalog commands run from `packages/catalog`.

| Directory | Command | Result |
| --- | --- | --- |
| web | `bun run test` | 59 tests passed across 15 files; subsequently added tests covered by the targeted run below |
| web | `bun test src/scene/generatedHead.test.ts src/scene/cosmeticAssets.test.ts` | Final 11 tests passed, 90 assertions |
| catalog | `bun run validate` | 168 entries validated; types regenerated |
| catalog | `bun test` | 26 tests passed |
| web | `bun run typecheck` | Passed |
| web | `bun run build` | Passed; Vite reports large-chunk advisory |
| web | `bunx playwright test --config playwright.fix005.config.ts` | Passed: 4 real heads × 14 catalog head/face entries × 3 views |
| web | `bunx playwright test tests/equipment.spec.ts --project mock --grep 'every model offline'` | Passed with all model requests returning 404 |
| root | `git diff --check` | Passed |

Initial geometry tests expected the old unnormalized size; these were updated to assert the new fitting requirements. Initial typecheck lacked the pot component's local dependencies; its existing `npm ci --prefix src/components/pot --install-links --no-audit --no-fund` setup resolved that without source changes.

## Screenshots and review

Local ignored artifacts: `apps/web/test-results/fix005/`. Each `{iraj,lance,stefanny,mario}-{item_id}.png` contains labeled front, side and back views: **56 PNGs, 168 views**. Every triptych was reviewed in the four `{name}-contact.jpg` sheets. `measurements.json` records fitted bounds and neck gaps. Real heads measured 0.756 units high; neck overlap was approximately 0.0072 units. Images contain generated likenesses and remain uncommitted.

Reviewed all 14 entries: `hat_beanie`, `hat_cowboy`, `hat_crown`, `hat_cap`, `hat_festival`, `hat_headphones`, `glasses_round`, `hat_beret`, `hat_party`, `glasses_sun`, `perfect_week_halo`, `auditor_badge`, `festival_vip`, `competition_laurels`.

To reproduce, use the existing API at `http://127.0.0.1:8010` with the four demo avatar GLBs available, retain `VILLAGE_ENV_FILE` pointing to the shared environment file, and run the FIX-005 Playwright command above. Set `VILLAGE_API_URL` if the API uses another address. The harness blocks API mutations and reads only avatar manifests/assets; it does not equip, buy, upload, generate, or alter saved outfits. Screenshots are regenerated automatically. The unit and offline browser checks do not require the GPU worker.

## Limitations and proposed contract changes

No implementation blocker and no proposed contract changes. The existing village and profile GET endpoints returned HTTP 500 during this run, so full live-town/profile interaction could not be verified. Avatar manifest and protected asset GET endpoints worked; all real-head views use those endpoints and the same production fit functions. Offline app interaction passed separately.

Iraj, Stefanny and Mario's generated meshes already include eyewear. Equipping another pair overlays that baked geometry; removing baked eyewear requires a separate asset/CV change. The head landmark estimates cannot guarantee exact anatomy for every future hairstyle. Hat shapes and the current segmented headphone band are authored assets; ASSET-007 can replace the headphones without a fitting-code merge conflict provided it retains +Z front and named `ear_cushion` meshes.
