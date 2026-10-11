# Demo testing guide: photo items, onboarding, group photo

## Prepare this branch

Use Python 3.12 and the existing runtime `VILLAGE_ENV_FILE`; never copy its values.
From `apps/api`, run `python scripts/migrate.py` and `python scripts/sync_catalog.py`,
then start the API normally. The migration adds automatic refunds and a guest-number sequence;
catalog sync publishes the 25 XP `photo_token` consumable. Restart/rebuild the web app.
These commands are for the teammate's chosen deployment; this task's tests used isolated
`village_test` schemas and did not migrate or restart the shared live preview.

For an entirely offline walkthrough, from `apps/web` set `VITE_MOCK=1` and
`VITE_DEMO_AUTH=1`, then `bun run dev`. Mock results are explicitly labelled simulations.

## Make it real

1. Pick a seat. Open **Shop → Make it real**, or **My profile → Owned items → Make it real**.
2. **Buy photo token · 25 XP**. Multiple tokens can be bought; existing Mayor-event and crown
   grants still work. Insufficient XP leaves the balance unchanged.
3. Upload a JPG/PNG/WebP under 10 MB, or use **Take a photo** on a camera-capable device.
   Choose **Wearable** (Torso or Head) or **3D decoration**. Optional description: `potted plant`.
4. Tick photo-processing consent and click **Create**. This is the explicit generation action.
   Live objects can incur the existing worker's Gemini call. Tests do not call paid providers.
5. The panel polls every 2 seconds. Closing and reopening it resumes the job in the same tab.
   It shows queued/running and the pipeline path. Current bridge status is coarse: segment covers
   the complete pipeline, so stylize/3D completion is not guessed. Worker offline means queued.
6. Click **Equip wearable** or **Place at my house**. Outfits attach to the town villager using
   tint plus pattern; decorations load their authenticated GLB beside the house. Missing assets
   retain visible geometry. The showcase uses the same object renderer.
7. Worker failure returns the token automatically, including if the browser is closed.
   Invalid output also refunds when the API validates it. The error explains the failure and
   the token balance is refreshed. In mock mode upload a synthetic file named `failure.png`
   to exercise this path; other photos return a simulated item with no generation.

## Start as a new person

1. Open **Debug menu → Start as a new person** (or Ctrl+Shift+D).
2. The API creates a tagged **Guest N**, switches this browser's seat, and opens onboarding.
   Seeded identities and memberships are unchanged.
3. Enter a display name and invite **HACKLANTA**, then **Join village**.
4. Choose a selfie, tick consent, and **Build my avatar**. The preset remains usable when the
   GPU is offline. **Enter village** works without waiting for a generated avatar.
5. The testing-seat label marks this identity as a demo guest, even after renaming.
6. **Debug menu → Remove guest users** removes tagged guests and returns to Iraj.
   It never identifies guests by their display name, and never deletes the five seeded users.
   If an avatar is actively processing, cleanup asks you to retry once it finishes.

Live guest routes are unavailable unless both DEMO_AUTH and DEMO_DEBUG are enabled;
Bearer-authenticated and non-demo callers cannot create or clean up demo guests.

## Evidence

`tests/web025.spec.ts` covers wearable/decoration creation, consent, equipment, token refund,
and new person → onboarding → avatar submission → village → cleanup.
Screenshots from actual Chromium runs are in `tests/screenshots/WEB-025-*.png`.
They show the labelled offline simulation, not claims of live GPU generation.

---

## 3. Group photo (`components/GroupPhotoPanel.tsx`, `apps/api/app/group_photo.py`)

**Where:** the **"Village"** action button (sprout icon, title "Village - V") (shortcut **V**) → **"Our group photo"** button → dialog "Our group photo".

**API routes** (prefixed with `/api/villages/{vid}/group-photo`):
| Route | Who | What it does |
|---|---|---|
| `POST ""` (multipart `file` + `consent`) | Owner only | Returns `{job_id}`. |
| `GET /{job_id}` | Members | Returns crops with bbox and claim state. The panel polls this every 2–5 s. |
| `POST /{job_id}/claim` with `{crop_id}` | Members | Queues that member's avatar job from the crop. |

