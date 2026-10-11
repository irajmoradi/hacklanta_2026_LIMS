---
id: TRAILER-003
owner: codex (gpt-6-astra, medium)
branch: media/TRAILER-003
allowed_paths: [apps/trailer/**, docs/devpost/video/**]
---
# TRAILER-003 — v3: real face → avatar → Gaussian splat, voice clone, every feature, faster (R-156, owner)

Owner (Iraj): "Make the video show my face, Iraj's face, turning into the avatar and 3D Gaussian splat, and my voice being
cloned into the ElevenLabs voice, and include the SHOP, include the PET SHELTER, include all the features in the video (or
not all, but a lot). Make the video faster as well."
Start from TRAILER-002 (this branch; the end card already says https://thefriendshipvillage.vodka). Keep its framing (AI gets
your people together; Solana economy, Gemini Mayor, ElevenLabs + CV avatars, iMessage IRL loop) and its look, but:
1. **Hero pipeline sequence (~12–15 s, the centerpiece):** Iraj's real photo → SAM 3 segmentation mask overlay → his LAM
   **3D Gaussian-splat head rotating** (record it live from his profile/HeadStudio: click "Open big head view", drag to rotate)
   → his stylized walking villager in town. Then the **voice clone:** waveform/spectrogram of his recorded voice → the
   "ElevenLabs voice" label → his avatar's talking head speaking a cached line (use an existing cached gram/talk clip; NO new
   generation). On-screen labels name each model (SAM 3 · LAM · Audio2Expression · ElevenLabs · Hunyuan3D, on Modal GPUs).
   **Consent and scope:** use ONLY Iraj's face and voice (the owner consented, D-041). Never use other teammates' real
   faces or voices; show them as preset/placeholder avatars or blur them.
2. **Feature montage, fast cuts (0.8–1.5 s each), many features:** check-in cinematic, goals and stretch goals, friends hub +
   cheers, live multiplayer walking (two windows), the Mayor (plaza + options + village dashboard), the Gazette, disasters you
   repair together, **Shop** (clothing store interior, try-on, the new bottoms/shoes/glasses), **Pet Shelter** (pets, adopt a
   pet), the farm store, houses: interiors, connected floors and stairs, Community Hall decorating with undo, the café
   close-up with seated villagers, the reading list/library, the Colosseum and competitions with the Solana devnet pot,
   and the iMessage Mayor (phone mock: a text arrives, a photo is sent back as evidence). Keep captions on.
3. **Faster overall:** target 55–65 s for the main cut and 25–30 s for the square cut; tighter beats, quicker type animations,
   higher-energy music edit (same CC0 track, or another CC0 track with its license committed).
**Capture:** Playwright from https://thefriendshipvillage.vodka, READ-ONLY (as the Iraj seat: no buys, check-ins, sends,
uploads, debug or world changes). Assets such as Iraj's face/head/talk clip may be fetched with the demo-seat header,
read-only. Keep renders out of git (mp4s are gitignored; commit sources, the poster and TRAILER.md). Outputs in
`docs/devpost/video/`: `village-trailer-v3.mp4` (1080p) and a ≤ 24 MB copy (`village-trailer-v3-discord.mp4`),
`village-trailer-v3-square.mp4` (≤ 24 MB), and a poster. Render on the runner if needed (`ops/remote_run.sh`, AGENTS.md).
Final report per AGENTS.md, with frame grabs of the pipeline sequence.
