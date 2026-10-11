# FEAT-002 — Villager-gram

Branch: `feat/FEAT-002`. Implementation milestone: `9cb9675`.
The subsequent verification commit contains this report, the preview screenshot,
updated catalog-count expectations, and shop-balance refresh after gram purchases.

## Result

Both permissions default off and are editable only through the user's own Settings.
The 150-XP consumable can be bought again after use, with a fresh ledger debit each
time. The shop filters speakers and recipients by permission, previews text and the
speaker portrait, and generates audio only on confirmed Send. No voice clone means
text + portrait. Queuing consumes the item, including dry runs; failed moderation
or synthesis leaves it owned. Options never disclose phone numbers.

The API checks membership, both permissions, phone availability, a cheap denylist,
and a strict LLM safety verdict through the existing Mayor adapter. Review failures
fail closed. Sorted user locks enforce global UTC limits (3 sent / 5 received);
retry UUIDs prevent duplicate generation and consumption. Uses appear in the speaker's
village feed. Revocation/phone changes cancel queued uses, STOP disables receiving,
and the agent rechecks consent immediately before transport. Account erasure removes
related gram records, audio, placeholder portraits, and voice-line records.
The older voice-line endpoint also enforces friend permission and logs the requester
and spoken line, preventing it from bypassing revocation; self-use remains available.

The agent uses Spectrum voice/image attachment builders and authenticated asset
fetches. `PHOTON_SEND_ENABLED` defaults false: rows become terminal `dry_run`, without
contacting recipient spaces or fetching assets; inbound replies/reactions are also
suppressed. Logs contain only IDs/status metadata. No real iMessages, provider
generation, or production migration was performed during this task.

## Files changed

- API: `app/villagergrams.py`, `migrations/014_villagergram.sql`, `app/main.py`,
  `app/models.py`, `app/domain.py`, `app/inbound.py`, `app/account.py`,
  `tests/test_feat002.py`, `tests/test_catalog_registry.py`, and this report.
- Web: `src/components/Villagergram.tsx`, `Modals.tsx`, `SettingsPanel.tsx`,
  `Wardrobe.tsx`; `src/api/types.ts`, `equipment.ts`, `mock.ts`;
  `tests/feat002.config.ts`, `tests/feat002.spec.ts`, `FEAT-002-preview.png`.
- iMessage: `src/agent.ts`, `agent.test.ts`, `config.ts`, `index.ts`,
  `scripts/simulate.ts`, `README.md`.
- Registry/contracts: `packages/catalog/catalog.json`, `catalog.schema.json`,
  `dist/catalog.ts`, `validate.test.ts`, `packages/contracts/api.md`.

## Verification

Python executable used: `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`
(called `$py` below), because `uv` was unavailable on PATH. Tests read the existing
`VILLAGE_ENV_FILE` at runtime and use isolated schemas in `village_test`. API fixtures
mock all moderation and voice calls; no credentials were copied or committed.
An existing catalog fixture printed its test database DSN in the failing pytest
traceback. Its fixture representation is now redacted; reruns also use `--tb=short`.

