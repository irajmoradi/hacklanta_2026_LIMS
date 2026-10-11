# WEB-020 handoff

Branch: `web/WEB-020`.
Milestones: `92058e4` (API persistence/contract), `8caf96c` (editor/mock/scene).
The final commit adds this report, reviewed browser screenshots and mobile swatch sizing.

## Delivered

- Per-membership nullable house style and complete five-part lowercase hex palette,
  saved through the existing authenticated `PATCH /me`. Explicit village scope,
  membership authorization, partial-update semantics and null resets.
- Idempotent migration `apps/api/migrations/014_house_colors.sql`. Village and
  person responses expose both appearance fields. Existing account settings remain compatible.
- My profile / own-house profile → House: six architectural thumbnails, three presets,
  16 cozy colors, five paint targets, custom hex validation, rotating model preview,
  explicit Save, busy/error/success states, and automatic style/palette resets.
- Saved appearance feeds the existing isolated named-material clone path. Save refetches
  the village immediately; visible clients refetch every 15 seconds. Mock mode implements
  the same membership scope and starts new memberships with automatic appearance.
- No provider calls, generated assets, real photos, voice assets or secret files added.

## Choices and limits

- All six styles are available at every earned house level; this is a cosmetic editor,
  not a level purchase mechanism. The UI lists earned/locked levels and cannot change them.
- Preserve WEB-018's legacy grand-house geometry at levels 4–5, including attachment
  positions. Style selects their preset colors; custom colors still override materials.
- Mock data persists within the current tab/session, following the existing mock architecture.
- Remote clients see changes on their next refetch (up to 15 seconds), not a WebSocket push.
- Screenshots are real Chromium captures using fixture identities; API persistence was
  tested separately against the isolated `village_test` database. Production DB was not migrated.

## Validation

Commands run from the corresponding app directory:

| Command | Result | Exit |
| --- | --- | --- |
| `bun run build` | Production build passed; existing large-chunk warning | 0 |
| `bun run test` | 42 passed, 767 assertions on final unit run | 0 |
| `bun run typecheck` | Passed | 0 |
| `bun run test:e2e tests/house.spec.ts --project=mock` | Two browser scenarios: save/reopen/reset/mobile and no model assets | 0 |
| `python -m uv run pytest tests/test_house_colors.py -q --tb=short` | 8 passed | 0 |
| `python -m uv run pytest tests/test_api.py tests/test_api007.py tests/test_house_colors.py -q --tb=short` | 53 passed | 0 |
| `python -m uv run ruff check app/models.py app/main.py app/domain.py tests/test_house_colors.py` | Passed | 0 |
| `git diff --check` | Passed | 0 |

API commands used `VILLAGE_ENV_FILE` at runtime. The test fixtures create an isolated
schema in `village_test`, disable live providers, then remove the schema.
An initial Ruff line-length failure was fixed with formatting. An initial Playwright CLI
argument failure was corrected; a viewport-transition test race was fixed by waiting
for the mobile dialog. Screenshot review found and fixed mobile swatch overflow.

## Screenshots

- `apps/web/artifacts/web020-house-desktop.png`
- `apps/web/artifacts/web020-house-mobile.png`
- `apps/web/artifacts/web020-house-colors.png`

## Try it

Offline, in PowerShell from `apps/web`:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev
```

Open the displayed URL → My profile (or your house nameplate) → House. Select Beach,
choose a preset, select Roof, enter `#69566b`, Apply hex, Save house. Close and reopen
the House tab to verify the saved choices. Automatic controls restore the seeded appearance.

For the API, use the existing app startup and migration workflow, with
`VILLAGE_ENV_FILE` pointing at the shared environment file. From `apps/api`, apply
`python -m uv run python scripts/migrate.py` before serving the updated API.

## Files changed

- API: `app/domain.py`, `app/main.py`, `app/models.py`,
  `migrations/014_house_colors.sql`, `tests/test_house_colors.py`.
- Contract: `packages/contracts/api.md` (authorized extension documented).
- Web: `package.json`, `playwright.config.ts`, `src/App.tsx`,
  `src/api/{client,mock,types}.ts`, `src/api/house.test.ts`,
  `src/components/{HouseEditor,ProfilePanel}.tsx`, `src/components/houseEditor.css`,
  `src/scene/{VillageScene.tsx,houseStyles.ts}`, `tests/house.spec.ts`,
  this report and the three screenshot artifacts.

Blockers: none. Proposed additional contract changes: none.
