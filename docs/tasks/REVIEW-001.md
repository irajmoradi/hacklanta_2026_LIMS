---
id: REVIEW-001
owner: codex (gpt-6-astra, medium)
branch: review/REVIEW-001
allowed_paths: [docs/reviews/**, tests/explore/**]
---
# REVIEW-001 — Bug hunt: act like a picky judge and a confused new user

Read-only review of main (no app code edits). Live: web preview http://localhost:4173 (real API :8010, demo village,
"Play as" any villager), GPU worker + bridge up. Use Playwright (headed Chromium for WebGL) at 1920×1080, 1366×768 and
390×844. Never use the public tunnel URL. Never send real messages/transactions; ≤2 LLM calls, 0 ElevenLabs, 0 GPU jobs.
Don't mutate the demo village beyond reversible UI actions (if you equip/unequip, restore the original state).

1. Click through every HUD button, modal, panel, profile, tab, and tour step; open every villager; try keyboard-only
   navigation and screen-reader labels on the main controls; resize mid-session; slow network (Playwright throttling) for
   the 3D asset load; reload in the middle of flows.
2. Log: JS console errors/warnings, failed network requests, layout overlaps/clipping, unreadable text/contrast, dead
   buttons, confusing copy, inconsistent naming (e.g. "Weekly goal" vs "Week"), empty states that look broken, anything
   that embarrasses us in a 3-minute judge demo.
3. API pass: hit each GET route in /openapi.json as a demo villager and a non-member; flag 500s, slow (>1 s) routes, leaky data.
Output `docs/reviews/REVIEW-001.md`: prioritized bug list (P0 demo-breaking → P3 nit), each with repro steps, screenshot path
(save under tests/explore/artifacts/, gitignored-safe), suspected file, and a one-line suggested fix. Plus the top 10
"polish wins" for the next 2 hours. Commit the report + any exploration scripts.
