---
id: DOCS-010
owner: codex (gpt-6-astra, medium)
branch: docs/DOCS-010 (docs only; parallel)
allowed_paths: [docs/devpost/**, README.md, docs/ARCHITECTURE.md]
request: R-107 Devpost submission prep (due Sun 09:00 ET)
---
# DOCS-010 — Devpost write-up, README, architecture

Read: Hackathon.pdf (ground truth, track + judging criteria), VILLAGE_OVERNIGHT_HANDOFF.md, docs/DECISIONS.md, docs/REQUESTS.md (R-01…R-107 = what
actually shipped), docs/CV_PIPELINE_SPEC.md, docs/PLAN_COVERAGE.md, packages/contracts/api.md, and the feature reports under apps/**/(*-REPORT.md).
Submission track: **AI/ML**; side challenges to target: Mercedes Best CV, Photon iMessage, ElevenLabs (and mention Tiger Data, Auth0, Solana devnet,
Vultr, Modal where used). Write in plain, specific, human language (no AI-isms; follow COPY-001's style notes: no "journey", "seamless", "delve",
✨, triads for rhythm, em-dash-heavy sentences).
Deliver:
1. `docs/devpost/SUBMISSION.md` with the Devpost fields: Inspiration · What it does · How we built it · Challenges · Accomplishments · What we learned ·
   What's next · Built with (tags). Concrete numbers we measured (e.g. village GET p95 114 ms, house-furniture sync p95 159 ms through the tunnel,
   town 124–204 fps, 1,520-combo outfit fit matrix, LAM/SAM 3/Hunyuan pipeline timings, cost so far). Honest about what's demo-only (demo seats,
   devnet SOL intent).
2. A side-challenge paragraph per sponsor explaining exactly how we used them (CV pipeline for Mercedes CV; iMessage Mayor + Villager-grams with video
   for Photon; cloned voices + SFX + talking heads for ElevenLabs; real-time house state on Tiger; Auth0; Vultr deploy + runner; Modal GPU fallback).
3. `docs/ARCHITECTURE.md` with a mermaid diagram (web ↔ API ↔ Postgres/Tiger, GPU worker 5090 + Modal fallback, iMessage agent ↔ Photon,
   ElevenLabs, Gemini/OpenRouter, Solana devnet program, Vultr front + runner, Cloudflare tunnel) + a 1-paragraph tour of each box.
4. `docs/devpost/DEMO_SCRIPT.md`: a 2:30 judged demo script (shot list + narration lines + which seat/URL to use + fallback if the GPU is off).
5. Update README.md: what it is, the live URL https://207-246-81-187.sslip.io, how to run locally (ports 8010/4173/8100), and credits/licenses
   (CC0 placeholder faces, model licenses).
No code changes. Final report with word counts and a list of facts you couldn't verify.
