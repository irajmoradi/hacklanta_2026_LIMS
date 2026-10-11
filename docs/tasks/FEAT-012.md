---
id: FEAT-012
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-012 (start after INTEG-003/004 land; RAM-gated)
allowed_paths: [apps/api/**, apps/web/**, assets/**, apps/web/public/models/**, packages/catalog/**, packages/contracts/api.md]
request: R-61 (Iraj 15:06 👍 on the disasters proposal)
---
# FEAT-012 — Cozy disasters pack

Builds on the existing failed-event penalty, repair event and fog mechanics (apps/api/app/world.py, mayor.py). When a Mayor
challenge/random event fails, the Mayor picks a disaster (weighted, never two at once, never the same twice in a row), shows it
in the town and posts it to the Gazette/feed, and a shared **repair** event fixes it:
- 🌋 **Volcano/meteor scorch:** a smoking crater with scorched ground next to one building, which is **closed** (greyed, no
  interactions, "Closed for repairs") until repaired.
- 🐾 **Pet shelter outbreak:** shelter pets go "to the vet" (a vet van shows, shelter yard empty) for 48 h. If not repaired in
  time, each member's equipped pet **runs away** (hidden, inventory flagged `away`) until they buy a 🧪 **Revival potion**
  (shop consumable) or the repair completes. Nothing is ever deleted.
- 🌩️ **Storm blackout:** forced night + rain + flickering streetlights, and festival_night is disabled until repaired.
- 🐛 **Garden blight:** gardens/fields turn brown with bugs; gardening idle activity is unavailable and the garden yields no XP
  bonus until repaired.
Repairs: a group goal (e.g. N check-ins from M people within 48 h) shown with a progress bar; completion plays a "rebuilt"
celebration and clears the effects. API: disaster state on village_world (migration with suffix `_disasters`; number it after
the highest existing migration), endpoints in api.md, pytest (selection rules, effects applied/cleared, pet away/revive
idempotent). Web: visual effects (instanced, cheap), a disaster banner in the HUD, Mayor copy. The 🐞 debug menu gets
"Trigger disaster ▸" and "Repair now". Real screenshots of each disaster. Final report per AGENTS.md.
