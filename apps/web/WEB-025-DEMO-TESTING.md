# WEB-025 demo testing guide

This is the replacement guidance for sections 1–2 of `docs/DEMO_TESTING.md`.
That file is outside WEB-025's allowed paths; the integrator should copy these updates there.
The original group-photo section remains applicable.

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