Worker side: `POST :8100/segment/group`.

**Steps:**
1. **Upload (seat Iraj only).** Other seats see "The village owner uploads the shared photo."
   1. Under **Group photo**, choose a JPG/PNG/WebP **under 5 MB**: several people, faces visible, ideally the testers themselves.
   2. Tick **"Everyone in this group photo consents to its use to build their avatar."**
   3. Click **"Find our people"** (it says **"Replace group photo"** if a job exists).
2. Wait for "Finding your people · queued/running". Detection takes about 24 s cold (SAM 3 load) or a few seconds warm. Outlined boxes "Person 1…N" then appear over the photo, with a crop grid below.
3. **Share the job ID** shown as "Share this photo job ID with your village: `<uuid>`". Other testers can't see Iraj's upload automatically, because the job ID is stored in the uploader's sessionStorage.
4. **Claim (each tester, on their own seat):**
   1. Open **Village → Our group photo**, expand **"Open a shared photo job"**, paste the ID, and click **"Open photo"**.
   2. On your face, click **"This is me"**. The tile then shows "Claimed by <name>" for everyone, and the avatar-stage list (segment / head / stylized head) appears in the dialog.
   - The claim itself takes about 1 s, because nothing is re-segmented. Then the same head → 3D-head chain runs as in onboarding: about 50 s LAM head plus about 2–3 min 3D head cold.
5. The result appears where onboarding avatars do (portrait, profile, town head).

**Gotchas:**
- Each person gets one crop per photo, and each crop can be claimed once. Otherwise the API returns 409 "Crop or member already claimed".
- Claiming fails with 409 "An avatar pipeline is already in progress" if that seat has a selfie build running.
- A claim **overwrites that seat's current avatar**.
- "Reset whole demo village" drops the village↔photo link. Re-uploading the same image brings back the same job.
- Optional no-upload test: the CV-005 fixture job `d5eca46a-2175-4915-8c3d-df1d040cea29` (5 crops, demo village) can be opened via "Open a shared photo job", if it hasn't been deleted.


## COPY-001 copy review

Copy-only pass across the web UI, demo fixtures, Mayor fallbacks and iMessage photo errors. The shared Mayor system prompt supplies the style block to both providers, including Gazette and scheduler calls. Facts, schemas, consent rules and AI disclosure labels are preserved. No assets or paid content were regenerated. The legacy GazetteDraft headline enum remains unchanged because it is an integration value.

### Before / after: 40 visible strings

