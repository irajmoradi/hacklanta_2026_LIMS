# FIX-004 — generated-head cosmetic anchors

Branch: `fix/FIX-004`. Implementation commit: `29a623e` (`fix(web): keep generated heads and cosmetics on the body skeleton`). The follow-up test/report commit is the branch tip.

## Cause and fix

The live Iraj outfit includes `shirt_hoodie`, whose GLB has a second skeleton. `attachHead` traversed every bone and retained the **last** `Head`, including the hoodie's bone. Cosmetics used the **first** `Head`. Browser inspection reproduced the split: the generated head was about 0.615 world units above the bone carrying the glasses and headphones, in both town and Outfit preview.

Both systems now resolve body anchors with a shared traversal that excludes cosmetic and generated-head subtrees. Base face meshes are hidden only on the owning body, with original visibility restored on detach. Generated-head geometry is the authoritative measurement, transformed into body Head-bone coordinates. Glasses use a 55% eye line, hats use the top, and head cosmetics scale by measured head width / the assets' authored 0.72 reference width. The existing `headchange` event refits mounted cosmetics after asynchronous head loading and removal.

Cosmetics retain their source model transforms inside a fitting group. The real headphones GLB loads its headband, cushions and shells; it is not replaced by a box. Offline headphones have an explicit band-and-cups fallback. Town, Profile Outfit and Wardrobe all use the same corrected `OptionalModel` attachment path.

## Files changed

- `src/scene/rigAnchors.ts`: body-only bone lookup.
- `src/scene/headAssets.ts`: consistent anchor, scoped base-head hiding and generated-head marker lifecycle.
- `src/scene/cosmeticAssets.ts`: authoritative bounds, anchor computation, authored transforms and headphones fallback.
- `src/scene/cosmeticAssets.test.ts`: anchor math, duplicate hoodie skeleton/load/detach regression and model transform coverage.
- `playwright.fix004.config.ts`, `tests/fix004-real.spec.ts`, `tests/fix004-inspect.ts`: real-API coverage and deterministic front/side captures of the actual React views.
- `FIX-004-REPORT.md`: this report.

## Validation

Commands run from `apps/web`:

- `bun test src/scene/cosmeticAssets.test.ts src/scene/generatedHead.test.ts` — exit 0; 6 passed, 63 assertions.
- `bun run typecheck` — exit 0.
- `bun run test` — exit 0; 44 passed, 761 assertions. Existing multiple-Three.js-instance warning remains.
- `bun run build` — exit 0; production bundle built. Existing large-chunk warning remains.
- `bunx playwright test --config playwright.fix004.config.ts` — exit 0; live API, five generated heads, original head meshes hidden, cosmetics sharing the generated-head bone, actual headphones meshes, Outfit and Wardrobe screenshots. The first automated attempt used a 5-second asset readiness timeout and failed; the test now waits up to 60 seconds for real assets instead of assuming warm caches.
- `git diff --check` — exit 0.

Screenshots were visually reviewed locally under `apps/web/test-results/fix004/`:

- `town-real.png`
- `iraj-outfit-front.png`, `iraj-outfit-side.png`
- `iraj-wardrobe-front.png`, `iraj-wardrobe-side.png`
- `stefanny-outfit-front.png`, `stefanny-outfit-side.png`

The images show glasses on Iraj's face, headphones around the sides/top of his head, and Stefanny's crown above her hair. Screenshot artifacts are ignored and not committed; the town UI includes real profile photos. No photos, generated head files, secrets, or voice files were added to Git.

## Try it

With the seeded real API running on `127.0.0.1:8010` and `VILLAGE_ENV_FILE` pointing at the supplied root environment file, run `bunx playwright test --config playwright.fix004.config.ts`. The test starts this worktree's frontend on port 5294 in real mode, uses the existing Iraj/Stefanny equipment, and writes the screenshots above. No equipment purchases or generation jobs are needed.

For manual inspection, start `bun run dev` with `VITE_MOCK=0`, `VITE_DEMO_AUTH=1` and the seeded village/user IDs from the test configuration. Open Iraj's profile, scroll to Outfit, then select Wardrobe. Open Stefanny's profile and inspect Outfit. Watch the same cosmetics in town.

## Choices and limits

Used the requested bounding-box approximation (55% eye line) rather than adding per-person facial landmarks. Retained the existing authored 0.72 model reference width and hat/headphone top offsets. No GPU or paid generation calls were made; the running API's existing assets were used read-only for inspection. No contract changes or blockers.
