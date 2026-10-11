---
id: DOCS-015
owner: codex (gpt-6-astra, medium)
branch: docs/DOCS-015
allowed_paths: [README.md, .env.example, docs/SETUP.md, docs/devpost/**, docs/infra/**, docs/auth/**, docs/solana/**]
---
# DOCS-015 — Final docs pass for the shipped product (prod 86bc24e)

DOCS-014 wrote SETUP.md, the README refresh and the Devpost write-up before the last batch landed. Bring them up to date with
main/prod 86bc24e (read the code; it's the source of truth): Mayor-chosen disaster repair tasks (FEAT-028), optional Auth0 Sign
in with single-use seat claims, hidden by default via `VITE_AUTH0_ENABLED` (FEAT-029, docs/auth/*), Solana v2 payout modes +
Treasury and the owner's devnet deploy steps (FEAT-027, docs/solana/FEAT-027.md), the Demo Lab's five scenes, the WEB-058 fixes,
the trailer cuts (v4 94 s, long 2:48 = Devpost video, 1:30, square; mp4s are not in git, say where they're published or that the
team uploads them), migrations up to 059. Fix anything in SETUP/README/.env.example that no longer matches the code. Re-run
`python docs/infra/check_docs014.py --shell` and extend it for the new env vars. Plain voice, no secrets, no private IPs, honest
about devnet/test SOL and what still needs the owner. Final report per AGENTS.md.