| Surface | Before | After |
| --- | --- | --- |
| App.tsx | SMALL STEPS. GOOD COMPANY. | THE NEIGHBORHOOD |
| App.tsx | Life’s better / in a village. | Your friends. / One village. |
| App.tsx | A little place to grow, together. | Set a goal. See what the neighbors are up to. |
| Auth.tsx | Sign in to join your friends and grow together. | Sign in to find your friends. |
| components/Onboarding.tsx | Make your villager feel like you | Add your face |
| components/Onboarding.tsx | A little place to belong. | Your friends live here. |
| components/Onboarding.tsx | You’re in! Add an avatar, or start with your preset. | You’re in. Add an avatar, or use your preset. |
| components/Modals.tsx | How’s your little corner? | What’s new? |
| components/Modals.tsx | A MOMENT TO SHOW UP | CHECK IN |
| components/Modals.tsx | Big wins, small steps, and everything in between. | Post an update for your neighbors. |
| components/Modals.tsx | Today, I showed up by… | Today I… |
| components/Modals.tsx | Showing up is the part that matters. | A daily note counts once per day. |
| components/Modals.tsx | Your weekly intention is planted. | Goal saved. |
| components/Modals.tsx | YOUR WEEK, YOUR PACE | THIS WEEK |
| components/Modals.tsx | Pick something meaningful. Your village will cheer you on. | Pick a goal your friends can follow. |
| components/Modals.tsx | Make time for something that matters | Run three times this week |
| components/Modals.tsx | What would a small win look like? | What counts as done? |
| components/Modals.tsx | A little detail helps you get started. | Three runs of at least 20 minutes. |
| components/Modals.tsx | Edits are always welcome. | You can edit it later. |
| components/MayorModal.tsx | KEEPER OF OUR LITTLE VILLAGE | TOWN HALL |
| components/MayorModal.tsx | Our village needs a little care | Repairs needed |
| components/MayorModal.tsx | A village grows when its people do. | The Mayor is taking requests. |
| components/MayorModal.tsx | A wish, a question, a little encouragement… | What should happen around town? |
| components/MayorModal.tsx | Send a little wish | Send wish |
| components/Dashboard.tsx | Small steps, good company. Your next chapter starts with a check-in. | No Mayor notes yet; post a check-in while you wait. |
| components/ProfileSections.tsx | Small steps become things you can wear. Earned rewards stay in your collection. | Earned rewards stay in your collection. |
| components/VillagePanel.tsx | Your first building is just ahead. | No buildings unlocked yet; check in to earn village XP. |
| components/VillagePanel.tsx | You’ve built everything available. Keep growing together! | All available buildings are built. |
| components/CompetitionsPanel.tsx | No competitions here yet. Start something together. | No competitions yet; create one. |
| components/Colosseum.tsx | Small steps. / Legendary rivalries. | Friends today. / Rivals all week. |
| components/Colosseum.tsx | Preview a banner. Read the terms. Take your place. | Pick a competition and read the terms before joining. |
| components/colosseumData.ts | Together to the summit | Race to the summit |
| components/colosseumData.ts | Build momentum together. Each confirmed point contributes to your team. | Each confirmed point counts toward your team score. |
| api/fixtures.ts | Ship something that brings us together | Ship a group photo album |
| api/fixtures.ts | Small steps count. Share the journey with your people. | Post progress here so the crew can follow along. |
| api/fixtures.ts | Made a little more progress. It’s coming together! | Got another session in today. |
| api/fixtures.ts | Showed up for my goal today. Feeling good about it. | Worked on my goal today. |
| api/fixtures.ts | Share one check-in together to clear the fog. | Share one group check-in to clear the fog. |
| api/fixtures.ts | A little better, together | Roll call |
| api/fixtures.ts | Everyone share one step toward your weekly goal. Five small wins make a big village celebration. | Everyone post an update on your weekly goal. Five updates earn a village celebration. |

### Validation and handoff

Branch: `copy/COPY-001`. Implementation milestone: `6b13375`; the follow-up commit finishes the empty-state sweep and this report. All changes are copy literals, prompt text, a stale label assertion, or documentation.

Commands and results (run from the named app):

- Web: `bun install --frozen-lockfile` — exit 0. Initial tests/build could not resolve dependencies; installation resolved that.
- Web: `bun test src --timeout 30000` — exit 0, 179 passed, 0 failed (final copy). The first installed run had a stale `DEVNET` assertion plus polling/thumbnail timing failures under load. Updated the allowed assertion to the existing `devnet · test` label; all tests then passed, including the timing cases.
- Web: `bun run build` — exit 0; Vite reports large chunks, unrelated to copy.
- iMessage: `bun install --frozen-lockfile` — exit 0; `bun test` — exit 0, 20 passed; `bun run typecheck` — exit 0.
- API: `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe -m pytest -q` with `VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env` — exit 1: 124 passed, 3 skipped, 311 setup errors. `-m pytest -x -q --tb=short` confirms `psycopg.errors.DuplicateColumn: column "scoring" of relation "competitions" already exists` in `scripts/migrate.py`, called by the isolated test schema setup. No live village API was used. Migration and contract edits are outside this task.
- `git diff --check` — exit 0.

The full suite cannot be called green. Tests outside allowed_paths still assert old copy and need an integrator's literal-only update:

