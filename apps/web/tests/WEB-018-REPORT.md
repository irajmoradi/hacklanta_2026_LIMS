# WEB-018 — Mayor's Plaza and personal houses

Branch: `web/WEB-018`. Implementation: `9d4ada4`. Browser/geometry verification and attachment corrections: `187367c`. Shared-runner test refinement: `aec863e`. The subsequent documentation commit contains this report.

The central plaza now assembles `mayor_podium`, `mayor_statue`, and `notice_board` at the ASSET-005 authored offsets, above the plaza paving. The podium and its keyboard-accessible label open Mayor announcements; the notice board and its label open the Gazette. The plaza retains the Mayor destination action used by event attendance. Only the festival district uses `festival_main_stage` and stage glow; its other props remain in place.

Merged all 18 ASSET-006 house entries into the catalog and regenerated TypeScript. Member houses use six styles and three palettes per style, selected deterministically from UTF-8 FNV-1a hashes of user IDs. Style uses the `:style` hash domain so both the offline and live five-user seed cohorts have five different styles, independent of member order or slot. Palette uses the unsuffixed hash. Explicit equipped `house_<style>` or `house_<style>_lv<n>` wins for style; house_level remains authoritative. Levels are floored and bounded to 1–5; levels 4–5 use `house_lv4/5` as requested, overriding the asset document's suggestion to reuse style level 3.

New houses preserve authored origins and use a shared 2.2x lot scale. Material instances are cloned and the five house channels are matched by material name, so tinting cannot change another member's house or its glass/plant details. Missing assets retain procedural houses and functional nameplates. House addresses, profile selection, and WEB-016 home schedules are preserved.

Solar panels follow each roof's pitch and sit toward the front, clear of rear chimneys/vents. Cottage clearance includes raised thatch. Porch, sign, gnome and backyard attachments have compact-house offsets; backyard fences clear the rear deck. Upper legacy tiers transform those placements using the measured GLB envelopes and their fitted Tudor/beach architecture. Geometry tests read the actual 18 style GLBs plus the two upper legacy tiers and raycast the roof under panel samples, also checking chimney/vent separation.

Files changed:

- `apps/web/src/App.tsx`: Gazette callback.
- `apps/web/src/scene/{GridTown,MayorPlaza,OptionalModel,TownDistricts,VillageScene}.tsx`: assembly, authored transforms, palette isolation, attachments and interaction.
- `apps/web/src/scene/{catalog.fallback.json,housePalettes.json,houseStyles.ts,houseStyles.test.ts}`: placement metadata, palettes, selection and tests.
- `apps/web/package.json`: include house tests in the standard unit command.
- `apps/web/tests/{web018.config.ts,web018.spec.ts,web018-real.mjs,WEB-018-REPORT.md}`: isolated browser smoke, live capture and report.
- `packages/catalog/{catalog.json,dist/catalog.ts,validate.test.ts}`: 18 new entries and updated inventory assertion.

Verification (web commands run from `apps/web`, catalog commands from `packages/catalog`):

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` in each package | 0 | Dependencies installed; lockfiles unchanged |
| `bun run validate` in catalog | 0 | 160 entries; TypeScript regenerated |
| `bun test` in catalog | 0 | 23 passed |
| `bun test src` | 0 | 68 passed, 3,519 assertions |
| `bun run typecheck` | 0 | TypeScript checked during initial implementation |
| `bun run build` | 0 | Production build; existing large-chunk warning |
| `bunx playwright test --config tests/web018.config.ts` | 0 | 3 passed: loaded assets/plaza/Gazette plus WEB-016 desktop/mobile with all models offline |
| `bunx playwright test --config playwright.web016-regression.config.ts` | 0 | All 51 passed in 13.7 minutes; authentication, avatars, equipment, mobile, profile, settings and recovery regressions |
| `node tests/web018-real.mjs` | 0 | Live API; front/back of five houses, plaza, Gazette; no browser errors |
| `git diff --check` | 0 | No whitespace errors |

During development, `bun run build` exited 1 after finding an ES2023 array method in a test; replaced with ES2022-compatible copying/reversal. The initial targeted Playwright run exited 1 because the smoke used the wrong close-button name; it now exercises Escape. `bun test src/scene/houseStyles.test.ts` initially exited 1 when roof raycasts caught cottage thatch clipping, corrected with clearance. A `bun test src` rerun exited 1 under concurrent browser load when the geometry test exceeded its default five-second timeout; duplicate legacy loads were removed and that disk-reading test has a 30-second timeout. Final reruns above passed. Early runner setup commands failed on Windows text encoding and a wrong working directory; corrected before verification. Tracked screenshots overwritten by unrelated regression cases were restored.

Live screenshots are local, uncommitted artifacts because they include real profile photos:

- `apps/web/test-results/web018/real-overview.png`
- `apps/web/test-results/web018/real-house-{0,1,2,3,4}-{front,back}.png`
- `apps/web/test-results/web018/real-plaza.png`
- `apps/web/test-results/web018/real-results.json`

Visually reviewed the civic assembly, Tudor, cottage, beach, modern and townhouse views, including rear AC units, doors, decks and backyard attachment. The live capture uses actual API data, blocks API mutations, and reads the existing development renderer store to position the camera. It does not add production debug hooks.

Try it: from `apps/web`, set `VITE_MOCK=1` and `VITE_DEMO_AUTH=1`, then run `bun run dev --port 5396`. Compare the five homes; click a home/nameplate to open its owner, and click the Gazette board or Mayor's Plaza label. For live mode set `VILLAGE_ENV_FILE` to the shared env at runtime, `VITE_MOCK=0`, `VITE_DEMO_AUTH=1`, and run on port 5398 (API defaults to localhost:8010). Run `node tests/web018-real.mjs`; `WEB018_URL` can override the capture URL. No secrets were copied into this worktree and no paid generation was requested.

Blockers: none. Proposed HTTP/DB contract changes: none. No pushes or merges. Only allowed web/catalog paths were edited; task records and other apps were left untouched.
