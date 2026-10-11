---
id: DOCS-012
owner: codex (gpt-6-astra, high)
branch: docs/DOCS-012
allowed_paths: [README.md, docs/ARCHITECTURE.md, docs/architecture/**, docs/security/REPO-AUDIT.md, .github/**]
---
# DOCS-012 — GitHub-ready README: the entire architecture, dense and precise (R-135, owner)

Owner: "start setting up the github repo so it has a readme explaining the entire architecture in a dense, high-IQ way."
The README.md and docs/ARCHITECTURE.md from DOCS-010 predate a lot. Rewrite them for engineers and judges: dense,
precise, zero fluff, every claim true of current `main` (verify in code; cite paths). Plain voice (COPY-001); no hype words.
**README.md** (≈1,500–2,200 words; skimmable):
- A one-paragraph thesis, then a system diagram (Mermaid `flowchart`) covering: browser (React 18 + R3F scene, cinematics,
  interiors) → Caddy on Vultr → web/API (FastAPI, Python 3.12) → Postgres 17 + TimescaleDB (VM) and TigerData (house
  interiors via LISTEN/NOTIFY + hypertable move log + reducers) → GPU via Modal (SAM 3, LAM Gaussian heads,
  Audio2Expression, Hunyuan3D; scale-to-zero L4s behind a keyed gateway; bridge job queue) → providers (Gemini
  2.5 Flash-Lite via Vertex, ElevenLabs, Photon Spectrum iMessage agent, Auth0, Solana devnet program).
- Sections, each a tight paragraph plus bullets: **Data model** (key tables, ledgers for XP/coins, idempotent award keys,
  migrations 001–055); **Realtime** (house WebSocket + Tiger NOTIFY, village presence, live movement if merged);
  **Avatar pipeline** (photo → SAM 3 → LAM head / Hunyuan body → manifests, fixture fallbacks, cost); **LLM layer** (bounded
  JSON adapter, schemas, untrusted-input stance, provider fallback, daily caps); **iMessage**; **Economy** (coins vs XP vs
  devnet SOL intent); **Security** (SEC-001 caps, loopback-only debug, X-Forwarded-For trust, demo-seat model, secrets
  handling); **Performance & scale** (SCALE-001 numbers, instancing, LOD, label culling); **Infra & delivery** (Codex agent
  swarm in worktrees, remote runners, zero-downtime deploys DEPLOY-002, Modal budget guard); **Local dev** (exact commands,
  env var NAMES only); **Repo map** (tree of top dirs, one line each).
- Mermaid sequence diagrams for: a check-in with photo proof → AI pre-check → auditor; and a talking-head render (ElevenLabs
  → Audio2Expression → LAM → video).
**docs/ARCHITECTURE.md:** the long-form deep dive (contracts, failure modes, consistency/idempotency, threat model,
cost model, known limitations, what's simulated or unverified).
**Repo hygiene (no visibility change):** `.github/` issue and PR templates; a short CONTRIBUTING section in the README.
Suggest a LICENSE in your report but DON'T add one (owner decision).
**Pre-publication audit (read-only):** scan the FULL git history for secrets, tokens, keys, `.env` files, phone numbers,
emails, real faces or voice samples, and large binaries (`git log -p` / `git rev-list --objects --all`, or gitleaks if you
can run it without installing system-wide). Write `docs/security/REPO-AUDIT.md`: findings with commit/path, severity, and
the exact remediation (e.g. history rewrite needed, keys to rotate). NEVER print secret values in the report; redact them.
Don't rewrite history and don't push anything; the integrator decides.
Validate: Mermaid renders (mermaid-cli, or a quick check on the runner), every relative link resolves, and the commands
in Local dev actually run. Final report per AGENTS.md.