| Test file(s) | Old assertion | New assertion |
| --- | --- | --- |
| `apps/web/tests/village.spec.ts` | `Life’s better` | `Your friends.` |
| `apps/web/tests/village.spec.ts`, `polish.spec.ts` | `Send a little wish` | `Send wish` |
| `apps/web/tests/connection.spec.ts`, `web025.spec.ts` | `A little place to belong.` | `Your friends live here.` |
| `apps/web/tests/connection.spec.ts`, `fix006.spec.ts` | `Get for` | `Buy for` |
| `apps/web/tests/web012.spec.ts` | `Five small wins make a brighter village` | `The weekly goals are in` |
| `apps/web/tests/web012.spec.ts` | `Small steps, a growing village` | `Around the village` |
| `apps/web/tests/web028.spec.ts` | `Small steps. Legendary rivalries.` | `Friends today. Rivals all week.` |
| `apps/api/tests/test_api006.py`, `test_feat011.py` | `next small step` | `Use goal: to set a goal` |

These tests were left untouched to respect the explicit allowed_paths restriction. No contract changes proposed. Legacy enum strings and template IDs are deliberately preserved; ordinary uses of “together” describing actual group activity are not slogans and remain.

Try it: from `apps/web`, set `$env:VITE_MOCK='1'; $env:VITE_DEMO_AUTH='1'` in PowerShell, then run `bun run dev --port 5184`. Choose a demo seat and open Check in, My goal, Mayor, Gazette, and Compete. Mock mode needs no generated assets or provider keys. The model style changes apply to future requests; existing stored Gazette editions are not rewritten.

Files changed:

- `apps/api/app/disasters.py`
- `apps/api/app/inbound.py`
- `apps/api/app/mayor.py`
- `apps/api/app/newspaper.py`
- `apps/imessage/src/agent.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/Auth.tsx`
- `apps/web/src/api/fixtures.ts`
- `apps/web/src/api/gazette.test.ts`
- `apps/web/src/api/gazette.ts`
- `apps/web/src/api/mock.ts`
- `apps/web/src/components/Accomplishments.tsx`
- `apps/web/src/components/Colosseum.tsx`
- `apps/web/src/components/CompetitionsPanel.tsx`
- `apps/web/src/components/Dashboard.tsx`
- `apps/web/src/components/Gazette.tsx`
- `apps/web/src/components/MakeItReal.tsx`
- `apps/web/src/components/MayorModal.tsx`
- `apps/web/src/components/Messages.tsx`
- `apps/web/src/components/Modals.tsx`
- `apps/web/src/components/Onboarding.tsx`
- `apps/web/src/components/ProfileOutfit.tsx`
- `apps/web/src/components/ProfilePanel.tsx`
- `apps/web/src/components/ProfileSections.tsx`
- `apps/web/src/components/Tour.tsx`
- `apps/web/src/components/VillagePanel.tsx`
- `apps/web/src/components/Villagergram.tsx`
- `apps/web/src/components/Wardrobe.tsx`
- `apps/web/src/components/WeekPanel.tsx`
- `apps/web/src/components/colosseumData.ts`
- `docs/DEMO_TESTING.md`

Browser validation: inline Node/Playwright smoke against `http://127.0.0.1:5184` in forced mock mode, with the fixture seat set via localStorage, exited 0. It asserted the welcome screen, check-in helper, goal completion label and Mayor send button without submitting actions. The initial attempt omitted the demo seat and was blocked by the seat picker; rerunning with the same setup as `tests/demoSeat.ts` passed. Screenshots were visually inspected:

- `C:/Users/mourn/AppData/Local/Temp/village-copy001.png`
- `C:/Users/mourn/AppData/Local/Temp/village-copy001-checkin.png`
- `C:/Users/mourn/AppData/Local/Temp/village-copy001-mayor.png`

The final web build was rerun after the last empty-state edits: exit 0. No paid model calls, messages to real recipients, or live demo mutations were made.