| Working directory | Actual command | Result / exit |
| --- | --- | --- |
| `apps/api` | `& $py -m pytest tests/test_feat002.py -q` | 8 passed; 0 |
| `apps/api` | `& $py -m pytest tests/test_feat002.py -q --tb=short` | Final run: 9 passed, including legacy consent bypass prevention; 0 |
| `apps/api` | `& $py -m pytest tests/test_feat002.py tests/test_api006.py tests/test_api010.py tests/test_catalog_registry.py -q` | 40 passed / 2 stale catalog-count assertions failed; 1. New feature, messaging, deletion and migration-replay cases passed. Counts corrected below. |
| `apps/api` | `& $py -m pytest tests/test_catalog_registry.py -q --tb=short` | 15 passed after correcting registry/shop counts; 0 |
| `apps/api` | `& $py scripts/sync_catalog.py --dry-run` | Valid: 143 content entries, 23 shop items, 6 event packs; 0 |
| `apps/api` | `& $py -m ruff check app/villagergrams.py tests/test_feat002.py app/account.py app/domain.py app/main.py app/models.py app/inbound.py --output-format concise` | All checks passed; 0 |
| `apps/imessage` | `bun test` | 11 passed; 0 |
| `apps/imessage` | `bun x tsc --noEmit` | Passed; 0 |
| `apps/web` | `bun run typecheck` | Passed; 0 |
| `apps/web` | `bun run test` | 35 passed; 0 |
| `apps/web` | `bun run build` | Passed; 0 (existing large-chunk warning) |
| `apps/web` | `bun x playwright test --config tests/feat002.config.ts` | 1 passed; 0, including final balance-refresh change |
| `packages/catalog` | `bun run validate`; `bun test` | Default directory: exit 1, pre-existing uncataloged `house_aframe_lv1.glb`; 21 passed / 2 failed |
| `packages/catalog` | same commands with `VILLAGE_CATALOG_MODEL_DIR` set to a temporary directory containing hardlinks to the 138 registry-referenced model files | 143 entries validated/types regenerated; 23 tests passed; both exit 0 |
| repository root | `git diff --check` | Passed; 0 |

The temporary hardlinks were removed after validation. The normal strict catalog
coverage check was not weakened. The registry previously contained 142 entries;
the Python test's older 138-entry assertion and Bun's 142-entry assertion now expect
143, including the new consumable. Fresh-worktree dependency errors were resolved
with `bun install --frozen-lockfile` in web, iMessage, and catalog (all exit 0).

Screenshot: [`apps/web/FEAT-002-preview.png`](../web/FEAT-002-preview.png).
Captured by Playwright and visually inspected; fixture initials only, no real portrait.

## Try it

1. In an environment with API dependencies installed, point `VILLAGE_ENV_FILE` to
   the existing external env file. From `apps/api`, run `python scripts/migrate.py`
   then `python scripts/sync_catalog.py` and start the API normally. These setup
   commands are for the integrator; this task only migrated the test database.
2. Start web. The speaker enables “Friends may use my avatar and AI voice for
   Villager-grams” in Settings. The recipient sets **their own** phone and enables
   “Receive Villager-grams on my phone.” Mayor permission is independent.
3. With at least 150 XP, open Shop, buy one Villager-gram, select the consenting
   speaker and recipient, enter a kind fictional line, Preview, then Confirm and
   send. Check the speaker's feed. With the agent switch unset, verify the row's
   `dry_run` status; the UI deliberately says “queued,” not “delivered.”
4. For a provider-free browser check, run the Playwright command above. The backend,
   phone, and delivery are synthetic. In the normal mock app, each demo identity
   must opt in through Settings; there are no implicitly opted-in real people.

## Owner-only live switch

After the owner has approved live messaging in the terminal and inspected pending
outbox rows, start/restart the agent from the repository root:

```powershell
$env:VILLAGE_ENV_FILE = 'C:/Users/mourn/Downloads/hacklanta/.env'
$env:PHOTON_SEND_ENABLED = 'true'
bun run --cwd apps/imessage start
```

Set `$env:PHOTON_SEND_ENABLED = 'false'` and restart to return to dry run. Runtime
variables override values loaded from the external env file. Dry-run rows never
automatically replay. This enables all agent delivery, including queued Mayor
messages; Photon recipient/line access must be configured by the owner.

## Choices, limitations, contracts

- Optional LAM clip generation was omitted; portrait + audio works with GPU offline.
- UTC calendar-day limits; one held token at a time; no refund after successful
  queueing (including cancellation or dry run). These choices are visible in UI/docs.
- Live Photon delivery, real cloned speech, and real LLM moderation were deliberately
  untested. Existing outbox crash recovery is not exactly-once transport, and consent
  revocation cannot recall a message already handed to Photon.
- The full-directory catalog coverage issue predates this item. Integrator should
  register the extra shipped models or decide on coverage policy separately.
- Allowed `packages/contracts/api.md` is updated. Proposed upstream schema change:
  fold `014_villagergram.sql` into integrator-owned `schema.sql`; that file was not edited.
