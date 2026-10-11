# Village Solana v2 (FEAT-027)

Current setup, economics, tests and owner deployment steps: [FEAT-027.md](FEAT-027.md).
The program now occupies 386 bytes and settles scores using immutable payout modes.
API/browser payments require wallet approval and verified receipts. The historical
notes below describe the prior ABI only.

## Historical: Village weekly pot (SOL-001)

Local-only Anchor 1.2.1 program in `programs/village-pot`. No deployment or devnet transaction has been performed. All test wallets are ephemeral in-memory LiteSVM signers; tests never open the owner's wallet or load secrets. No API/web integration is enabled by this change.

## Build and try it

From PowerShell at the repository root:

```powershell
wsl.exe -d Ubuntu-24.04 --user iraj bash /mnt/c/Users/mourn/Downloads/hl-sol/programs/check.sh all
```

From WSL/Linux, `bash programs/check.sh all`. The runner adds the installed Rust/Solana paths and uses WSL's installed Node 22.23.2 when available. Else provide Node >=22.12 on PATH. It runs `NO_DNA=1 anchor build --ignore-keys`, `npm ci --no-audit --no-fund`, and `npm test`. `build` and `test` select individual stages. No validator, RPC, protoc, GPU, generated assets, or `.env` is needed. Initial dependency installation needs internet; execution is in-process and local.

Build outputs: `programs/target/deploy/village_pot.so`, `programs/target/idl/village_pot.json`, and generated TypeScript types. The fixed program ID is a **local test placeholder**, not a deployed address. `--ignore-keys` avoids binding repeatable local tests to Anchor's auto-generated, ignored deployment keypair. Never use that flag for the approved deployment build.

Validated on 2026-10-10 with Anchor 1.2.1, Solana CLI 4.1.2, Rust 1.91.0, Node 22.23.2 and LiteSVM 1.6.0:

| Command | Result |
| --- | --- |
| `bash programs/check.sh all` via the WSL command above | Exit 0: SBF + IDL build, clean dependency install, 8/8 tests passed |
| `cargo fmt --manifest-path programs/Cargo.toml --check` (WSL cargo) | Exit 0 |
| `git diff --cached --check` | Exit 0 |

Tests execute the compiled SBF binary with verified signatures, independent fee payer, balance assertions and controlled Clock time. Coverage includes fee/split/dust/rent, auditor exclusion, eight-player capacity, duplicate joins, unauthorized/unsigned settlement, early/late boundaries, invalid/duplicate/readonly/extra recipients, permissionless refunds, finalization replay, invalid creation arguments, wrong vault, empty pots, both fee endpoints and unsolicited donations. There is no UI, so screenshots do not apply.

## State and economics

| Item | Definition |
| --- | --- |
| Pot PDA | `[UTF8("pot"), creator public-key bytes, week_id u64 little-endian]` |
| Vault PDA | `[UTF8("vault"), pot public-key bytes]` |
| Pot | Program-owned Anchor account, 361 bytes including discriminator; stores creator, week ID, entry, auditor, fee, deadline, up to 8 participants, status and bumps |
| Vault | Separate program-owned Anchor account, 8 bytes; creator funds rent at creation |
| Status | `0` open, `1` settled, `2` refunded; terminal states cannot reopen |
| Time | Unix seconds from the Clock sysvar; not slots |

`create_pot(week_id: u64, entry_lamports: u64, auditor: Pubkey, auditor_fee_bps: u16, deadline: i64)` requires a positive entry, fee <=2000 bps, future deadline, and arithmetic safe for eight entries and the refund deadline. The creator pays account rent and may also join, unless they are the auditor. Creator selects the auditor address; random selection and human agreement happen off-chain before creation. No claim of verifiable on-chain randomness is made.

`join()` requires the participant's signature and transfers exactly one entry via the System Program. Auditor, duplicate, ninth, late, and terminal-state joins fail. Joining closes at `now >= deadline`.

`settle(winners: Vec<Pubkey>)` requires the fixed auditor's signature. It is valid from `deadline` inclusive until `deadline + 259200` exclusive. Winners must be nonempty, unique participants. The fee is `floor(total_entries * bps / 10000)` using a widened u128 intermediate. Winners split the remainder; the first `remainder % winner_count` winners in the instruction receive one extra lamport. Maximum difference is one lamport and all entry funds are paid out. Auditor ordering therefore controls only rounding dust.

`refund_all()` is permissionless from `deadline + 259200` inclusive. The transaction fee payer can be any funded account. Each participant receives exactly their entry and the auditor receives no fee. Empty pots can finalize this way. Settlement is disabled once refunds become available, avoiding a late settlement/refund race.

Both finalizers validate every recipient before payouts, preserve the vault rent reserve, use checked lamport arithmetic, and finalize atomically. Pot and vault remain allocated: permanent pot state prevents recreation for the same creator/week. Unsolicited vault donations are excluded from prize accounting and remain in the vault along with rent. There is deliberately no sweep/close/administrative withdrawal instruction. This rent retention and stranded donation behavior should be visible in any eventual UI.

## Instruction account order

