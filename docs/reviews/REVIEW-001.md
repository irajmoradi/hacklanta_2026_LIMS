# REVIEW-001 — judge-demo and new-user review

Reviewed 2026-10-10 on `review/REVIEW-001`, against the existing local preview at
`http://localhost:4173` and API at `http://127.0.0.1:8010`. No public tunnel used.
Application source baseline in this worktree: `dc59652`; preview bundle observed:
`index-DJ8f4OQu.js`. The preview was not rebuilt, so source locations below are
suspected owners, not proof of an exact source-to-deployed-bundle match.

**No P0 found. Fix mobile villager selection first, then responsive HUD layout and
tour accuracy.** The village loads, main panels open, and settled generated
portraits work. The most conspicuous failures concern navigation and presentation.

## Scope, safety, and evidence

- Headed Chromium with WebGL, at 1920×1080, 1366×768, and 390×844; live resizing,
  all six tour steps at each size, Back/End/Finish, and reload during flows.
- Opened every HUD panel and every villager. Covered all five Play-as identities
  and their wardrobes; both profile tabs; avatar customization; settings and
  account-deletion UI; all Inbox peers; group-photo and invite panels; Gazette
  archive; both seeded competitions and both creation modes; check-in modes;
  expanded week evidence, evidence review, emergency-vote explanation, auditor
  grade editors, owner override form, AI activity, and expanded Mayor journal.
- Used local unsent drafts, keyboard Tab/Enter/Escape/arrow navigation, accessible
  names/ARIA snapshots, and native dialog behavior. This is not an NVDA/JAWS audit.
- Browser interception rejected **all API writes**. No messages, transactions,
  purchases, equipment changes, settings saves, votes, grades, or deletions were
  submitted. Voice generation, GPU jobs, and LLM calls: **0 each**. Generation,
  wallet, and destructive controls were inspected but not activated. Their success
  paths are outside this non-mutating review.
- Cold load: cache disabled; CDP throttling at 180 ms latency, 192,000 B/s download,
  96,000 B/s upload. Primitive village fallback appeared and upgraded after
  throttling was removed. See `cold-assets-throttled.png` and
  `cold-assets-recovered.png`. No worker was stopped.
- Screenshots and raw logs live under **`tests/explore/artifacts/`**. Every image
  name below is relative to that directory. They are gitignored and intentionally
  uncommitted because some contain real-person portraits. Scripts regenerate
  evidence locally; there is no public artifact upload.
- Existing exploration files/artifacts were present on arrival. This report uses
  fresh runs from this turn; the pre-existing UI identity-wait edit was retained.

## Prioritized findings

### R01 · P1 · Phone labels block selecting two villagers

**Repro:** At 390×844, leave the default camera in place and tap the center of
Lance's label, then Stefanny's. Lance is covered by Stefanny; Stefanny is covered
by Maya. Both ordinary Playwright clicks time out with the overlapping button
intercepting pointer events. `elementFromPoint` independently confirms the wrong
target. The desktop neighbor strip is hidden on phones. Keyboard Enter on each
label does open the intended profile, so the data/profile routes work.
An additional fresh-session resize also placed Dev behind the self-card for the
entire 15-second click timeout; label position varies with scene/camera state.

**Evidence:** `phone-home.png`, `detail-phone-labels.png`,
`detail-phone-keyboard-Lance.png`, `detail-dev-covered.png`; geometry and click
traces in `ui-results.json`, `details-results.json`, and
`details-focus-first-results.json`.
**Suspected files:** `apps/web/src/scene/VillageScene.tsx:120`,
`apps/web/src/styles.css` (44 px labels and hidden neighbor strip).
**Suggested fix:** Add collision-aware label placement or an always-available
mobile people list with separate tap targets.

### R02 · P2 · Phone header clips the brand above the viewport

**Repro:** Load or resize to 390×844. The brand's bounding box begins at **y=-16.5**
with height 32 px; its top half is missing. The village picker extends below the
100 px header. Wrapped controls occupy more space than the fixed header allows.

**Evidence:** `phone-home.png`; `ui-results.json` → phone geometry.
**Suspected file:** `apps/web/src/styles.css` (mobile `.topbar` rules).
**Suggested fix:** Use a deliberate two/three-row mobile header with sufficient
height and update the scene's available height accordingly.

