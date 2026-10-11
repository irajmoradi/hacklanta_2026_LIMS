# WEB-005 handoff

Branch: `web/WEB-005`. Implementation milestone: `a37c081`. The subsequent handoff commit
contains visual QA fixes, native recording coverage, and this report. No push or merge.
All edits are within `apps/web`; `public/models/**` is untouched.

## Delivered

- My profile → Settings, including on mobile: display name, nullable E.164 phone, roast and
  Mayor messaging preferences. PATCH uses API-004's partial profile contract and refreshes
  the village after saving. Load/save/provider failures remain visible and recoverable.
- Voice onboarding: native MediaRecorder or file uploads, 1–3 nonempty audio memos at up to
  10 MiB each, 60-second recording limit, removable samples, exact `village-voice-v1` consent
  text, explicit unchecked consent, multipart creation, returned consent metadata, and deletion.
  Failed deletion preserves the voice. Closing releases microphone tracks and timers; no raw
  sample is persisted. Offline state is explicitly simulated. Existing AI playback is labeled.
- Authenticated evidence thumbnails and blob-backed lightboxes in profiles, Week and Compete.
  Profile/Week lightboxes read the review endpoint for current verdict, reason and model, because
  the inline check-in review omits model provenance. Blob URLs are revoked on unmount/change.
  Nested dialogs have unique accessible titles and Escape does not close the profile beneath them.
- Guarded per-user village persistence, membership validation, optional `joined_at` ordering,
  and API order fallback. Stale saved villages and unavailable localStorage are harmless.
  The old VITE_VILLAGE_ID boot override is superseded by the requested default-selection behavior.
- Six-step `?tour=1` / Tour overlay: villagers → profile/LAM → suspicious evidence → AI at work
  → Week → Compete. Back, Next and End work across native dialog layers, including lightboxes.
  Tour navigation makes no generation, grading or settlement requests.
- Existing house-level GLBs, owner-following dog, crown and auditor badge were verified live.
  The active-event crater is now clear of the foreground house. Both GLB tree varieties and
  their missing-model fallbacks are instanced. Animation actions are resolved once and the crown
  no longer allocates a matchMedia object each frame. Scene animation callbacks have no explicit
  per-frame object allocations. Missing models retain the working procedural world.

## Files changed

Paths below are relative to `apps/web/`:

- `src/App.tsx`, `src/api/villagePreference.ts`: settings/tour wiring and village persistence.
- `src/components/SettingsPanel.tsx`, `src/api/client.ts`, `src/api/types.ts`, `src/api/mock.ts`:
  settings, recording, voice consent/status, API-004 adapters and provider-free offline behavior.
- `src/components/Evidence.tsx`, `ProfilePanel.tsx`, `WeekPanel.tsx`, `CompetitionsPanel.tsx`,
  `shared.tsx`: private evidence viewer, review provenance and nested dialog handling.
- `src/components/Tour.tsx`, `src/styles.css`: guided overlay, settings/evidence styles and
  accessible mobile My profile entry.
- `src/scene/InstancedTrees.tsx`, `VillageScene.tsx`, `OptionalModel.tsx`: tree batching,
  crater placement, cached animation actions and crown motion allocation fix.
- `src/api/settings.test.ts`, `tests/settings.spec.ts`, `tests/real.spec.ts`, `package.json`,
  `playwright.config.ts`: contract, browser, real-read and synthetic-microphone coverage.
  Failure artifacts now use `test-results/e2e` so routine runs do not delete live screenshots.
- `README.md`, `WEB-005-REPORT.md`: usage and handoff.

## Verification

Commands ran in `apps/web` unless stated otherwise. Final results:

| Command | Exit | Result |
| --- | --- | --- |
| `bun install` | 0 | Existing lockfile installed; no lockfile changes |
| `bun run typecheck` | 0 | Clean |
| `bun run test` | 0 | 23 passed, 132 assertions |
| `bun run build` | 0 | Production build; existing Three/LAM chunk-size warnings |
| `bunx playwright test --project=connection tests/settings.spec.ts` | 0 | 4 passed, including native recording and mobile cleanup |
| `bun run test:e2e` | 0 | 23 passed (mock, Auth0 and connection suites) |
| `bun run test:e2e:real` | 0 | 4 executed and passed, none skipped |
| `bunx playwright test --config playwright.real.config.ts --grep WEB-005` | 0 | Live visual/provenance follow-up passed without mutations |
| `git diff --check` (root) | 0 | Clean |

Live screenshot test verifies connected mode, auditor badge, successful dog/crater/crown GLB
responses, suspicious evidence and model provenance, and absence of POST/PATCH/DELETE requests.
The pre-existing full real smoke suite created one ordinary status check-in. It did not request
paid voice/LLM generation. Native recording uses Chromium's synthetic microphone; no real voice
was captured. Provider cloning/deletion was exercised with stubbed responses only.

Visually reviewed, local/ignored screenshots:

- `apps/web/test-results/web005-settings.png`
- `apps/web/test-results/web005-evidence.png`
- `apps/web/test-results/web005-world.png`

These contain live-world portraits and remain uncommitted under the repository's privacy rule.
Pre-existing tracked screenshots regenerated by old tests were restored, rather than committed.

Development failures were resolved: dependencies were initially absent; one Windows Python edit
failed decoding UTF-8; a Playwright command ran from the wrong directory; an overly broad test
route caught Vite source imports; a review fixture lacked its GET route; and the new mobile test
exposed the hidden My profile button. Those runs failed and are not counted as passing checks.

## Try it

From `apps/web`, install with `bun install`, then PowerShell:

```powershell
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
$env:VITE_MOCK='0'
$env:VITE_DEMO_AUTH='1'
bun run dev
```

With API :8010 running, open http://localhost:5173/?tour=1 and select Hacklanta Crew if needed.
Use My profile → Settings; visit Lance and open his evidence; explore the Week and Compete views.
Use `VITE_MOCK=1` for the fixture world with no API/GPU/providers. The existing Vite loader reads
public runtime settings from the external environment directory. No secrets were copied or logged.

## Limits and proposed contract changes

1. **Exact oldest membership is blocked by API metadata.** `/me` omits `joined_at` and sorts by
   village creation time. The client sorts optional join dates when present, otherwise preserves
   that API order. Propose adding `m.joined_at` and ordering by it (then village ID) upstream.
2. **Laptop iGPU ≥50 fps is not certified.** The live 1440×1000 world measured about 144 fps
   over a three-second foreground requestAnimationFrame sample on this host's NVIDIA RTX 5090.
   Instancing and allocation fixes are delivered, but representative iGPU hardware is unavailable.
3. Adopt API-004's settings/voice/consent additions into shared contracts. No shared contract,
   API, worker, environment, root file, model, photo or voice recording was changed or committed.
4. Live provider clone quality and provider-side deletion were not tested with a paid account.
   Errors and consent gating were tested without paid calls. The GPU was offline during live QA.
5. `WEB-002-REPORT.md` was absent in this worktree. AGENTS.md, WEB-003/004 reports, API-004 proposal,
   the live API implementation and the demo README were inspected before implementation.