| Instruction | Fixed accounts in order | Remaining accounts |
| --- | --- | --- |
| create_pot | creator (writable signer), pot (writable), vault (writable), System Program | none |
| join | participant (writable signer), pot (writable), vault (writable), System Program | none |
| settle | auditor (writable signer), pot (writable), vault (writable) | exactly the winners in the argument order, all writable |
| refund_all | pot (writable), vault (writable) | exactly all participants in stored join order, all writable |

Anchor enforces ownership, discriminators, canonical creation bumps, stored PDA derivations and auditor identity. Dynamic recipients must match the validated addresses, be writable and nonexecutable. Recipient ownership is intentionally unrestricted: paying SOL does not require a System-owned destination, and a previously joined wallet may later change ownership. No recipient can alias the vault or pot because recipients must have joined by signing and these PDAs cannot sign externally.

## API integration sketch (@solana/kit 8)

FastAPI remains the product/API owner. A future TS wallet/client module can construct instructions using the generated IDL (or Codama-generated Kit bindings); API handlers return validated intent and unsigned instructions to the correct owner/auditor wallet. Do not introduce a custodial API signer implicitly. Keep lamports and week IDs as bigint/string at JSON boundaries, never floating-point SOL.

This sketch constructs a join instruction without signing or sending:

```ts
import {
  address, AccountRole, getAddressEncoder, getProgramDerivedAddress,
  getU64Encoder, type TransactionSigner,
} from '@solana/kit';
import { createHash } from 'node:crypto';

async function joinInstruction(
  deployedProgramId: string, creatorAddress: string,
  weekId: bigint, participant: TransactionSigner,
) {
  const programAddress = address(deployedProgramId);
  const [pot] = await getProgramDerivedAddress({ programAddress, seeds: [
    Buffer.from('pot'), getAddressEncoder().encode(address(creatorAddress)),
    getU64Encoder().encode(weekId),
  ] });
  const [vault] = await getProgramDerivedAddress({ programAddress, seeds: [
    Buffer.from('vault'), getAddressEncoder().encode(pot),
  ] });
  return {
    programAddress,
    accounts: [
      { address: participant.address, role: AccountRole.WRITABLE_SIGNER, signer: participant },
      { address: pot, role: AccountRole.WRITABLE },
      { address: vault, role: AccountRole.WRITABLE },
      { address: address('11111111111111111111111111111111'), role: AccountRole.READONLY },
    ],
    data: createHash('sha256').update('global:join').digest().subarray(0, 8),
  };
}
```

For an owner-approved future send, compose `createClient().use(signer(walletSigner)).use(solanaDevnetRpc({ transactionConfig: { version: 1 } }))` using `@solana/kit-plugin-signer` and `@solana/kit-plugin-rpc`. The signer is the participant for join, creator for creation, auditor for settlement, or any fee payer for refunds. Simulate and present cluster, entry/fee, destinations and fee payer before approval. After approval, `client.sendTransaction([instruction])` plans, signs and confirms. Use version 0 only when the wallet cannot sign v1; the local suite deliberately uses v0 to exercise the standard small transaction path. Set `maxSupportedTransactionVersion: 1` when fetching transaction/block results.

Before creating a transaction, fetch/decode the pot and verify its owner, discriminator, PDA, status, participant list, deadline and fee. Treat all chain data as untrusted. For settlement append writable winner accounts; for refund append all stored participants. Confirm chain success before changing product state. Any future service configuration must load `$VILLAGE_ENV_FILE` at runtime; no secret is required by this package.

References: [Anchor constraints](https://www.anchor-lang.com/docs/references/account-constraints), [LiteSVM](https://github.com/LiteSVM/litesvm), [Kit transaction clients](https://www.solanakit.com/docs/guides/sending-transactions).

## Deployment runbook — owner approval required, not executed

After the owner approves the deployment, in WSL:

```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
export NO_DNA=1
cd /mnt/c/Users/mourn/Downloads/hl-sol/programs
# Inspect the locally generated deployment public key, then synchronize it.
anchor keys list
anchor keys sync
# Add [programs.devnet] village_pot = "<the synchronized public key>" to Anchor.toml.
anchor build
npm ci --no-audit --no-fund
npm test
# Only after reviewing deployment cost, fee payer and upgrade authority:
solana program deploy --url https://api.devnet.solana.com \
  --keypair "$HOME/.config/solana/id.json" \
  --program-id target/deploy/village_pot-keypair.json target/deploy/village_pot.so
```

The synchronized program ID must match source, Anchor config and generated IDL. Preserve the deployment keypair securely outside version control; do not copy the owner's wallet. Record the resulting devnet address and upgrade authority for teammates. Do not target mainnet. Deployment and live smoke tests are separate owner-approved work.

## Integration boundaries and risks

No contracts were edited. Proposed future contract additions: store cluster/program ID/pot PDA/week ID and confirmed transaction signatures alongside the weekly group goal; expose unsigned create/join/settle/refund intents and chain-confirmed status. The owner/integrator should agree those shapes before API changes. Auditor honesty/random selection, Sybil resistance, group membership and evidence grading are off-chain responsibilities; this program only enforces the fixed auditor and payout rules. Anyone able to sign a wallet can join an available slot. The program is a hackathon implementation, not an audited custody product.
