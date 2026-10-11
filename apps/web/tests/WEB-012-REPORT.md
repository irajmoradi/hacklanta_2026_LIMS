# WEB-012 delivery

Branch: `web/WEB-012`. Implementation milestone: `a68a6a2`. The following
verification/handoff commit contains this report; use `git log -2 --oneline` for
its final hash. No push, merge, deployment, live signature, transaction broadcast,
paid generation, or secret copy was performed.

Delivered a Gazette overlay and home headline ticker, dated weather masthead,
five linked villager stories, gossip, model provenance, and a three-issue demo
archive. Added timestamped village/villager memory to AI at work, and challenge
tier, effort, reward range, penalty and recovery terms to the Mayor journal and
pinned responses. New read failures have retry controls; empty content has an
explicit state; live failures do not substitute fixture stories.

SOL competitions show the coming-soon message with the flag off. With the flag
on, the panel connects Wallet Standard wallets through the pot-client hooks,
simulates on devnet, displays entry/fee/payer/destinations and detailed simulation
results, then enables a separate signature approval. Failed simulations, absent
fees, pending actions and consumed reviews disable approval. Signed transactions
are explicitly reported as not broadcast and do not alter competition state.

Files changed:

- `src/App.tsx`, `src/styles.css`: Gazette entry points and responsive styles.
- `src/api/{client,types,fixtures,mock}.ts`, `src/api/gazette.ts`: typed read
  adapters, provisional metadata and scoped demo responses.
- `src/components/{Gazette,MayorMemory,EventTerms,SolanaPot}.tsx` and existing
  `AgentPanel.tsx`, `MayorModal.tsx`, `CompetitionsPanel.tsx`: UI and wiring.
- `src/components/pot/{mount.tsx,package.json,package-lock.json,README.md}`:
  lazy React 19 wallet root and reproducible local dependency installation.
- `src/components/pot/testing/MockWallet.tsx`, `src/api/gazette.test.ts`,
  `tests/web012.{config.ts,vite.config.ts,spec.ts}`: isolated mock-wallet coverage
  and real hook mounting without wallets/RPC.
- `tests/connection.spec.ts`: bearer test now allows overlapping background
  reads, asserts both intended endpoints and still verifies bearer-only headers
  on every captured API request.
- This report, `tests/artifacts/.gitignore`, and the three screenshots below.

Verification (PowerShell, working directory `apps/web` unless specified):

| Command | Exit/result |
| --- | --- |
| `bun install --frozen-lockfile` | 0 |
| `npm ci --ignore-scripts --install-links` in `src/components/pot` | 0, clean reinstall verified |
| `bun run typecheck` | 0 |
| `bun run build` | 0; existing large-chunk warning remains |
| `bun test src/api/gazette.test.ts` | 0; 4 passed, 36 assertions |
| `bun run test` | 0; 32 passed, 214 assertions |
| `bunx playwright test --config tests/web012.config.ts` | 0; 10 passed, 1 intentionally inapplicable flag-off signature case skipped |
| `bunx playwright test --config tests/web012.config.ts --project flag-on --project wallet-runtime --grep 'Solana flag\|failed simulations\|actual wallet'` | 0; 3 passed after the final review-summary and cache changes |
| `bunx playwright test` | 1 initially; 34 passed, one brittle request-count assertion failed |
| `bunx playwright test --project connection --grep 'bearer transport'` | 0; the corrected test passed; other 34 unchanged cases passed in the full run |
| `git diff --check` | 0 |

Earlier failures were resolved: Windows Bun local-package copying (documented
npm install instead); initial mock route intercepted `/src/api/client.ts`
(restricted to `/api/`); ticker overlapped the desktop self card (repositioned);
concurrent Vite mock/real wallet configurations shared a dependency cache
(separate caches). No test sent a transaction or contacted a public RPC.
The real-hook smoke test mounts the production hook implementation with no
wallet installed, and reports no React version errors.

Screenshots visually reviewed:

- `tests/artifacts/web012-gazette-desktop.png`
- `tests/artifacts/web012-gazette-mobile.png` (390 × 844, no horizontal overflow)
- `tests/artifacts/web012-wallet-review.png` (mock wallet/transaction only)

Try it: install the nested wallet package as described in its README, then from
`apps/web` set `$env:VITE_MOCK='1'; $env:VITE_DEMO_AUTH='1'` and run
`bun run dev`. Use Gazette or Today's headline, choose a past issue, and visit a
villager. Open AI at work for memory and Mayor for recoverable challenge terms.
Create a non-friendly competition with an SOL entry in Compete. With no program
flag it shows coming soon. Setting a public `VITE_SOLANA_PROGRAM_ID` before Vite
starts enables the wallet entry point; without a mapped pot it explains that
deployment metadata is pending. The WEB-012 Playwright command demonstrates the
full simulated approval flow with isolated test hooks, without a wallet or funds.
Root env loading remains the existing Vite runtime mechanism; no secret was
needed for this UI task.

Integration blockers and proposed contracts (no shared contracts edited):

1. Live `http://localhost:8010/openapi.json` was checked repeatedly; API-009
   Gazette, memory and template routes were still absent. The read shapes in
   `src/api/gazette.ts` are provisional until that API lands. Confirm/adapt:
   - `GET /villages/{vid}/gazette/latest`: `GazetteIssue | null`.
   - `GET /villages/{vid}/gazette?limit=14`: newest-first `GazetteIssue[]`.
   - Issue fields: `id`, `village_id`, `issue_date` (YYYY-MM-DD), `created_at`,
     `headline`, `body`, `weather`, `stories: [{title, body, user_ids}]`, `gossip`,
     `model`. Archive entries contain the full issue for local selection.
   - `GET /villages/{vid}/mayor/memory`: `{village_id, entries: [{id, user_id:
     string|null, text, updated_at}]}`. A null user identifies village memory.
   - Mayor event metadata: `tier: solo|pair|group`, `effort_hours`,
     `reward_xp_min`, `reward_xp_max`, `recovery`, alongside existing `penalty`.
     Older servers display “Not supplied” instead of fabricated tier/effort.
2. SOL-001 is not deployed and competitions have no approved pot mapping. The
   UI accepts an optional public `pot_address` on a competition, with the program
   from `VITE_SOLANA_PROGRAM_ID`; the API owner must supply validated devnet
   mapping after deployment. The SDK has no sending executor. Broadcasting,
   confirmation and server reconciliation are separate future work; the UI
   deliberately never claims a signed join has completed.
3. The shared SDK requires React 19 while the app uses React 18/R3F 8. A separate
   DOM-mounted React 19 panel is the scoped solution. Root/app manifests and the
   shared SDK were not changed. This costs a separate lazy React bundle and one
   nested install step; an app-wide upgrade is an integrator decision.
