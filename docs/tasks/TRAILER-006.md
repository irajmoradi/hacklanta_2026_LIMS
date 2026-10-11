---
id: TRAILER-006
owner: codex (gpt-6-astra, medium)
branch: media/TRAILER-004
allowed_paths: [apps/trailer/**, docs/devpost/video/**]
---
# TRAILER-006 — 90-second cut: faster, big opening title, larger captions (URGENT, 20 minutes)

Owner (Iraj), the Devpost deadline is 09:00 ET: edit ONLY the 90-second cut (`village-trailer-v4-90`) from the existing v4
sources/captures (no new captures, no new generation):
1. **Opening title card (first ~2.5 s):** large, bold, centered: **"WEEKLY CHALLENGES AND DAILY CHECK-INS WITH FRIENDS"**
   (fill most of the width, high contrast, same palette/font as the trailer). Then the existing hook continues.
2. **Slightly faster:** tighten beats ~10–15% so the total, including the new title, is about 80–85 s (still under 90 s).
3. **Larger captions everywhere in this cut:** roughly 1.6–1.8× the current caption size, with a solid/darker caption band so
   they read on a phone. Never overlap or clip; wrap to at most 2 lines.
Render 1080p `village-trailer-v4-90.mp4` plus the ≤ 24 MB Discord copy `village-trailer-v4-90-discord.mp4`, and a contact sheet.
Verify the files decode. Commit only sources (mp4s stay gitignored). Be quick: skip anything optional. Final report per AGENTS.md
with the duration and file size.
