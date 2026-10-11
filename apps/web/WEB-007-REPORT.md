# WEB-007 delivery

Branch: `web/WEB-007`. Implementation milestone: `9f0954a`. The follow-up commit containing this report adds verification coverage and the two screenshots; use `git log -2 --oneline` for both commits.

The Mayor's answer now appears in a dedicated sticky card with a crown icon, title, body, optional positive XP reward, and data-provided AI provenance. A short WebAudio chime runs after a successful explicit request. The answer survives refresh and reopening the dialog in the same browser tab until dismissed. Prayer responses have separate styling from challenges. Zero-XP rewards are hidden in the answer, event journal, village preview, and owner event controls.

The event journal starts with three events, expands with an exact remaining count, and mutes completed/failed items. Dated events sort newest first; older API responses retain the server's existing newest-first order. The pinned answer is not duplicated in the journal. Competition entries now precede the submission form, pending entries sort first, and every entry has a decision chip. Existing decision tests now identify entries by their content instead of a position that changes after judging.

Speaking LAM ZIP portraits show `lip-sync: approximate` for amplitude motion and `lip-sync: Audio2Expression` when an expression track arrives. Hints clear when speech ends or fails and do not appear on preset/photo portraits. Model names remain data-derived throughout the web UI; no provider name is hardcoded.

## Files changed

All changes are under `apps/web/`; no models, API files, root files, contracts, or secrets were changed.

- `src/components/MayorModal.tsx` (new), `Modals.tsx`: dedicated Mayor presentation, persistence, journal, and chime.
- `src/components/CompetitionsPanel.tsx`, `ProfilePanel.tsx`, `AgentPanel.tsx`: pending-first entries, speaking provenance, zero-reward suppression.
- `src/App.tsx`, `src/styles.css`: village preview and visual treatment.
- `src/api/types.ts`, `src/api/mock.ts`: optional event metadata and truthful scripted response metadata.
- `tests/polish.spec.ts` (new), `tests/audits.spec.ts`, `playwright.config.ts`: five new browser cases and stable entry selectors.
- `.gitignore`, `test-results/web007-prayer-card.png`, `test-results/web007-compete-list.png`: retain only the requested new QA screenshots.
- `WEB-007-REPORT.md`: handoff and verification record.

## Validation

Commands run from `apps/web/` unless specified otherwise. Tests use offline fixtures, a synthetic PCM tone, and an instrumented LAM renderer; no provider calls, GPU jobs, messages, payments, or transactions were made. The external secret file was not needed or copied.

| Command | Exit / result |
| --- | --- |
| `bun install --no-save` | 0; installed local dependencies without changing a lockfile |
| `bun run build` | 0; TypeScript and production Vite build; existing large-chunk warning |
| `bun run test` | 0; 26 passed, 0 failed |
| `bunx playwright test tests/polish.spec.ts --project=mock` | 0; initial four polish cases passed |
| `bunx playwright test tests/features.spec.ts tests/polish.spec.ts --project=mock` | 0; all eight cases passed, including the fifth polish case |
| `bun run test:e2e` | 0; final stable-source run: 29 passed, 0 failed (2.2 minutes) |
| `git diff --check` (worktree root) | 0 |

Earlier build attempts exited 1: the root has no build script, dependencies had not yet been installed, and TypeScript found an inferred motion type that was then explicitly typed. The first full browser run exited 1 (27 passed, one owner-switch test failed) while application edits triggered Vite hot reload. That test passed unchanged in the subsequent stable-source targeted run. The final full-suite result is recorded above.

Browser assertions cover persistence through reload, dismissal, chime creation, real model text and missing-model fallback, positive/zero rewards, kind styling, timestamp sorting and legacy ordering, list expansion, muted finished events, pending status above the fold at desktop/mobile sizes, and both speaking labels clearing after playback. Reviewed the supplied six demo stills, contact sheet, Mayor response frame, and voice-motion montage. Visually inspected both new screenshots; they use synthetic fixture data and contain no real photos.

## Try it

From `apps/web/`, run the following in PowerShell:

```powershell
bun install --no-save
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5174
```

Open `http://localhost:5174`, choose **Mayor**, enter a wish, and send it. Scroll the journal, reload/reopen Mayor, then dismiss the pinned answer. For the prepared pending-entry example and both synthetic speech paths, run `bunx playwright test tests/polish.spec.ts --project=mock` with the manually started dev server stopped. That command also reproduces the two screenshots.

- Prayer card: [test-results/web007-prayer-card.png](test-results/web007-prayer-card.png)
- Competition entries: [test-results/web007-compete-list.png](test-results/web007-compete-list.png)

## Limitations and proposed contract changes

The current API stores Mayor event `model` and `created_at` but excludes both from `domain.EVENT_FIELDS`, including prayer/recap responses and village events. Its village query already orders by `created_at DESC`. The UI therefore reports `AI · Model not supplied` for those live responses; it does not guess a provider from unrelated agent logs. **Proposed integrator change:** expose `model` and `created_at` on `MayorEvent` in the API projection and shared HTTP contract. The web types already accept these optional fields, so supplied values render immediately. This is the remaining blocker to showing the actual live prayer model; no out-of-scope change was made.

The live village endpoint only returns active, unexpired events. Completed/failed styling is covered with fixtures and will apply wherever the API supplies such records; expanding server history is outside this task. Pinned answers are scoped by user and village in session storage, lasting for the current tab session; storage-disabled browsers keep the answer in component state. Browser audio policy can silence the optional chime without affecting the response. No subjective audio-listening or live generated-asset validation is claimed.
