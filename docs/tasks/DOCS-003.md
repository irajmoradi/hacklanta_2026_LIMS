---
id: DOCS-003
owner: codex (gpt-6-astra, medium)
branch: docs/DOCS-003
allowed_paths: [README.md, docs/submission/**, docs/architecture/**]
---
# DOCS-003 — Bring README + Devpost + pitch up to everything now on main

Since DOCS-002 a lot merged: weekly grading UI, competitions UI, outfits/wardrobe, group-photo onboarding, village
levels/unlocks/weather, bigger festival town, content registry (packages/catalog), Mayor memory + event tiers + Gazette,
messages/bribes/presence/self-deletion, Discord/Steam activity signals, 134 GLBs, ElevenLabs SFX, stylized 3D heads,
photo-items (CV-006, in progress — check main). Read docs/PLAN_COVERAGE.md, docs/DECISIONS.md, docs/STATUS.md, every
*-REPORT.md and proposals/*.md, docs/cv/*.md, docs/solana/*.md. Verify claims against the live API
(http://localhost:8010/openapi.json) and the code; mark unverified items honestly (Photon live delivery, Solana devnet
deploy, Auth0 interactive login, Vultr deploy).

Update README.md (feature table, architecture, "how we built it with a multi-agent team"), docs/submission/devpost.md
(AI/ML track; Mercedes CV, Photon, ElevenLabs side challenges — make each challenge's evidence explicit with file paths),
pitch.md (3-minute script following the live demo: village → profile LAM head → evidence AI verdict → AI at work + Mayor
memory → Gazette → week grading → compete + pot → group-photo onboarding → shop/wardrobe), demo-video.md, and
docs/architecture/overview.md diagrams (add registry, social layer, activity service, GPU photo-items).
Run docs/submission/verify.py (+ --live). Final report per AGENTS.md.
