---
id: TRAILER-002
owner: codex (gpt-6-astra, medium)
branch: media/TRAILER-002
allowed_paths: [apps/trailer/**, docs/devpost/video/**]
---
# TRAILER-002 — v2 launch film: the owner's framing, current UI, startup-slick (R-138)

Start from TRAILER-001's Remotion project (`apps/trailer`, merged on this branch's base or available on
`media/TRAILER-001`; read its `docs/devpost/video/TRAILER.md`). v1 is polished but used OLD UI captures (e.g. Mayor with
emoji options) and a cozy-village story. The owner wants this exact framing, as a slick launch film for a new tech startup:

> We use AI and ML to automate the hardest part of friend groups and communities: getting people together. Village is a
> community where people are incentivized every day to check in, post with close friends what they're doing, and use
> friendly, public competition to push each other toward their goals. **Solana** provides the financial incentives and
> the economy. **Gemini** provides the creativity: nudges, challenges, and forcing us to hang out to avoid calamity
> (disasters). **ElevenLabs + computer vision** bring our avatars into the real world. **iMessage** nudges us with IRL
> messages and lets us send evidence of goals back seamlessly.

**Structure (~60–75 s, 1080p60 + a 30 s 1:1 cut):** hook (the problem: group chats go quiet, friends drift; big kinetic
type) → the promise ("AI that gets your people together") → four pillar sections, each with a bold title card, a one-line
value prop and a fast montage of REAL current-UI captures:
- **Show up daily:** check-in cinematic, goals and stretch goals, streaks, the friends hub, cheers, live multiplayer.
- **Compete in public:** Colosseum, competitions, auditor, weekly review, crown; **Solana** stakes and devnet pot as
  the economy (say "devnet" in small print; intent, not real money).
- **An AI Mayor that won't let you drift:** Gemini nudges, challenges, the Gazette, disasters you must repair together
  ("hang out or the town burns").
- **Your avatar, brought to life:** photo → SAM 3 → 3D head, ElevenLabs voice and talking heads, wardrobe and houses.
- Then **IRL via iMessage:** the Mayor texts you; reply with a photo as evidence (illustrative phone mock, labelled).
→ a stack strip (Gemini · Solana · ElevenLabs · Computer Vision (SAM 3 / LAM / Hunyuan3D on Modal) · Photon iMessage ·
TigerData · Vultr · Auth0) → end card: "Village. Get your people together." plus the URL.
**Fresh captures:** record new clips with Playwright from https://207-246-81-187.sslip.io, READ-ONLY (no buys,
check-ins, sends, uploads or debug), at 1920×1080: the new Mayor (WEB-042), check-in (WEB-040/048), the friends hub, the
reading list, the town with the dense forest and walking villagers, the café close-up (double-click), Community Hall
interiors with avatars, the Colosseum, the wardrobe, house undo. Two browser contexts are fine for showing multiplayer.
**Style:** startup launch energy. Fast cuts on the beat, bold kinetic type, smooth camera pushes over UI, device frames,
glow/grain, a confident color palette (the app's forest/sage plus a punchier accent), captions always on. Reuse
TRAILER-001's CC0 soundtrack, or another CC0 track with its license committed. No paid generation.
**Outputs:** keep renders OUT of git (add `*.mp4` under docs/devpost/video to .gitignore; commit sources, the poster
and TRAILER.md only). Write `village-trailer-v2.mp4` (≤ 60 MB), `village-trailer-v2-square.mp4` (≤ 24 MB so it fits on
Discord), and a poster PNG to `docs/devpost/video/`. Render on the runner if needed (`ops/remote_run.sh`, AGENTS.md).
Final report per AGENTS.md, with frame grabs of each section.
