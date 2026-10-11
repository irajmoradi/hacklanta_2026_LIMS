# Village pot client

The v2 pot occupies 386 bytes and stores immutable payout modes. See
[the handoff](../../docs/solana/FEAT-027.md) for economics and owner deployment.

buildCreatePotIx adds payoutMode (0 winner-take-all, 1 proportional, 2 ranked) and
rankedBps (ranked only: 1-10 positive places summing to 10000). buildSettleIx takes
participants and u64 scores in stored join order. buildRefundAllIx takes all stored
participants. IDL and generated codecs match this ABI.

prepareIntent simulates API instructions and captures the exact message. Display
the review, then only after explicit approval call sendIntent with a callback that
persists the signature before broadcast. API independently verifies the receipt.
prepareJoin/useJoinPot remain sign-only compatibility helpers, not product payments.

Regenerate: bun run generate. Check: bun run typecheck. Remote wallet/hook tests:
../../ops/remote_run.sh bun test tests/wallet.test.ts tests/react.test.ts.
Local LiteSVM client tests need the built v2 binary at
.local/programs/target/deploy/village_pot.so; then bun test tests/pot.test.ts on
Linux/WSL. scripts/build-program.sh can build that local copy.
