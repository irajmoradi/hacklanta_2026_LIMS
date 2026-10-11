# WEB-048 - check-in choices and optional proof

Branch: `web/WEB-048`.
Implementation: `d434710`. Browser coverage milestone: `7d6fd72`.

Daily note and Goal progress commit directly to their own forms, preserving
WEB-040's transition, portrait, focus trap, choose-again navigation and rewards.
The top-level proof choice is removed. The remaining choices use VillageIcon
tiles, labels, short hints and keys 1/2/3. Not now still closes the scene.

Both forms contain an optional proof section using the existing evidence upload
and review API, with JPG/PNG/WebP up to 5 MB, camera capture, preview and removal.
Progress retains the active stretch tier. Retry reuses the upload and idempotency
key. API contracts, rewards and the standalone generic modal are unchanged.

Choices made: kept proof inline so users can submit immediately without it;
used paper/flag/walk from the existing custom icon library. Reused the existing
camera modal, including its explicit camera permission action and 5 MB limit.
No secrets, generated assets, paid calls or live-village mutations are needed.

Changed files:
- src/components/CinematicScene.tsx
- src/components/CheckInDialogue.tsx
- src/components/cinematicScene.css
- tests/feat016.spec.ts and tests/web040.spec.ts (updated obsolete selectors)
- tests/web048.config.ts and tests/web048.spec.ts (isolated mock-only browser QA)
- tests/WEB-048-REPORT.md

Validation (from apps/web, Git Bash):
- `../../ops/remote_run.sh bun run typecheck`: exit 0 (1749.57 seconds including queue).
- `../../ops/remote_run.sh bun run test`: exit 0; 195 passed, 0 failed across 48 files
  (7.37 seconds execution; 1595.81 seconds including queue).
- First `../../ops/remote_run.sh bunx playwright test --config tests/web048.config.ts`:
  remote exit 124 (Windows wrapper exit 1), 1800.61 seconds; queue timeout before
  Playwright started. Retrying remotely with a fresh budget; no local fallback.
- Retry of `../../ops/remote_run.sh bunx playwright test --config tests/web048.config.ts`:
  exit 0; all 8 tests passed (8.9 minutes execution; 1134.41 seconds including queue).
  The configured runner changed between attempts; the retry used the current
  configured host. Playwright startup reran typecheck successfully on final source.
  Covers desktop/390 px choices, focus/Tab/Escape, keys 1/2/3 and ignored 4,
  Not now, reduced motion, axe, wrong-type/oversized uploads, preview/removal,
  camera capture, note/progress saves with and without proof, evidence review,
  stretch tier/Go beyond, and reuse of uploads and idempotency keys on retry.
- `git diff --check`: exit 0.
Screenshots: `apps/web/artifacts/web048/` (generated artifacts, not committed).
- `choices-1280.png`, `choices-390.png`
- `note-1280.png`, `note-390.png`, `proof-1280.png`, `proof-390.png`
- `shared-1280.png`, `shared-390.png`
- `status-no-proof-{1280,390}.png`, `status-camera-{1280,390}.png`
- `progress-no-proof-{1280,390}.png`, `progress-camera-{1280,390}.png`
- Full browser results: `apps/web/tests/artifacts/web048/playwright.json`.

Visual QA: inspected mobile choices, desktop note, desktop/mobile progress with
camera proof, and mobile note without proof. Icon tiles, hints and key chips fit
at 390 px; the teal postcard frame remains intact. Long forms scroll inside the
panel to reach Share check-in. Automated assertions confirm no horizontal overflow
and both viewport axe scans found no violations. Browser tests successfully use
the controls and save from both viewport sizes. Camera images are synthetic test
frames, and avatars are fixture fallbacks.

Try it: run the web app with VITE_MOCK=1 and VITE_DEMO_AUTH=1, choose a demo seat,
and open Check in. Press 1 for Daily note or 2 for Goal progress. Write a note,
optionally upload/take a photo, then Share check-in. Choose again returns to the
three choices; 3/Not now closes. Complete a goal and choose Go beyond to try a
stretch check-in. Repeat at 390 px and with reduced motion enabled.

Blockers: none remaining. Shared runner queue contention caused the initial browser timeout.
Proposed contract changes: none.
