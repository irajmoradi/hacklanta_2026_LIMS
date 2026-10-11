---
id: DOCS-014
owner: codex (gpt-6-astra, medium)
branch: docs/DOCS-014
allowed_paths: [README.md, .env.example, docs/SETUP.md, docs/devpost/**, docs/infra/**]
---
# DOCS-014 — Setup guide for every service + refreshed Devpost write-up (R-178, owner)

Owner (Iraj): "Remember to have a README with setup for future people, for all services used, and the Devpost."
Read the code (it's the source of truth), `README.md`, `docs/DECISIONS.md`, `docs/REQUESTS.md`, `docs/infra/*`,
`ops/deploy/*`, `docs/solana/*`, `docs/devpost/*`, `.env.example`, each app's config loader (`apps/api/app/config.py`,
`apps/imessage`, `apps/web` `import.meta.env`), `workers/gpu`.
1. **`docs/SETUP.md` (linked from the README's top):** from a fresh clone to a running stack, then to production. For **each
   service actually used**: what it does in Village, how to get credentials (sign-up page, plan/tier we used, which
   product/console screen), the exact env vars (names only, never values) and where they're read, a smoke test command,
   cost notes (from docs/ where recorded), and what degrades if it's missing (the app must run with zero keys in mock mode).
   Cover at least: Postgres + TimescaleDB (Docker), TigerData (house interiors, LISTEN/NOTIFY), Gemini via Vertex AI express
   (`gemini-3.5-flash-lite`) + OpenRouter fallback, ElevenLabs (IVC clones, TTS, consent), Modal GPU (SAM 3, LAM,
   Audio2Expression, Hunyuan3D, video renders; deploy commands), the CPU bridge, Photon Spectrum iMessage, Auth0 + demo
   auth, Solana devnet (program build/test/deploy runbook from docs/solana, the program id + treasury vars, wallets),
   Vultr VM + Caddy + systemd + the domain, the remote test runners (`ops/remote_run.sh`), cost caps (SEC-001 vars).
   Include a "local in 5 minutes (mock mode)" path and a "production deploy" path (`ops/deploy/prod-deploy.py`).
2. **README:** keep its dense architecture sections, make sure they match the current code (Demo Lab `/lab`, payout modes,
   Treasury, Mayor-chosen repair tasks if merged, overworld sync, Gemini 3.5 Flash-Lite), and add quick links (live URL,
   SETUP, Devpost, trailer, demo script).
3. **`.env.example`:** every variable the code reads, grouped by service with one-line comments, placeholders only.
4. **Devpost (`docs/devpost/SUBMISSION.md`, `DEMO_SCRIPT.md`):** refresh to tonight's product: inspiration, what it does, how
   we built it (per service), challenges, accomplishments, what we learned, what's next; side challenges (AI/ML track,
   Mercedes Best CV, Photon iMessage, MLH ElevenLabs; check docs/DECISIONS.md D-002) with one paragraph each on how we
   qualify; "try it" instructions incl. the hidden Demo Lab; plain voice (COPY-001), no AI-isms, honest about devnet/test SOL.
Never include secrets, keys, tokens, phone numbers, IPs of private runners, or anyone's private data. Final report per AGENTS.md.
