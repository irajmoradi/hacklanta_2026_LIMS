# FEAT-027 implementation and handoff

Branch: `feat/FEAT-027`. Program milestone: `7c712f7`; later commits contain the API,
client, UI and validation. No live demo API, owner wallet, devnet sends, airdrops
or deployment were used. Local LiteSVM uses ephemeral synthetic signers.

## Audit findings and fixes

1. Wallet join simulated/signed but never broadcast. Added separate simulate/review
   and sign/send actions, receipt persistence before broadcast, confirmation status,
   devnet Explorer and verification retries without a second payment. No-wallet UI
   remains usable.
2. API SOL joins were unpaid intent rows. They now require an exact confirmed
   receipt. Free/coin paths remain direct API actions; SOL cannot bypass verification.
3. No creator-to-pot bridge or settlement/refund UI existed. The API now derives
   pot/vault PDAs and prepares all four program operations. Create confirms before
   entry; the assigned auditor settles after deadline; refunds open 72 hours later.
   Every receipt is bound to a unique signer memo.
4. Program only split equally among arbitrary winners. Creation now locks
   winner-take-all, proportional, or ranked terms. Settle receives every participant's
   score in stored join order and calculates all payouts on-chain.
5. Coins had no competition payout path. Coin stakes debit once, then exact
   payouts/fees or no-score refunds credit atomically; replay is idempotent.
6. UI advertised intent-only SOL and had no split/projection. It now shows payout
   terms, a live three-entrant preview, current projections, deadlines, fees and the
   real wallet path. Old unfunded SOL records without deadlines need recreation.
7. Treasury and source-labelled XP were absent. Added fixed rate/cap, confirmed
   verification, profile labels and auditor tickets. Treasury grants no coins or
   shared village XP.
8. Scores could change during wallet review. The first settlement intent freezes
   a snapshot; subsequent preparations reuse it.
9. Receipt arrival order could misorder ties. Joins now store the actual program
   participant index. Pot reads verify owner, layout, discriminator, PDA, bounds
   and all immutable competition terms.

## Choices and limits

- Terms are immutable immediately at creation, stronger than after first entry.
- Eight on-chain entrants; up to ten ranked places. Unoccupied places renormalize.
  Positive scores only; equal scores favor earlier joins. Ordinal uses finishing
  rank; other scores use six decimal fixed-point units. u64 overflow is rejected.
- Fee is floor(total*bps/10000). Payouts floor individually; remaining smallest
  units go in join order among positive weights. No prize rounding loss.
- No-score SOL pots wait for the existing 72-hour permissionless refund window.
- The auditor attests real-world scores. The program enforces distribution,
  authority, deadlines and recipients, not evidence truth. External joins must be
  linked by verified app receipts before app settlement; otherwise refund.
- Pot/vault rent stays locked. Donations do not enlarge prizes and remain in the
  vault. There is no administrative withdrawal or close operation.
- Treasury: 100,000 lamports per XP; 1,000 XP/account/UTC intent date across villages.
  Identical pending Treasury requests reuse one intent. Intents reserve that day's allowance even if abandoned, preventing late-payment
  cap bypass. Timely payments may be verified later. XP is personal progress only.
- Auditor candidates have one ticket plus one per 100 personal XP, capped at 11.
  Treasury counts; rotation and sit-out rules remain.
- Legacy sign-only helpers remain for compatibility; product payments use
  `prepareIntent` / `sendIntent` after explicit user approval.

## Teammate setup

Use a scratch API/database or mock mode, never API :8010 for testing. Run normal
API migrations with `python -m uv run python scripts/migrate.py` against scratch
DATABASE_URL. Migration `057_solana_polish.sql` is idempotent and folded into
schema.sql. The integrated release continues through 058 repair tasks and 059 seat claims.

API settings load at runtime from the existing `VILLAGE_ENV_FILE`:
`SOLANA_PROGRAM_ID`, `SOLANA_TREASURY_ADDRESS`, optional `SOLANA_RPC_URL` (devnet).
No server key is needed. Missing settings leave paid actions unconfigured. The
browser uses public devnet RPC and Wallet Standard with v1 or v0 fallback.

In mock mode, Shop > Treasury > Convert SOL to XP shows the no-wallet path.
Compete > Create exposes payout mode, ranked percentages, stake, fee and deadline.
60/30 is rejected; 60/30/10 is valid. Mock mode never sends payments.