### R03 · P2 · Laptop dock overlaps feed and Mayor card

**Repro:** At 1366×768, view the default home. The centered action dock crosses the
feed's lower-right edge and the left portion of the Mayor card; its translucent
background mixes button labels with the content beneath. Desktop 1920×1080 has
enough space and does not exhibit the same overlap.

**Evidence:** `laptop-home.png`, compared with `wide-home.png`.
**Suspected file:** `apps/web/src/styles.css` (`.action-dock`, `.feed-panel`,
`.challenge-peek`).
**Suggested fix:** Reserve a bottom band for the dock or move/collapse the two
cards at laptop widths.

### R04 · P2 · Tour narrates Dev while opening Iraj

**Repro:** Start Tour and choose Next once. Step 2 says “Dev's profile has a LAM
head,” while the visible profile is Iraj. Reproduced at all three sizes. Source
selects the first villager with a LAM portrait, while the copy hardcodes Dev.

**Evidence:** `wide-tour-2.png`, `phone-tour-2.png`.
**Suspected files:** `apps/web/src/App.tsx` (tour selection effect),
`apps/web/src/components/Tour.tsx`.
**Suggested fix:** Derive both selection and copy from the same featured villager.

### R05 · P2 · Rapid portrait navigation emits uncaught disposal errors

**Repro:** Open/close generated profiles and advance through portrait tour steps
without waiting for each head mount. The broad run recorded **15 uncaught
`Scene disposed` errors**; the nested-panel run recorded one more. A separate
warning says “Multiple instances of Three.js being imported.” The village remains
usable; waiting for Iraj and Lance gives `data-head-state="ready"`, so this is
not evidence of permanently broken portraits.

**Evidence:** `ui-results.json` → `pageErrors`/`console`, `details-results.json` →
`errors`/`warnings`; contextual screenshots `wide-tour-2.png`,
`detail-settled-Lance.png` (the errors themselves are in the JSON logs).
**Suspected files:** `apps/web/src/components/lamRuntime.ts`,
`apps/web/src/components/GaussianHead.tsx`, `packages/lam-renderer/src/index.ts`.
**Suggested fix:** Audit cancellation/disposal of pending mounts and renderer
promises; deduplicate Three.js independently rather than suppressing all errors.

### R06 · P2 · Profile tab semantics promise arrow navigation but do not provide it

**Repro:** My profile → focus the Profile tab → press ArrowRight. Focus/selection
remain on Profile. Clicking Wardrobe works. Both are exposed as `role="tab"`, but
there is no roving tab index, arrow-key handler, or associated tabpanel wiring.

**Evidence:** `detail-tab-keyboard.png`; `details-results.json` →
`measurements.tabAfterArrow` is `Profile`.
**Suspected file:** `apps/web/src/components/ProfilePanel.tsx`.
**Suggested fix:** Implement the tab keyboard pattern and panel associations, or
use ordinary buttons with explicit pressed state.

### R13 · P2 · Phone profile lets focus escape behind its full-screen overlay

**Repro:** At 390×844, focus Dev's scene button and press Enter. Focus the profile
close button, then Tab through the profile controls. After the final loaded
control, focus reaches the hidden `Village home` link behind the full-screen
profile. Escape no longer closes the profile because its key handler only runs
inside the aside. The exact tab count varies as evidence finishes loading.

**Evidence:** `detail-phone-focus-outside.png`; `details-targeted-results.json` →
`phoneFocus` and `profileStillOpenAfterEscape` (1).
**Suspected files:** `apps/web/src/components/ProfilePanel.tsx` (non-modal aside
and local Escape handler), `apps/web/src/styles.css` (phone full-screen overlay).
**Suggested fix:** Make the phone profile a modal surface with inert background,
contained focus, and reliable Escape dismissal, while retaining the desktop aside.

### R07 · P2 · Home feed is dominated by generic agent events

**Repro:** Open home with the current demo data. All eight rendered feed entries
say “Mayor agent decision.” The feed provides no decision, reason, or person's
progress, weakening the impression of an active friend group.

**Evidence:** `wide-home.png`; `details-results.json` ARIA snapshots include all
eight entries.
**Suspected files:** `apps/api/app/domain.py:490` (`feed_text` falls back to the
event type), `apps/web/src/App.tsx` (first eight feed entries).
**Suggested fix:** Give `agent_decision` a meaningful user-facing summary and
coalesce repetitive background events in the home feed.

