# WEB-011 handoff

Branch: `web/WEB-011`. Implementation commit: `e7c93f1`; the verification commit contains this report and final refinements. No push or merge.

## Delivered

- A deterministic 9 x 7 rectangular town: 4 m road tiles, 16 m block pitch, 8 x 8 m building lots, main street, cross streets, sidewalks, zebra crossings, streetlights, and layered terrain edges. Residential, commercial, central civic, festival, and edge park/lake districts are distinct. Residential vacancies have for-sale signs.
- Member addresses remain seed-stable as people join. Complete residential rows expand capacity beyond 27 members; exhausted building districts also receive additional rows. Catalog order preserves existing allocations when entries are appended.
- `registry.ts` uses a Vite eager relative glob for `../../../../packages/catalog/dist/catalog.ts`. When absent, the checked-in `catalog.fallback.json` supplies the scene. The adapter accepts default/catalog/CATALOG exports, entries/items arrays, and building arrays. Shared records override fallback fields, preserving unspecified scene hints. New building entries automatically occupy their district (commercial by default).
- Building asset names, sizes, colors, attachment offsets/rotations/scales, and unlock requirements come from registry data. Houses support levels 1 through 5 and variants; equipped house upgrades use their catalog attachment data. Missing or invalid GLBs retain procedural geometry and retry without a reload.
- Sidewalk graph A* routes between home and goal-related hangouts, the civic square, and festival stage. Morning and ordinary nights use home, afternoons use hangouts, evenings use the plaza, and festival nights use the stage. Goal title/detail are read through the existing profile endpoint; catalog tags also match names/status when goal data is unavailable. This needs no contract change or paid generation.
- Wider orthographic framing, bounded panning, eased zoom, selection tracking, and reset. Roads, sidewalks, crossings, streetlights, signs, trees, hedges, and bus stops are instanced, including loaded kit meshes. Static procedural building parts are merged per lot. The existing adaptive governor reduces effects below a sustained 50 fps.
- Existing avatar heads, wardrobe, dogs, crowns, profile selection, authenticated media, and model retry behavior remain covered. Labels pause movement on hover and use pixel-aligned/staggered screen positions to stay clickable.

## Files

All implementation files are under `apps/web/src/scene/`:

- New: `GridTown.tsx`, `catalog.fallback.json`, `registry.ts`, `registryData.ts`, `registryData.test.ts`, `layout/town.ts`, `layout/navigation.ts`, `layout/town.test.ts`, `.gitignore`, this report.
- Updated: `VillageScene.tsx`, `TownCamera.tsx`, `TownDistricts.tsx` (export reusable procedural wheel/fountain/lights), `worldTypes.ts` (accept object-form unlock IDs).
- Browser coverage: `apps/web/tests/scene.spec.ts`, `scene.regression.config.spec.ts`, `scene.town.spec.ts`, `scene.town.config.spec.ts`.

Tests regenerated some tracked screenshots outside the allowed paths; those generated changes were restored. Only authorized scene source and scene test files are included in commits. Real-mode screenshots are local and git-ignored because the live UI includes profile photos.

## Validation

Commands below run from `apps/web` except `git diff --check` at the repository root.

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` | 0 | Existing dependencies installed; no manifest/lockfile changes |
| `bun run build` | 0 | TypeScript and production bundle; existing large-chunk warning |
| `bun run test` | 0 | 32 existing unit tests passed |
| `bun test src/scene/layout/town.test.ts src/scene/registryData.test.ts src/scene/worldTypes.test.ts` | 0 | 12 tests, 4,318 assertions; determinism, growth, free-lot allocation, gates, import normalization, A*, schedules, legacy world helpers |
| `$env:SCENE_HARDWARE='1'; bunx playwright test --config tests/scene.config.spec.ts` | 0 | Four browser tests: day/night offline GLBs, late model arrival, explicit locked-building gates; approximately 139/144 fps |
| `bunx playwright test --config tests/scene.regression.config.spec.ts` | 1 | 32/35 passed, including Auth0. Clickability was fixed; two request/cache failures occurred while scene modules were being hot-reloaded |
| `$env:SCENE_SKIP_AUTH='1'; bunx playwright test --config tests/scene.regression.config.spec.ts --grep 'missing or malformed\|bearer transport\|authenticated heads'` | 0 | All three failed cases passed on an unchanged build; no test assertions relaxed |
| `$env:SCENE_HARDWARE='1'; bunx playwright test --config tests/scene.town.config.spec.ts` | 0 | Initial real-mode day/night run passed with five live villagers |
| Same real-mode command after final layout refinements | 1 | Day passed at 141.8 fps; night exceeded the original five-second live API wait |
| `$env:SCENE_HARDWARE='1'; bunx playwright test --config tests/scene.town.config.spec.ts --grep night` | 0 | Night passed after allowing 30 seconds for the actual API; captured final night layout |
| `git diff --check` | 0 | Clean |

Initial failures also included missing local dependencies, obsolete scene-test unlock setup, and oversized orthographic HTML labels; these were resolved before successful checks. A targeted regression rerun initially could not start because another process occupied the shared Auth0 test port 5177. `SCENE_SKIP_AUTH=1` omits that server/project; the earlier full run already passed Auth0.

Frame-rate measurements are foreground browser RAF samples on this machine's NVIDIA RTX 5090 / Direct3D11 at 1920 x 1080, not a guarantee for mobile hardware. Screenshots were visually inspected. Live tests read the real API, overriding only response time/weather for repeatable lighting; they do not mutate server state or invoke generation.

## Try it

From `apps/web`, run `bun run dev --port 5198` and open `http://localhost:5198`. Offline fixtures work automatically. For the live seeded village, use the same public environment values as `tests/scene.town.config.spec.ts`; the existing Vite configuration reads public values from `VILLAGE_ENV_FILE` at runtime. No secrets were copied or printed.

Drag to orbit, right-drag to pan, scroll to zoom, and use Reset camera. Click a villager or the existing profile controls. To add content, append an entry with `kind: building`, `asset.glb`, and `placement.district` to the shared catalog and rebuild; the district allocates a lot automatically. To add a house upgrade, provide `placement.role: attachment`, `placement.size`, and `asset.attach` with anchor/offset/rotation/scale.

Local screenshots:

- `apps/web/src/scene/artifacts/web011-real-day.png`
- `apps/web/src/scene/artifacts/web011-real-night.png`

## Integration notes / blockers

No blocking issue remains. ARCH-001's generated catalog and ASSET-003's new GLBs were absent in this worktree, so their real exports/geometry could not be verified here. The fallback keeps the town working until those branches arrive. Rebuild Vite after adding the generated catalog (its optional import is discovered at build time).

Proposed shared-catalog scene hints: `placement: {district, role, size, color, shape, action, level, variant}`; `unlock: {id?, village_level?}`; house upgrades use `asset.attach`. The API's string-or-object `world.unlocked` shape is supported. No HTTP/database contract edits are proposed. Legacy radial helpers remain exported for compatibility and their existing tests; the live scene uses `layout/` exclusively.
