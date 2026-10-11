---
id: DOCS-013
owner: codex (gpt-6-astra, medium)
branch: docs/DOCS-013
allowed_paths: [docs/devpost/SUBMISSION.md, docs/devpost/DEMO_SCRIPT.md, docs/devpost/EVIDENCE.md]
---
# DOCS-013 — Rewrite the Devpost story with the owner's framing (R-138)

Rewrite `docs/devpost/SUBMISSION.md` (keep the Devpost section headings: Inspiration, What it does, How we built it,
Challenges, Accomplishments, What we learned, What's next, Built with) around this framing from the owner:

> We use AI and ML to automate the hardest part of friend groups and communities: getting people together. Village is a
> community where people are incentivized every day to check in, post with close friends what they're doing, and use
> friendly, public competition to push each other toward their goals. **Solana** provides the financial incentives and
> economy. **Gemini** provides the creativity: nudges, challenges, and forcing us to hang out to avoid calamity. **ElevenLabs
> and computer vision** bring our avatars into the real world. **iMessage** nudges us with IRL messages and lets us send
> evidence of goals back seamlessly.

- Lead with the problem and that thesis; make the four pillars (Solana economy, Gemini Mayor, ElevenLabs+CV avatars,
  iMessage IRL loop) the spine of "What it does" and "How we built it", with concrete current features (live multiplayer,
  friends hub, cinematic check-in and Mayor, disasters you repair together, Colosseum, reading list, interiors and Hall,
  wardrobe).
- Keep it honest: verify every claim against current `main` and `docs/ARCHITECTURE.md`. Keep the existing caveats
  (Solana is devnet, stakes are intent; iMessage video delivery evidence; what's simulated) but phrase them confidently
  and briefly. Mention the stack accurately (Gemini 2.5 Flash-Lite via Vertex; Modal L4 GPUs for SAM 3 / LAM /
  Audio2Expression / Hunyuan3D; TigerData; Vultr; Auth0; Photon Spectrum).
- Punchy, specific, startup-pitch tone but plain (no buzzword soup). 900–1,400 words. Also tune the side-challenge
  paragraphs (AI/ML main track; Mercedes CV, Photon iMessage, ElevenLabs).
- Align `DEMO_SCRIPT.md` beats with the same story (≤ 150 s), and update EVIDENCE.md links if any changed.
Final report per AGENTS.md with a word count and a list of every claim you verified, each with the file it was checked against.