After approved deployment, create an audited competition with SOL and a future
deadline. The creator enters the assigned auditor's public wallet, simulates and
approves pot creation. Members simulate/approve joins and submit evidence. After
review and deadline, the auditor simulates/approves settlement. Refund after 72
hours is the fallback. Treasury credits XP only after server-verified confirmation.

## Owner deployment (not executed)

The program ID is unchanged:
`4m7xFhBQcWfa7u3kP8i78QaTYjkQXSxt5iUfj2689Ehu` (the v1 devnet address recorded in D-030, retained in source; not evidence of a v2 deployment).
The ABI changed: 361 to 386 bytes, new create arguments, score-vector settlement.
**Do not upgrade this binary over funded v1 pots.** Use a new approved v2 address
and retain the old deployment so its pots can settle/refund.

After owner approval, provision a new v2 program keypair/address using the owner's
normal CLI wallet and retain the v1 deployment keypair separately. Never let the
commands below silently reuse the existing v1 address. From the repository root
in WSL, using the approved new keypair at `programs/target/deploy/village_pot-keypair.json`:

```bash
cd programs
export NO_DNA=1
anchor keys list
anchor keys sync
anchor build
cp target/idl/village_pot.json ../packages/pot-client/idl/village_pot.json
(cd ../packages/pot-client && bun run generate && bun run typecheck)
# Update local tests' expected placeholder ID if changed, then rerun tests.
npm test
# Owner reviews fee payer, rent, new program ID and upgrade authority first:
solana program deploy --url https://api.devnet.solana.com \
  --keypair "$HOME/.config/solana/id.json" \
  --program-id target/deploy/village_pot-keypair.json target/deploy/village_pot.so
```

Set the resulting public ID in runtime SOLANA_PROGRAM_ID. No ID change or deploy
was performed here. Owner approval/configuration is the live activation prerequisite;
live wallet behavior is not claimed as tested.

## Validation

Final commands/results are recorded in the task report. Program tests ran locally
in WSL as requested by FEAT-027. The remote build could not start because the runner
lacks Anchor (127); API/browser/client checks use ops/remote_run.sh. API/wallet RPCs
are mocked. Generated-client tests execute the compiled program in local LiteSVM.

