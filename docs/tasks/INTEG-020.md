---
id: INTEG-020
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-020
allowed_paths: [apps/api/**]
---
# INTEG-020 — Make the full API suite green on main after the FEAT-027 merge

`main` now has FEAT-027 (Solana: confirmed devnet wallet transactions are required to join SOL competitions, timezone-aware
deadlines, payout modes, Treasury XP). The full API suite on main has 11 failures (log: `ops/reports/api-full-cbae7cf.log`):
test_api007::test_demo_level_four_replay_and_repair, test_api008 (2), test_demo_story (4), test_feat004::
test_actions_scoped_and_replayed, test_feat026::test_challenge_consent_entries_and_photo_routing,
test_feat027::test_treasury_xp_adds_auditor_chance_without_village_xp, test_overworld_latency::
test_receive_to_fanout_with_shared_seat_tabs. The integrator already added a deadline to the demo SOL competition in
`scripts/demo_story.py`; seeding now fails with 409 "Join with a confirmed devnet wallet transaction".
Fix each one at its root, keeping FEAT-027's security rules intact (never weaken the confirmed-transaction requirement for
real joins): e.g. the demo seed records SOL participants as an explicitly labelled demo/intent state through a seed-only path,
or seeds a friendly/coins version; update older tests whose fixtures predate the new rules; fix real bugs if a test exposes one
(e.g. iMessage challenge entry routing, Treasury XP/auditor chance). Investigate the overworld latency test: real regression or
flaky timing on a loaded runner? Fix or stabilise without hiding a real latency regression.
Run the **full** suite: `RUNNER_IP=<runner-2-ip> ../../ops/remote_run.sh python -m uv run pytest -q` from `apps/api`
(runner 2; runner 1 is overloaded). Report exact results. Final report per AGENTS.md.
