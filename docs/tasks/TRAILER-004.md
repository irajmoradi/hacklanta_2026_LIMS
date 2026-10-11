---
id: TRAILER-004
owner: codex (gpt-6-astra, medium)
branch: media/TRAILER-004
allowed_paths: [apps/trailer/**, docs/devpost/video/**]
---
# TRAILER-004 — v4: longer, more explicit, real iMessage, every system shown (R-173, owner)

Start from TRAILER-003 (merged on main: `apps/trailer/`, `docs/devpost/video/TRAILER.md`). Owner (Iraj) notes on v3:
1. **Artifact at ~0:37:** vertical "placeholder face" text over the Colosseum challenge cards. The app is fixed (R-172, deploying);
   re-capture that shot from prod after the fix and check every frame for stray text/labels.
2. **Updated Mayor:** capture the current Mayor experience (the frosted Mayor over the live plaza with camera bob, WEB-053),
   not the old modal.
3. **Actual iMessage:** replace the illustrated phone mock with real content. Use the real Mayor texts/gram that were
   delivered (read-only from prod with the Iraj demo-seat header, or from the API's outbox data) in a faithful iMessage
   frame, labelled honestly. If `docs/devpost/video/input/imessage-*.mp4|png` exists (the owner may drop a real screen
   recording there), use it instead and prefer it.
4. **Original voice:** use a longer clip of Iraj's own recorded voice (5–8 s, from his consented clone source / an
   existing recording; D-041) before the ElevenLabs clone speaks.
5. **Length:** main cut 75–95 s (beyond a minute, still fast-paced); square cut ≤ 40 s.
6. **More explicit avatar pipeline:** hold longer on each step with clear labels and motion: photo → SAM 3 mask animating on →
   extracted traits (swatches flying onto the villager) → villager → LAM Gaussian splat **large, sharp, slowly orbiting**
   (capture at higher resolution/zoom from the big head view; no blurry upscale) → talking head.
7. **New sections (real captures from prod, read-only):** item generation (Hunyuan3D object → mesh → in-game prop: show a
   generated item's turntable and it appearing in the shop/house), **pets** (shelter, adopt flow screens, pet following its
   owner; no adoption actually submitted), **synced walking** between two browsers (two windows side by side, the same
   villager moving in both), **interior design** (house editor + Community Hall decorating) and **persistence**: a
   TigerData caption ("live house state in TigerData, LISTEN/NOTIFY") with an edit in one window appearing in the other, and
   a "persistent, lived-in world" beat (time of day, villagers going about their routines).
8. **The shared-goal loop (owner: "why not in video?"):** show that the village grows only together. Group challenges and
   check-ins earn collective XP → the level bar fills → a global building unlocks with its celebration (e.g. the **Pet
   Shelter**, which is what enables pets, or the Ferris wheel) → a disaster hits (closed building, charring/blackout) →
   everyone's check-ins fill the repair bar → the repair reveal. Capture the progression and disaster beats from the hidden
   Demo Lab at `/lab` (sandbox, safe: Village futures + Disasters & repair scenes), and the real challenge cards and village
   growth panel from prod read-only. Caption it plainly: "Unlock the town together. Save it together."
Same capture rules as TRAILER-003: Playwright from https://thefriendshipvillage.vodka, READ-ONLY (no buys, check-ins, sends,
uploads, adoptions, debug or world changes). For the two-window sync and interior edit beats, use a scratch/mock instance
(`ops/remote_run.sh --with-api`, or mock mode) rather than editing the live village. Only Iraj's real face/voice (D-041).
Outputs in `docs/devpost/video/` (gitignored mp4s; commit sources, poster, TRAILER.md): `village-trailer-v4.mp4` (1080p),
`village-trailer-v4-discord.mp4` (≤ 24 MB), `village-trailer-v4-square.mp4` (≤ 24 MB), poster, and a frame contact
sheet. Final report per AGENTS.md.
