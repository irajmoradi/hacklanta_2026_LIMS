---
id: FEAT-007
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-007 (START AFTER INTEG-001 lands on main: it rewrites the shop/economy those branches touch)
allowed_paths: [apps/api/**, apps/web/**, packages/contracts/api.md, packages/catalog/**, assets/**]
request: R-37 (Mario/hello_world42, Discord 13:55) "three currencies: coins, SOL, XP"
---
# FEAT-007 — Three currencies: 🪙 Coins · ◎ SOL · 💎 XP

- **Coins (new, free, spendable):** earned alongside XP from every task (check-ins, goals, Mayor challenges, competitions,
  audits). Start at 1:1 with today's XP awards unless a rule says otherwise. All shop prices move from XP to coins
  (`price_coins`, keeping current numbers). Ledger `coin_ledger` like xp_ledger (idempotent source_key). Backfill:
  coins = sum of positive XP awards minus past XP spend. XP becomes **progress only**: never spent; level = f(total XP earned).
  Migration with suffix `_coins`; api.md; pytest (awards, purchase, backfill idempotent).
- **XP (progress only):** individual + village-communal (building XP) as today; no shop debits anymore.
- **SOL (premium, devnet test currency):** only for competition pots via the existing village_pot program; every on-chain
  action still requires owner approval. The UI shows SOL balances/pots with a "devnet · test" tag.
- **Icons (inline SVG components, no external assets):** Coin = gold coin turned 45° to the right (ellipse face + rim
  thickness); SOL = the Solana logo mark (three slanted bars, purple→green gradient); XP = a green 3D octahedron diamond
  (geometric shape with faceted shading, not a cut gem). Use them everywhere amounts appear (HUD, shop, rewards, toasts,
  showcase detail cards, competitions).
- Debug menu (FEAT-004) gains +coins buttons. Demo seed gives everyone sensible coin balances.
Tests: pytest, web unit (formatting/icons), e2e (mock buy with coins), real screenshots. Final report per AGENTS.md.
