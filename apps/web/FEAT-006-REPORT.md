# FEAT-006 — outfits and wearable palettes

Branch: `feat/FEAT-006`.

Milestones: `2d1d831` (assets/catalog), `dcfcda3` (API/migration/contract),
`ec5a9a0` (web/palette tests/screenshots). The final verification commit contains
this report and the remaining catalog compatibility assertions.

Delivered sixteen original, procedural GLBs: hoodie, sweater, tee, flannel,
overalls, varsity jacket, beanie, bucket hat, beret, bow, flower crown, sunhat,
earmuffs, backpack, tote, and bandana. Each exposes `primary`, `secondary`, and
`accent`, has a registry attachment, shop tag, rarity, and a 40–190 XP price.
Triangle counts range from 100 to 1,088. Tops rebind to the live avatar's bones.

Owned clothing palettes persist on inventory rows. The owner-only PATCH route
validates exact six-digit hex strings, normalizes case, rejects extra fields,
and preserves palettes across equipment changes. Other village members receive
the colors in equipped projections. The wardrobe has sixteen cozy swatches,
three presets for every item, channel selection, custom hex validation, local
rotating preview, Save and Cancel. Shared rendering applies material colors in
the village and profile showcase; portrait backgrounds in name tags follow the
equipped torso primary color. Existing clothing uses legacy material aliases.

Choices: use existing slots; bottoms are unsupported. Backpack/tote replace
the torso item, bandana uses neck. All items share the same three cozy presets.
Selecting a palette never purchases or equips an item. Missing assets use
procedural geometry, including when only the base avatar fails to load.
Photo-derived custom items keep their separate API. No paid provider calls,
transactions, or external messages were made. Secrets were loaded only at
runtime via `VILLAGE_ENV_FILE`; none were copied into artifacts.

## Files changed

- `assets/blender/outfits.py`, `assets/outfits_spec.py`: deterministic geometry
  and collection metadata; `assets/blender/preview.py`: collection fit renderer.
- `apps/web/public/models/outfit_*.glb`: all sixteen clothing models.
- `assets/check_glb.py`, `assets/catalog.py`, `assets/CATALOG.md`: material,
  skinning and triangle validation plus catalog documentation.
- `packages/catalog/catalog.json`, `dist/catalog.ts`, `validate.test.ts`:
  registry, generated export, updated catalog-size assertion.
- `apps/api/app/item_colors.py`, `main.py`, `domain.py`,
  `migrations/019_item_colors.sql`: persistence, validation, route and projections.
- `apps/api/tests/test_item_colors.py`, `test_api.py`, `test_api008.py`:
  authorization, persistence, validation, and compatibility assertions.
- `apps/api/tests/test_arch003.py`, `test_catalog_registry.py`: replace stale
  catalog-size expectations with current registry-backed values.
- `packages/contracts/api.md`: request/response/error/migration documentation.
- `apps/web/src/api/{client,equipment,mock,types}.ts`, `itemColors.test.ts`:
  typed client, registry-backed mock clothing and palette persistence.
- `apps/web/src/components/{Wardrobe,ItemColorPanel,shared}.tsx`,
  `src/styles.css`: wardrobe UI and name-tag portraits.
- `apps/web/src/scene/{Cosmetics,cosmeticAssets,itemColors}.ts[x]`,
  `itemColors.test.ts`: cloned material tinting, skeleton binding, fallback.
- `apps/web/tests/colors.spec.ts`, `playwright.config.ts`, `package.json`:
  browser scenarios and registered tests.
- `assets/previews/outfits_fit.png`, `feat006-wardrobe-mock.png`,
  `feat006-village-mock.png`, `feat006-offline-mock.png`: reviewed screenshots.

## Verification

Commands were run from the repository root unless noted. Database tests read
`VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env` and use the harness's
isolated schema in `village_test`, with generation providers mocked.

