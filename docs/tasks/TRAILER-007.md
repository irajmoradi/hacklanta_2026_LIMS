---
id: TRAILER-007
owner: codex (gpt-6-astra, medium)
branch: media/TRAILER-004
allowed_paths: [apps/trailer/**, docs/devpost/video/**]
---
# TRAILER-007 — 82 s cut: remove Auth0, add Gemini chibi + goals beats, light polish (URGENT, ~10 minutes)

Owner, deadline imminent. Edit the 82 s short cut (`village-trailer-v4-90`, TRAILER-006) only:
1. Remove "Auth0" everywhere it appears (stack slide, end card, any caption). Re-flow the remaining stack names cleanly.
2. **Add a Gemini chibi beat** right after the SAM 3 / traits beats (~2.5 s): side by side, Iraj's real photo
   `docs/devpost/video/input/iraj-face.png` → arrow → his Gemini chibi `docs/devpost/video/input/iraj-gemini-chibi.png`, chip
   "GEMINI IMAGE · STYLIZE", caption "Gemini turns your photo into your villager's chibi face." Then the existing villager / Hunyuan3D
   beat ("Hunyuan3D turns it into a 3D head"). Copy these two images into `apps/trailer/public/private/` (add that folder to the
   trailer .gitignore; never commit them; only Iraj's consented face, D-041).
3. **Add or strengthen a goals beat** (~2 s) using the existing goals/stretch-goal capture: caption "Set a weekly goal. Check in daily.
   Stretch it when you're done."
4. Light polish only if it is quick and safe: consistent caption timing (no caption shorter than ~1.2 s), smooth fades between beats,
   end card holds ~2 s. No new captures, no length change beyond ±2 s.
Render the 1080p `village-trailer-v4-90.mp4` + the ≤ 24 MB Discord copy, verify they decode, and contact-sheet check that "Auth0" is gone.
Commit sources only. Report the duration and size. Speed matters more than extra polish.
