---
id: FEAT-027
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-027
allowed_paths: [apps/api/**, apps/web/src/**, apps/web/tests/**, programs/**, packages/pot-client/**, docs/solana/**, packages/contracts/api.md, packages/contracts/schema.sql]
---
# FEAT-027 — Solana polish: SOL → XP shop, working pot entry, payout modes (R-166, owner)

Owner (Iraj): "Get Solana more polished. Create a store/shop where you can turn Solana into personal XP and use that for
auditor. Ensure that Solana entry into competitions works. Allow different competitions: only one winner, proportional
winners by percent, or ranked winners, with options for how to split the money, chosen at competition creation. Do testing
to ensure the competition stuff and the Solana work flawlessly."

Read first: docs/solana/README.md, programs/ (village_pot), packages/pot-client/, apps/api/app/competitions.py,
competition_scoring.py, apps/web/src/components/pot/, the Colosseum UI, and api.md's competition + pot sections.
1. **Audit + fix SOL competition entry end to end** (create → join with SOL stake → score → settle → payout/refund).
   List every broken or rough step you found in the report, then fix it. The UI must show clear wallet state, devnet
   badge, simulation result before the signature prompt, pending/confirmed/failed states with an explorer link (devnet),
   and graceful behaviour with no wallet installed.
2. **Payout modes chosen at creation** (immutable after the first entry): `winner_take_all`, `proportional` (share by
   score percent), and `ranked` with a creator-defined split (e.g. 60/30/10; validated to sum to 100%, 1–10 places,
   tie rule documented). Enforce on-chain where the program settles (update the Anchor program + IDL + client if needed;
   keep settle's math in integer lamports with remainder handling, no rounding loss), mirror it in the API for
   coins-only competitions, and show the split + live projected payouts in the create form and the competition page.
3. **SOL → XP shop:** a "Treasury" section in the shop where a member converts devnet SOL into personal XP at a fixed,
   documented rate with a per-day cap. XP lands only after the transfer is confirmed and verified server-side (signature,
   amount, destination, single use: replay protection). Personal XP from this source counts toward auditor eligibility
   (wire it into whatever decides who can be auditor) and is labelled in the profile.
**Safety (hard rules):** devnet only. Never sign or send a transaction yourself, never deploy a program and never airdrop
on the live demo; the owner approves any devnet deploy. Never target the live API (:8010/prod). Tests: Anchor/LiteSVM or
Surfpool locally for the program (all three payout modes, ties, rounding remainders, refunds, double-settle, wrong signer);
API unit tests with a mocked RPC for SOL→XP verification (valid, replayed, wrong amount, wrong recipient, unconfirmed);
web unit tests for split validation; Playwright in mock mode at 1440 and 390 px through `ops/remote_run.sh` (AGENTS.md).
Migrations: use the next free number at merge time; keep them idempotent and fold them into schema.sql.
Final report per AGENTS.md, including the devnet deploy command the owner would run and any program-id change.
