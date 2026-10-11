# WEB-009 handoff

Branch: `web/WEB-009`. Implementation milestone: `907d591`; see `git log -2 --oneline` for the verification/handoff commit. No push or merge.

Delivered: owner group-photo upload with explicit group consent, authenticated photo/crop display and pixel-XYXY outlines, member claims and claimed names, shared job lookup, and avatar polling. The Village HUD panel shows collective XP, buildings, upcoming unlock costs, weather/time, and the latest Mayor world event. Refresh differences celebrate new buildings without celebrating initial loads or village switches. Mobile/tablet controls collapse into a bottom sheet; profiles fill the screen.

Mock mode uses synthetic vector people and a timed simulation, clearly labeled. It never segments an uploaded photo, generates an avatar, or calls a provider. Preset avatars remain available. Job IDs are scoped by user and village in session storage (memory fallback); no photo or secret is persisted by the UI. Object URLs and polling timers are released when panels close.

Files changed (relative to `apps/web`):

- `src/App.tsx`, `src/styles.css`: panel wiring, unlock diff and responsive layout.
- `src/api/client.ts`, `types.ts`, `mock.ts`, `world.ts`: API-007 adapters, optional types, scoped mock claims and fixture world economy.
- `src/components/GroupPhotoPanel.tsx`, `VillagePanel.tsx`, `Onboarding.tsx`, `Celebration.tsx`: photo flow, growth panel, reused avatar polling, celebration above native dialogs.
- `src/api/mock.test.ts`, `tests/features.spec.ts`, `tests/audits.spec.ts`: new contract/browser coverage and opening the mobile HUD before its secondary controls.
- `tests/artifacts/web009-*.png`, this report: synthetic-data screenshots and handoff.

Verification (commands from `apps/web`, except git):

| Command | Exit / result |
| --- | --- |
| `bun install --no-save` | 0; no lockfile change |
| `bun run typecheck` | 0; final source |
| `bun run build` | 0; final source; existing large-chunk warning |
| `bun run test` | 0; 29 tests, 183 assertions |
| `bunx playwright test tests/features.spec.ts --project=mock --grep WEB-009` | 0; initial three new browser cases |
| `bun run test:e2e` | 0; 32 passed in 3.7 minutes |
| `bunx playwright test tests/features.spec.ts tests/settings.spec.ts --grep "WEB-009|avatar consent|native recording"` | 0; six passed after the final touch-target/stage-status changes, including the new retry case |
| `git diff --check` | 0 |

The full suite ran before the final small touch-target and stage-status refinements. The affected photo, avatar, mobile and settings cases were then rerun against final source. No tests are claimed for real provider generation. Tests cover owner/consent restrictions, exclusive/idempotent/village-scoped claims, multiple members, simulated progress, empty results and read-error recovery, building diff and celebration, mobile HUD access, canvas hit testing/drag, zero horizontal overflow and full-screen profile geometry.

Earlier development runs failed and were corrected: missing PDF extraction dependencies (pypdf installed; uv unavailable), a test command run from the root without a test script, a new assertion expecting 403 rather than 401 for unknown identity, a TypeScript generic in that test, and a mobile canvas assertion whose point hit a clickable villager label. The corrected canvas test uses an unobstructed point. Existing tests regenerated tracked screenshots outside allowed paths; those incidental changes were restored before committing.

Visually reviewed screenshots (synthetic fixtures only):

- `tests/artifacts/web009-group-photo.png`
- `tests/artifacts/web009-unlock.png`
- `tests/artifacts/web009-mobile-390x844.png`
- `tests/artifacts/web009-mobile-expanded.png`
- `tests/artifacts/web009-mobile-profile.png`
- `tests/artifacts/web009-mobile-growth.png`

The external secret file was not needed for this UI/mock task and was neither copied nor logged.

Try it from `apps/web` in PowerShell:

```powershell
bun install --no-save
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5174
```

Open http://localhost:5174, choose Village -> Our group photo. Select a synthetic image, check group consent, choose Find our people, then This is me. Close the panel and switch Play as to Lance to claim a different person. Use More on mobile for Week, Compete, Shop, Mayor and Weekly goal. My profile opens the full-screen profile. The browser tests reproduce unlock celebrations and screenshots: `bunx playwright test tests/features.spec.ts --project=mock --grep WEB-009`.

Blockers and proposed API-007 contract additions:

- Live `http://localhost:8010/openapi.json` was checked twice and contained zero group-photo routes. No live uploads, claims, model generation, paid calls or transactions were made. Live integration remains dependent on API-007. WEB-002-REPORT.md was absent; WEB-005/007, Hackathon.pdf, docs/cv/cv002.md and the worker segment/select implementation were inspected.
- The task specifies only `{status,crops:[{crop_id,url,bbox}]}`. To discover the shared photo across members/devices, expose optional `village.group_photo_job_id` (or a latest-photo endpoint). Until then members can enter an owner-shared job ID.
- Return `photo_url` plus `width` and `height`; bbox is assumed to be pixel `[x0,y0,x1,y1]` matching the worker. Image natural dimensions are a fallback. The uploader also has an in-memory preview when the response lacks `photo_url`; other members can still use crop cards.
- Each crop should expose `claimed_by` (user ID), optional `claimed_name`, and optional `avatar_job_id` for resuming progress. Claim response is assumed to be `{job_id}`; the server must enforce membership, owner-only uploads, exclusive one-person claims and idempotent same-person retries.
- World `next_level_xp` and upcoming `xp` are treated as cumulative thresholds. `unlocked` accepts IDs or `{id,name,xp?}` objects; weather is a string, with optional `time_of_day`. Older servers display an explicit unavailable state. Demo building thresholds are local fixture choices, not a proposed production economy.
- The UI never calls the GPU worker directly. The API owns `/segment`, `/segment/select` and downstream generation. The UI accepts optional `generation.stylized_head`; stages not reported by an older server remain waiting rather than inventing completion. No shared contracts, scene files, root files, environment files or other apps were edited.