### R08 · P3 · Unsent drafts disappear on dismissal/reload without notice

**Repro:** Check in → enter a note → Escape → reopen. The draft is empty.
Inbox → select a peer → type a draft → reload likewise resets the flow. This
does not lose a saved check-in, but accidental dismissal costs the user's work.

**Evidence:** `detail-progress-draft.png`, `detail-inbox-after-reload.png`;
`details-results.json` → `draftAfterClose` is an empty string.
**Suspected files:** `apps/web/src/components/Modals.tsx`,
`apps/web/src/components/Messages.tsx`.
**Suggested fix:** Preserve local drafts keyed by user/village/peer until send or
explicit discard, with a clear privacy-conscious retention policy.

### R09 · P3 · “Weekly goal” and “Week” obscure their different purposes

**Repro:** Compare the two adjacent flag buttons: Weekly goal opens a personal
goal editor titled “Plant a little intention”; Week opens grading titled “This
week.” A new user cannot infer where to inspect evidence and the crown.

**Evidence:** `wide-home.png`, `wide-Weekly-goal.png`, `wide-Week.png`.
**Suspected files:** `apps/web/src/App.tsx`, `components/Modals.tsx`,
`components/WeekPanel.tsx` (the latter paths under `apps/web/src/`).
**Suggested fix:** Use “My goal” and “Weekly review” consistently across navigation,
dialog headings, and tour copy.

### R10 · P3 · Important explanatory text is tiny and pale

**Repro:** At 1366×768 or 1920×1080 at 100% zoom, read feed timestamps, XP labels,
profile status/help text, and event provenance. Much of it is 9–12 px muted text;
the hierarchy becomes hard to read from a judge's viewing distance. This is a
visual finding, not a measured WCAG contrast-failure claim.

**Evidence:** `laptop-home.png`, `detail-mayor-expanded.png`,
`detail-create-audited.png`.
**Suspected file:** `apps/web/src/styles.css` (`small`, `.help-text`, `.eyebrow`,
feed and event text).
**Suggested fix:** Increase useful supporting text to 12–14 px and darken muted
colors, retaining tiny text only for decorative labels.

### R11 · P3 · Seeded challenge terms look incomplete

**Repro:** Mayor → Show more → inspect either “Touch Grass” challenge. Tier and
Effort display “Not supplied”; fixed rewards appear as “100–100 XP” or “75–75 XP.”
These are honest fallbacks but make the prepared demo appear unfinished.

**Evidence:** `detail-mayor-expanded.png`.
**Suspected files:** `apps/web/src/components/EventTerms.tsx`, demo seed/event data.
**Suggested fix:** Fill known fixture terms, hide genuinely optional absent fields,
and format equal min/max rewards as a single amount.

### R12 · P3 · One health response exceeds the 1-second review threshold

**Repro:** GET `/api/health` in the route sweep. Member response was 346 ms;
unknown-user response was **2304 ms**. Three subsequent probes took 486, 407,
429 ms with DB and worker up. Treat this as an isolated latency observation,
not a consistently slow endpoint or an auth-specific problem.

**Evidence:** `api-results.json`; screenshot N/A (HTTP-only observation).
**Suspected file:** `apps/api/app/main.py:115` (DB and worker health probes).
**Suggested fix:** Bound total health-check time and reuse the HTTP client or
cache worker health briefly if this recurs.

## API route pass

The script enumerated **every GET operation in `/openapi.json`: 29 routes, 58
probes**, with a demo member and an unknown-user header. No 5xx occurred. All
private routes rejected the unknown user with 401; `/api/health` was public.
No unauthorized private response body was observed in these probes.

**Authorization coverage limitation:** A read-only database query found no
existing user outside the demo village. Consequently the second identity is an
unknown user, **not an authenticated non-member**: these probes prove rejection
at authentication, not cross-village isolation. Creating/removing memberships
would violate this review's non-mutating scope. Add an isolated non-member
fixture for the integrator's follow-up; do not call this an authorization pass.

Internal routes were intentionally tested without a service key. In particular,
service-authenticated GET `/api/internal/outbox` claims messages and is not a safe
read-only probe. SSE was closed after response headers, so its timings are only
time-to-headers. Missing photo-item/group-photo jobs used a nonexistent UUID and
returned expected 404s; successful job reads for these two lack fixture coverage.