| Command | Result / exit |
| --- | --- |
| Blender 5.2 `--background --python-exit-code 1 --python assets/blender/outfits.py` | 16 GLBs generated; 0 |
| Blender 5.2 `--background --python-exit-code 1 --python assets/blender/preview.py -- --outfits` | Fit contact sheet rendered; 0 |
| `python assets/check_glb.py` | 172 GLBs; 0 failures; 0 |
| `python assets/test_check_glb.py` | 24 passed; 0 |
| `bun run --cwd packages/catalog validate` | 177 entries; 0 |
| `bun test --cwd packages/catalog` | 23 passed; 0 |
| `python -m uv run --directory apps/api pytest tests/test_item_colors.py tests/test_api.py::test_seed_and_contract -q` | 9 passed; 0 |
| `python -m uv run --directory apps/api pytest tests/test_api008.py::test_catalog_and_slot_replacement -q` | 1 passed; 0 |
| `bun run --cwd apps/web build` | Production build passed; 0; existing chunk-size warning |
| `bun run --cwd apps/web test` | 44 passed; 0 |
| `bun run --cwd apps/web test:e2e colors.spec.ts equipment.spec.ts --project=mock` | 5 passed; 0 |
| `bun run --cwd apps/web test:e2e colors.spec.ts --project=mock` | Final rerun: 3 passed; 0 |
| `python -m uv run --directory apps/api pytest -q` | Initial broad run: 286 passed, 2 skipped, 7 failed; 1 |
| `python -m uv run --directory apps/api pytest --lf -q --tb=short --basetemp=.runtime/pytest-feat006-final` | All 7 broad-run failures pass after fixes; 0 |
| `python -m uv run --directory apps/api pytest tests/test_catalog_registry.py tests/test_arch003.py -q` | 29 assertions/tests passed, 1 connection-timeout teardown error; 1 |
| `python -m uv run --directory apps/api pytest tests/test_arch003.py::test_new_supported_voice_projection_and_contract_blocker -q --tb=short --basetemp=.runtime/pytest-feat006-cleanup` | Cleanup retry: 1 passed; 0 |
| `python -m uv run --directory apps/api ruff check app/item_colors.py app/main.py app/domain.py tests/test_item_colors.py tests/test_api.py tests/test_api008.py tests/test_catalog_registry.py tests/test_arch003.py` | Passed; 0 |
| `git diff --check` | Passed; 0 |

Browser tests inspect actual Three material colors, preview-before-save,
invalid hex, cancellation, persistence through equipment changes, all models
offline, base-only failure, and name-tag color. The six-top unit test loads the
real GLBs and verifies deformation when the living avatar's arm bones move.
Screenshots are actual browser renders using the deterministic mock village.

Initial checks caught old fixed catalog counts, the new equipped `colors` field
missing from an exact-response assertion, a default denim tint regression, and
a test-only TypeScript bone type mismatch. These were corrected and the affected
checks rerun. A first Playwright command used the wrong option ordering; the
commands in the table use the working syntax.

The broad run had six stale catalog/equipment assertions and one demo-evidence
404 during overlapping pytest executions sharing the default temporary directory.
All seven passed on the serial retry with a separate temporary directory. A
separate registry run's database cleanup connection timed out; that exact test
passed on retry. No failed checks remain unresolved. The full suite was not
rerun wholesale after those corrections: 286 originally passing tests plus the
seven corrected/retried tests account for all 293 non-skipped cases.

## Teammate trial

Offline: `bun install --cwd apps/web`, then set `VITE_MOCK=1` and run
`bun run --cwd apps/web dev`. Open Shop, buy Cozy Hoodie (40 XP), open My profile
→ Wardrobe → Cozy Hoodie → Choose colors. Pick a preset or hex, inspect the
rotating preview, save, then unequip/re-equip. The village and profile retain it.

API rollout: with `VILLAGE_ENV_FILE` pointing to the shared environment, run
`python -m uv run --directory apps/api python scripts/migrate.py`, then
`python -m uv run --directory apps/api python scripts/sync_catalog.py` against
the intended development database. Restart the API and start the web normally.
The task itself applies migrations only through isolated test fixtures.

No pending contract proposal: `api.md` is updated within this task's allowed
paths. Deployment requires the additive migration before the updated API runs.

Blockers: none. The shared development database is not migrated/deployed by this task.
