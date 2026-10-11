# WEB-015 delivery

Branch: `web/WEB-015`. Implementation milestones: `78f4ca9` and `841e84a`; the final handoff commit contains this report.

Implemented shared authenticated, reference-counted portrait blobs in floating name tags, people strip/phone list, feed, and Inbox. Uses the manifest's `portrait.asset_url` (the live API already supplies the face crop there), with initials on missing/failed images. Fetches deduplicate by identity, mode, revision and URL; unused blobs are revoked after a one-second panel-switch grace period. No per-frame work or FIX-003 pointer/z-index changes.

Added a skippable invitation after sign-in/Play-as and Settings > Refresh my face check. Opening the camera explicitly requests permission. Capture uploads one JPEG frame; upload fallback accepts JPEG/PNG/WebP up to 8 MiB. Camera tracks stop on capture, close, unmount, or late permission completion. Selfies stay in memory and are never written to storage. Optional/no-liveness copy, match/mismatch/no-face/offline/rate-limit states and explicit avatar-based enrollment are included. `/me.user.face_verified_at` suppresses the invitation when recently verified. The badge toast is shown once per identity/browser (only a boolean-like seen marker is persisted; storage-denied mode deduplicates for the current app session). The API owns the one-time zero-XP badge ledger.

Reasonable choices: use a nonblocking invitation instead of forcing an interstitial over the existing village controls; Settings opens the same check and offers a separate explicit enrollment button. Mock mode exposes a labeled outcome selector and never sends provider requests. Its shared five-per-minute limit and five-minute recognition timestamp mirror API-013. No new endpoint or contract change is needed; the API-013 proposal already describes the consumed fields.

Changed files (all under `apps/web`):

- `src/App.tsx`, `src/styles.css`: invitation, modal wiring, badge toast, responsive portrait/face styles.
- `src/components/{shared,Messages,SettingsPanel,FaceCheck}.tsx`: cache, portraits, refresh entry, camera/upload UI.
- `src/scene/VillageScene.tsx`: portrait inside existing label button.
- `src/api/{client,types,mock,face.test}.ts`: adapters, field type, mock behavior and unit tests.
- `package.json`, `playwright.config.ts`: register tests.
- `tests/web015.spec.ts`, `tests/web015-live.spec.ts`, `tests/web015-real.mjs`: fake-camera/offline, intercepted HTTP and live read-only portrait verification.
- `WEB-015-REPORT.md`: this handoff.

Validation (commands run from `apps/web` unless noted):

- `bun install --frozen-lockfile`: exit 0, including the existing pot postinstall.
- `bun run typecheck`: exit 0. Initial attempts failed before dependency installation and before correcting a generic in the new tests; both were resolved.
- `bun run build`: exit 0 on the final source; existing large-bundle warnings remain.
- `bun run test`: 35 passed, 0 failed, exit 0.
- `bunx playwright test tests/web015.spec.ts tests/fix003.spec.ts --project mock`: 8 passed, exit 0 (initial focused milestone).
- `bunx playwright test --config tests/web014.config.ts`: 6 passed, exit 0.
- `node tests/web015-real.mjs`: exit 0; all five live authenticated name-tag portraits loaded, with desktop and phone screenshots. Vite started with `VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env`, `VITE_MOCK=0`, `VITE_DEMO_AUTH=1`, port 5190. No secrets copied.
- `git diff --check` (repository root): exit 0.

Initial full suite: `bun run test:e2e` exited 1 with 48 passing and one new HTTP-stub failure. The first focused retry also exited 1 (six face-flow checks passed). The stub accidentally matched Vite `/src/api/` module imports; it now guards the `/api/` prefix and supplies a presence-stream response. Corrected `bunx playwright test tests/web015-live.spec.ts --project connection`: 1 passed, exit 0. The test verifies all five images use authenticated requests, each URL is fetched once across surfaces, an unavailable image falls back, and face verification uses multipart field `file`.

A two-worker full-suite attempt (`bunx playwright test --workers=2`) hit an existing short audio-playback timing assertion under heavy rendering contention. It was stopped (exit 1) and replaced with the repository-configured single-worker run; no existing test or timeout was weakened.

Final configured full suite: `bun run test:e2e` completed with **51 passed, 0 failed, exit 0**. This includes the six face-flow tests, authenticated portrait-cache/multipart test, FIX-003 desktop/touch hit-testing, all existing authentication, avatar, equipment, onboarding, audio and settings regressions. The existing Audio2Expression test passed in this serial rerun.

Screenshots (local only, not committed, especially the live portraits):

- `test-results/web015/live-name-tags.png`: live API, desktop, device scale 2; all five protected images loaded.
- `test-results/web015/live-phone-people.png`: live API, 390x844 phone people list.
- `test-results/web015/face-camera.png`: mock flow with Playwright fake camera.
- `test-results/web015/face-recognized.png`: successful recognition and badge.

Teammate try-it: from `apps/web`, run `bun install --frozen-lockfile`, set `VITE_MOCK=1` and `VITE_DEMO_AUTH=1`, then `bun run dev`. Click Say cheese in your card; choose a demo outcome, open the camera or upload a selfie, and capture/check. Skip remains available. Switch Play as to try another identity. My profile > Settings > Refresh my face check reopens the flow; Refresh from my avatar photo calls enrollment. In live mode point `VILLAGE_ENV_FILE` to the shared environment file at runtime and set `VITE_MOCK=0`; existing Vite code reads only public settings. Live capture script expects that server on port 5190 and blocks all writes.

No paid generation, live face verification/enrollment, messages, signatures, transactions, secret copies, pushes or merges were performed. Live visual testing was read-only. Biometric recognition itself is exercised through mocked responses/fake camera; a human can explicitly try their own selfie against the worker. No implementation blockers or proposed contract changes.