| GET route (under `/api`) | Member | Unknown | Member / unknown ms |
| --- | ---: | ---: | ---: |
| `/health` | 200 | 200 | 346 / 2304 |
| `/me` | 200 | 401 | 18 / 72 |
| `/villages/{vid}` | 200 | 401 | 196 / 5 |
| `/villages/{vid}/feed` | 200 | 401 | 8 / 5 |
| `/villages/{vid}/users/{uid}` | 200 | 401 | 33 / 17 |
| `/villages/{vid}/shop` | 200 | 401 | 23 / 4 |
| `/voice/lines/{line_id}` | 200 | 401 | 7 / 5 |
| `/avatars/{uid}` | 200 | 401 | 26 / 4 |
| `/jobs/{job_id}` | 200 | 401 | 6 / 15 |
| `/assets/{key}` | 200 | 401 | 7 / 5 |
| `/internal/assets/{key}` | 401 | 401 | 15 / 15 |
| `/internal/outbox` | 401 | 401 | 15 / 1 |
| `/villages/{vid}/check-ins/{cid}/review` | 200 | 401 | 8 / 4 |
| `/villages/{vid}/agent-log` | 200 | 401 | 8 / 4 |
| `/villages/{vid}/items/jobs/{jid}` | 404 | 401 | 7 / 4 |
| `/villages/{vid}/items` | 200 | 401 | 11 / 5 |
| `/villages/{vid}/weekly/current` | 200 | 401 | 12 / 5 |
| `/villages/{vid}/weekly/{week_start}` | 200 | 401 | 31 / 25 |
| `/villages/{vid}/competitions` | 200 | 401 | 17 / 5 |
| `/villages/{vid}/competitions/{cid}` | 200 | 401 | 11 / 5 |
| `/villages/{vid}/group-photo/{job_id}` | 404 | 401 | 7 / 4 |
| `/villages/{vid}/mayor/memory` | 200 | 401 | 7 / 6 |
| `/villages/{vid}/mayor/event-templates` | 200 | 401 | 31 / 5 |
| `/villages/{vid}/mayor/effects` | 200 | 401 | 77 / 21 |
| `/villages/{vid}/gazette/latest` | 200 | 401 | 7 / 5 |
| `/villages/{vid}/gazette` | 200 | 401 | 8 / 27 |
| `/villages/{vid}/messages` | 200 | 401 | 9 / 5 |
| `/villages/{vid}/messages/unread` | 200 | 401 | 7 / 6 |
| `/villages/{vid}/presence/stream` | 200 | 401 | 6 / 16 |

## Console/network interpretation and non-findings

`ui-results.json` records console warnings/errors, page exceptions, failed
requests, HTTP errors, blocked writes, and geometry. `details-results.json`
contains ARIA snapshots and nested-flow measurements. Follow-up identity and
week checks are in `details-retry-results.json`; the final phone-focus probe is
in `details-targeted-results.json`.

- Every browser HTTP error in the broad run was an intentional guard-generated
  409, including presence heartbeats. Inbox read acknowledgements are similarly
  blocked. These are **harness artifacts**, not product endpoint bugs; presence
  freshness and read-state transitions were not validated.
- Broad-run failed requests were 15 aborted blob URLs and six aborted presence
  streams during profile teardown, identity changes, and reload. These are
  consistent with cancellation; no independent asset-404 regression was observed.
- Three Play-as/wardrobe checks exceeded the original 4-second timeout. A targeted
  run with 15 seconds completed all five identities and wardrobes. Do not turn
  the short-timeout failures into permanent switching bugs.
- The broad keyboard check also timed out; the isolated check-in keyboard flow
  subsequently worked. Native dialog Tab traversal did not activate background
  app controls; one recorded BODY focus represents browser-chrome traversal.
- Two initial nested-flow failures came from an exploration-script selector that
  changed as details opened. The script was fixed to repeatedly open the first
  closed details element, and both Week and auditor flows completed on rerun.
- Empty conversations and an unconfigured group photo provide explanatory copy.
  Blank/loading portrait screenshots taken immediately after navigation do not
  establish a sustained blank portrait; settled captures show rendered heads.
- Resizing and reloading did not crash the village. Reload ends an in-progress
  tour; no tour progress persistence is advertised.

