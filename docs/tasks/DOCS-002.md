---
id: DOCS-002
owner: codex (gpt-6-astra, medium)
branch: docs/DOCS-002
allowed_paths: [README.md, docs/submission/**, docs/architecture/**]
---
# DOCS-002 — Refresh README + submission kit to the real state of main

The README/Devpost from DOCS-001 were written before most features merged and now say "planned" for things that work.
Read the current main: AGENTS.md, docs/DECISIONS.md, docs/STATUS.md, all `*-REPORT.md` under apps/ and tests/,
docs/cv/*.md, docs/solana/*.md, apps/api/demo/README.md (3-minute tour), workers/gpu/README.md, infra/vultr/README.md.
Verify claims against code/tests where cheap (e.g. route exists in /openapi.json at http://localhost:8010/openapi.json,
tests named in reports exist). Never claim unverified behavior; mark "not yet verified live" honestly (e.g. Photon
end-to-end delivery, Auth0 interactive login, Solana devnet deploy).

Update README.md, docs/submission/{devpost.md,pitch.md,demo-video.md} for: main track AI/ML; side challenges Mercedes
Best CV, Photon iMessage, ElevenLabs. Add `docs/architecture/overview.md` with mermaid diagrams: system (web, api,
db/hypertables, gpu worker + bridge, imessage agent, solana program), the avatar pipeline (SAM 3 → LAM → A2E, timings
from CV reports), and the agent loop (scheduler → LLM decide → validate → act/outbox → agent log; auditor VLM).
Include a "How we built it" section describing the multi-agent build (Claude Code integrator + Codex gpt-6-astra
workers in worktrees + Claude CV subagent; decision log) — honest, short. Pitch script must follow the demo tour.
Run docs/submission/verify.py (update it if needed). Final report per AGENTS.md.
