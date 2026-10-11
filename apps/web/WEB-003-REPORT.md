# WEB-003 handoff

Branch: `web/WEB-003`. Implementation milestone: `6c3c8fc`; the follow-up commit contains lifecycle
hardening, expanded tests and this report. All changes are within `apps/web`, excluding `public/models`.

The profile now renders Dev's authenticated LAM ZIP with the existing workspace renderer. Only the
profile mounts a head; thumbnails and customization use photos. The renderer chunk loads on demand,
the host has explicit 224px dimensions, and pending mounts/disposal are serialized across profiles.
Hidden tabs unmount the head. Loading shows a shimmer; errors and a 30-second deadline show the photo.
Legacy frame/video packages still work.

Hear them posts one voice line on a click, plays the authenticated audio and uses a WebAudio analyser
for jaw/funnel motion while polling an expression track for up to 10 seconds. A returned `expr_url`
takes precedence over the CV-002 conventional path. The renderer follows `audio.currentTime`.
Closing/switching the profile stops audio, cancels polling, disconnects nodes and closes the context.
The AI-generated voice label remains visible. No provider generation is triggered by loading a page.

The header selector lists every `/me` membership, switches the displayed village and offers invite
joining with inline errors. Successful joining refreshes memberships and opens that village. A 409
purchase refreshes shop inventory, balance and profile state while preserving the purchase error.
If shop recovery fails, buying stays unavailable until retry succeeds. Shop, profile and AI journal
initial-load failures have retry buttons.

## Changed files

- `src/App.tsx`, `src/components/VillagePicker.tsx`: memberships, switching, invite flow and profile retry.
- `src/components/GaussianHead.tsx`, `lamRuntime.ts`, `shared.tsx`: authenticated, single-head rendering,
  fixed host, visibility handling, lazy renderer import, cleanup and photo fallback.
- `src/components/ProfilePanel.tsx`, `voiceMotion.ts`, `src/api/client.ts`: voice playback, expression
  polling, amplitude motion, shared auth headers and optional expression URL typing.
- `src/components/Modals.tsx`, `AgentPanel.tsx`: conflict recovery and initial-load retries.
- `src/styles.css`: head host, shimmer, fallback and responsive village selector.
- `package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json`: pinned upstream renderer dependency,
  workspace source alias, type declarations and DOM test dependency. The workspace package is unchanged.
- `src/components/GaussianHead.test.tsx`, `tests/connection.spec.ts`, `tests/real.spec.ts`,
  `playwright.real.config.ts`: mocked head lifecycle, shop/picker/voice regressions and headed real rendering.
- `README.md`, `WEB-003-REPORT.md`: usage and handoff.

## Commands and evidence

Commands below ran from `apps/web` unless stated otherwise.

| Command | Result |
| --- | --- |
| `bun run typecheck` | Exit 0 |
| `bun run build` | Exit 0; LAM is a separate lazy chunk, approximately 1.22 MB / 332 kB gzip |
| `bun run test` | Exit 0; 15 passed, 81 assertions |
| `bun run test:e2e` | Exit 0; 16 passed |
| `bun run test:e2e:real` | Exit 0; both real API tests executed and passed, none skipped |
| `bunx playwright test --config playwright.real.config.ts --grep "Dev profile"` | Exit 0; final real head close/reopen lifecycle passed |
| `bunx playwright test --project=connection --grep "shop retries\|header lists" --output=test-results/web003-qa` | Exit 0; 2 passed |
| `bunx playwright test --project=connection --grep "Hear them" --output=test-results/web003-voice` | Exit 0; 1 passed |
| `git diff --check` (root) | Exit 0 |

The real suite used headed Chromium, verified authenticated ZIP fetching, one rendered head canvas,
and disposal on profile close. The existing real smoke test created one ordinary status check-in;
it did not call a paid model. Voice testing used a generated PCM tone, a mocked renderer and a delayed
expression fixture. Unit tests mock the renderer and exercise load failure/photo fallback, disposal,
pending profile switches and hidden-tab behavior. Mock and Auth0 suites remain green.

Screenshot: `apps/web/test-results/dev-profile-lam.png`, visually inspected: Dev's Gaussian head is
visible inside the profile alongside the live village. It remains local/ignored because AGENTS.md
prohibits committing real-person portraits, including this CC0 source. Browser-generated changes to
the older tracked screenshots were discarded; no photo, recorded voice, weights or secrets were committed.

During implementation, an initial root-level `bun run typecheck` returned exit 1 (no root script);
the corrected app-level invocation passed. An intermediate TS invocation returned exit 1 for a JSX
edit and was fixed before validation. The first DOM test invocation returned exit 1 because Happy DOM
under Bun lacked `window.SyntaxError`; the test harness now supplies that constructor. A Python edit
initially returned exit 1 on Windows text decoding; the affected edit was rerun with explicit UTF-8.
These were development failures, not passing checks. Build warnings remain for the existing Three.js
chunk and the independently lazy-loaded upstream renderer; the unit runner warns about multiple Three.js
instances in its existing model tests.

## Try it

From `apps/web`, run `bun install`, then in PowerShell:

```powershell
$env:VILLAGE_ENV_FILE = '/c/Users/mourn/Downloads/hacklanta/.env'
$env:VITE_MOCK = '0'
$env:VITE_DEMO_AUTH = '1'
bun run dev
```

Open localhost:5173, select Hacklanta Crew if needed and visit Dev. Keep the tab visible to see the
head. Hear them requests a real voice line only when clicked. Use the header selector for other
memberships or Join with invite code. Set `VITE_MOCK=1` for the offline fixture village.
`bun run test:e2e:real` uses its own port 5176 and skips if API :8010 is down.

## Limitations and proposed integration changes

No blocking issue remains for the requested flows. Real provider voice generation and new GPU
generation were deliberately not invoked; real head rendering and synthetic audio integration were tested.
Secret values were neither needed nor copied. Vite's existing runtime public-variable loader remains intact.

1. Document optional `VoiceLine.expr_url` and automatic expression-job enqueueing. The current
   conventional URL plus amplitude fallback works without these additions.
2. The workspace renderer exposes no abort signal or pre-resolution disposal handle. A permanently
   unresolved mount keeps subsequent mounts queued to avoid violating its singleton invariant; the UI
   still falls back after 30 seconds. Recommend cancellable mounting and guaranteed cleanup on failure
   in `packages/lam-renderer`. That package was not modified.
3. Pre-existing API metadata gaps described in README (display-name update, ownership and penalty
   lifecycle) remain outside this task. No contract, API, GPU, root or environment files were changed.
