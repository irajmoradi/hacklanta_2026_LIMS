# Status (integrator-maintained)

| Component | State | Evidence |
|---|---|---|
| Local DB (TimescaleDB, :5433) | working | schema.sql applied, 2 hypertables |
| Gemini (Vertex express) | working | generateContent ok (2.5-flash, 3-flash-preview) |
| ElevenLabs | working | creator tier, IVC allowed |
| Photon Spectrum | working (echo) | `bun start` connects |
| Auth0 tenant | MCP connected | app/API not yet created |
| Solana devnet | wallet funded 5 SOL | Anchor 1.2.1 in WSL |
| Web village | merged (WEB-001); WEB-002 running | 15 tests; QA 02:14: real-API check-in +10 XP on :4173 preview |
| API | merged (API-001) on :8010; API-002 running | 41 pytest pass; Gemini + ElevenLabs smoke ok |
| CV (SAM 3 / LAM / A2E) | merged (CV-001); CV-002 running | all 4 stages on 5090; worker :8100 smoke ok |

## Running services (dev)
- DB :5433 (docker village-db) · API :8010 (`ops/run_api.sh`) · stable web preview :4173 (`apps/web`, vite preview) · GPU worker :8100 (WSL, `workers/gpu/scripts/run_server.sh`, stopped when idle)

## Known issues (02:08)
- OpenRouter/DeepSeek V4 Flash output fails Mayor pydantic schema validation (pray) → falls back to Gemini (works). Fix in next API task: schema-in-prompt example + one repair retry.
- README status table is stale (written before WEB/CV merges) → refresh in DOCS-002 before submission.
- QA-B01 (web): shop dialog keeps stale balance after a 409 purchase → refresh state on 409. → WEB-003
- QA-B02: one transient shop 500, not reproducible. Watch.
- QA-B03 (web): no village picker / invite-code join UI. → WEB-003
- QA villages ("QA-001 …") exist in the dev DB; the Mayor scheduler ticks them too (small LLM cost). Don't demo from them.
- Regression gate: `cd tests && bun run integration && bun run e2e` (see tests/README.md).

## 03:10 snapshot
- Live: API :8010 (API-006 merged), web preview :4173 (WEB-006), iMessage Mayor agent (Photon, connected; replies need numbers registered as project users in the Photon dashboard + phone set in Settings), GPU worker stopped (start with `bash ops/run_gpu.sh start`).
- iMessage simulator PASS on main (`bun run --cwd apps/imessage simulate`): check-in + 10 XP + outbox sent, no real traffic.
- Demo cast baked (placeholder CC0 faces). Rebake with real selfies: `workers/gpu/scripts/bake_cast.py --photos <dir>`.
- DEMO-001 (03:20): draft video data/demo/village_demo_draft.mp4 (2:32, 1080p, audio) + 6 stills. Findings: (1) live voice lines need GPU services running (`bash ops/run_gpu.sh start`) or the head falls back to amplitude mouth; (2) set LLM_PROVIDER=gemini before recording the final so provenance says Gemini; (3) prayer response not prominent → WEB-007.
- 06:40: Gazette manual publish returned `fallback:gazette-v1` (canned) → API-011 investigates. CV-006 merged (photo → wearable / 3D decoration), API routes in API-011.
- ~07:00: system memory pressure (4.6 GB free / 64 GB). Claude Code auto-stopped: web preview :4173, iMessage agent, dispatch shells for WEB-013 (3 commits + dirty), API-011 (dirty), WEB-014 (dirty), DOCS-003 (dirty). Still up: API :8010, GPU worker :8100 + bridge, DB. Not restarted automatically — waiting for owner; plan: stop idle GPU worker first, then restart preview + iMessage agent, then re-dispatch agents 1–2 at a time (worktrees keep partial work).
- 12:40: Iraj consented (face only) in #3d-avatar → rebaked user …0001 from data/inputs/real/iraj.jpg (consent in data/inputs/real/CONSENT.md, gitignored). rev 6, 238 s.
- Queued request (mrgell / Lance, 12:37): profile pics in villager name tags → WEB task after FIX-003.