Verification follows Solana's official [getTransaction](https://solana.com/docs/rpc/http/gettransaction)
confirmed response and [signature status](https://solana.com/docs/rpc/http/getsignaturestatuses)
contracts.


## Final task report

Milestones on feat/FEAT-027:
- 7c712f7: on-chain payout modes, generated ABI, local program tests.
- f19bb24: verified API payments, Treasury XP, migrations and contracts.
- 11210fe: wallet flow, Treasury shop, payout forms/projections and client tests.
- Final QA/handoff commit: see current branch HEAD.

Validation commands (working directory matters):

| Directory | Command | Result |
| --- | --- | --- |
| programs, WSL | bash check.sh build | exit 0, SBF and IDL built |
| programs, WSL | bash check.sh test | exit 0, 14 local LiteSVM program tests |
| repo, WSL | cargo fmt --manifest-path programs/Cargo.toml --check | exit 0 |
| packages/pot-client, WSL | bun test tests/pot.test.ts | exit 0, 6 generated-client LiteSVM tests |
| packages/pot-client | ../../ops/remote_run.sh bun run typecheck | exit 0 |
| packages/pot-client | ../../ops/remote_run.sh bun test tests/wallet.test.ts tests/react.test.ts | exit 0, 16 tests |
| apps/api | ../../ops/remote_run.sh python -m uv run pytest -q tests/test_feat027.py tests/test_api003.py tests/test_feat003.py tests/test_feat007.py tests/test_competition_scoring.py | exit 0, 75 tests at expanded regression milestone |
| apps/api | ../../ops/remote_run.sh python -m uv run pytest -q tests/test_feat027.py | exit 0, 25 tests (final source, including concurrency and positive payouts) |
| apps/web | ../../ops/remote_run.sh bun test src/components/payouts.test.ts src/api/audits.test.ts src/components/colosseumData.test.ts | exit 0, 14 tests |
| apps/web | ../../ops/remote_run.sh bun run build | exit 0, production build (existing large-chunk warning) |
| apps/web | ../../ops/remote_run.sh bun run typecheck | exit 0 |
| apps/web | ../../ops/remote_run.sh bunx playwright test --config tests/feat027.config.ts | exit 0, 2 tests at 1440 and 390 pixels |
| repo | python -m uv run --project apps/api ruff check apps/api/app/solana.py apps/api/app/solana_rpc.py apps/api/app/payouts.py apps/api/app/competition_models.py apps/api/app/competitions.py apps/api/app/weekly.py apps/api/tests/test_feat027.py --output-format concise | exit 0 |
| repo | git diff --check | exit 0 |

Heavy API/web/client commands ran through the wrapper using Git Bash on Windows.
The remote program build attempt returned underlying 127 (Anchor absent; wrapper
exit 1). Program tests ran in the installed local WSL toolchain as explicitly
requested. Early regression runs caught outdated unpaid-SOL fixtures, a JSX error,
nullable wallet signers, old result-shape assertions and an empty test instruction;
all were fixed and the corresponding checks rerun successfully.

Screenshots, visually inspected at desktop/mobile sizes:
- apps/web/tests/screenshots/FEAT-027-treasury-1440.png
- apps/web/tests/screenshots/FEAT-027-treasury-390.png
- apps/web/tests/screenshots/FEAT-027-create-1440.png
- apps/web/tests/screenshots/FEAT-027-create-390.png
- apps/web/tests/screenshots/FEAT-027-competition-1440.png
- apps/web/tests/screenshots/FEAT-027-competition-390.png

No implementation blockers remain. Live deployment/configuration and live wallet
smoke tests require the owner's separate approval. The checked-in ID is unchanged;
the changed ABI requires a new v2 address if v1 pots exist. Contract changes are
implemented in api.md/schema.sql; no additional contract proposals are outstanding.

Files changed (all within allowed_paths):
- `apps/api/app/competition_models.py`
- `apps/api/app/competitions.py`
- `apps/api/app/config.py`
- `apps/api/app/domain.py`
- `apps/api/app/main.py`
- `apps/api/app/payouts.py`
- `apps/api/app/solana.py`
- `apps/api/app/solana_rpc.py`
- `apps/api/app/weekly.py`
- `apps/api/app/world.py`
- `apps/api/migrations/057_solana_polish.sql`
- `apps/api/pyproject.toml`
- `apps/api/tests/test_api003.py`
- `apps/api/tests/test_feat027.py`
- `apps/api/uv.lock`
- `apps/web/src/api/auditMock.ts`
- `apps/web/src/api/mock.ts`
- `apps/web/src/api/types.ts`
- `apps/web/src/components/Colosseum.tsx`
- `apps/web/src/components/CompetitionsPanel.tsx`
- `apps/web/src/components/Modals.tsx`
- `apps/web/src/components/PayoutSummary.tsx`
- `apps/web/src/components/ProfilePanel.tsx`
- `apps/web/src/components/SolanaPot.tsx`
- `apps/web/src/components/SolanaTransaction.tsx`
- `apps/web/src/components/Treasury.tsx`
- `apps/web/src/components/colosseum.css`
- `apps/web/src/components/payouts.test.ts`
- `apps/web/src/components/payouts.ts`
- `apps/web/src/components/pot/transactions.tsx`
- `apps/web/tests/feat027.config.ts`
- `apps/web/tests/feat027.spec.ts`
- `apps/web/tests/screenshots/FEAT-027-competition-1440.png`
- `apps/web/tests/screenshots/FEAT-027-competition-390.png`
- `apps/web/tests/screenshots/FEAT-027-create-1440.png`
- `apps/web/tests/screenshots/FEAT-027-create-390.png`
- `apps/web/tests/screenshots/FEAT-027-treasury-1440.png`
- `apps/web/tests/screenshots/FEAT-027-treasury-390.png`
- `docs/solana/FEAT-027.md`
- `docs/solana/README.md`
- `packages/contracts/api.md`
- `packages/contracts/schema.sql`
- `packages/pot-client/README.md`
- `packages/pot-client/idl/village_pot.json`
- `packages/pot-client/src/generated/accounts/pot.ts`
- `packages/pot-client/src/generated/errors/villagePot.ts`
- `packages/pot-client/src/generated/instructions/createPot.ts`
- `packages/pot-client/src/generated/instructions/settle.ts`
- `packages/pot-client/src/index.ts`
- `packages/pot-client/src/wallet.ts`
- `packages/pot-client/tests/helpers/wallet-fixture.ts`
- `packages/pot-client/tests/pot.test.ts`
- `packages/pot-client/tests/wallet.test.ts`
- `programs/tests/pot.test.mjs`
- `programs/village-pot/src/lib.rs`