## Top 10 polish wins for the next two hours

Estimates are triage budgets, not guarantees. Recheck all three viewports after
layout work; avoid spending the whole window on renderer internals.

| Order | Win | Budget |
| --- | --- | ---: |
| 1 | Provide a mobile people list to bypass label collisions (R01). | 20 min |
| 2 | Fit the complete mobile header without negative positioning (R02). | 15 min |
| 3 | Reserve dock space at laptop widths (R03). | 15 min |
| 4 | Make tour copy use the selected villager's name (R04). | 5 min |
| 5 | Repair profile tab navigation and mobile focus containment (R06/R13). | 15 min |
| 6 | Render meaningful agent summaries instead of repeated filler (R07). | 15 min |
| 7 | Rename “Weekly goal” / “Week” to “My goal” / “Weekly review” (R09). | 5 min |
| 8 | Increase supporting text size and contrast in the HUD/dialogs (R10). | 10 min |
| 9 | Clean up missing/equal challenge terms (R11). | 5 min |
| 10 | Investigate rapid-close renderer disposal; keep the working fallback (R05). | 15 min |

## Reproduction commands and actual results

Run from this worktree in PowerShell with the existing preview/API running. No
installation or application rebuild is needed on this machine. Runtime env
loading is confined to the API script; it reads `VILLAGE_ENV_FILE`, normalizes
the `/c/...` Windows path, and never writes credentials or raw API bodies.

```powershell
$env:REVIEW_PLAYWRIGHT_ROOT='C:/Users/mourn/Downloads/hacklanta/apps/web'
node tests/explore/review_ui.cjs
node tests/explore/review_details.cjs
$env:REVIEW_DETAIL_FILTER='Week evidence|Auditor grade|All Play|Phone keyboard'
node tests/explore/review_details.cjs
$env:REVIEW_DETAIL_FILTER='Phone profile focus'
node tests/explore/review_details.cjs
Remove-Item Env:REVIEW_DETAIL_FILTER
& C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe tests/explore/review_api.py
node --check tests/explore/review_ui.cjs
node --check tests/explore/review_details.cjs
git diff --check
```

- `review_ui.cjs`: **exit 1**, 49 completed / 6 exploration failures: two genuine
  blocked phone clicks, three short identity/wardrobe timeouts, one keyboard-flow
  timeout. This is an exploration result, not a passing regression suite.
- Initial `review_details.cjs`: **exit 1**, 13 completed / 2 script-selector
  failures. Those were fixed as described above; the entire script was not rerun
  after this change.
- Filtered Week/auditor/identities/phone-keyboard follow-up: **exit 0**, 4/4
  completed. Preserved output: `details-retry-results.json`.
- Phone-focus probe: first **exit 1** because the self-card covered Dev's scene
  button (R01). Repeated with keyboard activation: **exit 0**, observation
  completed and confirmed R13. A completed probe does not mean accessibility
  passed. The final full details script has not been run end-to-end.
- `review_api.py`: **exit 0**, all 58 probes complete, no 5xx assertion failures,
  with the non-member and missing-fixture limitations above.
- Three PowerShell `Invoke-RestMethod http://127.0.0.1:8010/api/health` probes:
  **exit 0**, 486 / 407 / 429 ms, DB and worker up.
- Both `node --check` commands and `git diff --check`: **exit 0**.

## Handoff

Exploration milestone: `92be5ad` on `review/REVIEW-001` (existing initial scripts
were already committed at `c7e6958`). This report is committed separately; use
`git log -1 --oneline -- docs/reviews/REVIEW-001.md` for its commit.

Changed deliverables: this report, `tests/explore/review_details.cjs`, and the
retained identity-wait improvement in `tests/explore/review_ui.cjs`. No application,
root, environment, or contract files changed. No push or merge performed.

Teammate quick try: open localhost:4173 at 390×844 to reproduce R01/R02, resize
to 1366×768 for R03, then start Tour and advance once for R04. The commands above
recreate deeper evidence; raw screenshots remain local and gitignored.

**Blockers:** No authenticated non-member fixture; no successful group-photo or
photo-item-job fixture to read. Mutation/generation/transaction success paths
remain intentionally untested. **Proposed contract changes: none.** An isolated
non-member test fixture is needed, not a production HTTP/schema change.
