---
id: TRAILER-001
owner: codex (gpt-6-astra, high)
branch: media/TRAILER-001
allowed_paths: [apps/trailer/**, docs/devpost/video/**]
---
# TRAILER-001 — Snazzy launch trailer with Remotion (R-134, owner)

Owner: "do you know remotion or how to make snazzy launch trailers/videos". Build a 60–75 s launch trailer for the Devpost
page with Remotion (React video), in a new standalone project `apps/trailer/` (its own package.json; bun; pin exact
versions; don't touch the other apps).
- **Inputs (read-only):** the gallery images in `docs/devpost/gallery/screenshots/` (DOCS-011), any captures in
  `docs/devpost/video/` (DEMO-003), the tagline and story from `docs/devpost/SUBMISSION.md`, and the app's palette
  (`apps/web/src/styles.css` tokens: sage/cream/forest greens, DM Sans/Manrope). If you need fresh clips, record them with
  Playwright from the public site https://207-246-81-187.sslip.io read-only (no buys, check-ins, sends or uploads), at
  1920×1080 and 60 fps where possible.
- **Story beats (~8):** cold open on the town at dusk with the title "Village" ("A small town for your group chat") →
  your friends become avatars (photo → 3D head, wardrobe) → check-ins and goals earn XP/coins → the AI Mayor (cinematic) →
  the friends hub, cheers and the reading list → Community Hall and house interiors → the Colosseum and competitions → the
  iMessage Mayor ("texts you when you disappear") → end card with the URL, the tech stack logos as text (Gemini, ElevenLabs,
  Photon iMessage, Modal, TigerData, Vultr, Auth0, Solana devnet) and "Built at Hacklanta".
- **Style:** kinetic typography synced to the beat, smooth springs, parallax pans over the screenshots, device frames
  (laptop + phone), quick cuts, subtle grain, the app's colors. Captions are always on (readable when muted). It should
  feel like a polished product launch, not a slideshow.
- **Audio:** music must be CC0 or royalty-free with the license file committed next to it (e.g. a Pixabay or FMA CC0 track;
  record the source URL). No copyrighted songs. No paid generation: no ElevenLabs or Gemini calls. Silent with captions
  is acceptable if no suitable CC0 track is found.
- **Outputs:** `docs/devpost/video/village-trailer.mp4` (1080p H.264, ≤ 60 MB), a 1:1 30 s cut for social
  (`village-trailer-square.mp4`), a poster frame PNG, and `docs/devpost/video/TRAILER.md` (beats, timings, credits,
  licenses, how to re-render). Render on the remote runner if local is slow (`ops/remote_run.sh`, AGENTS.md); Remotion
  needs Chromium + ffmpeg, which the runner has.
Final report per AGENTS.md, with the rendered file paths and a few frame grabs.
