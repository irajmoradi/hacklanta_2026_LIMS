---
id: FEAT-003
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-003 (parallel with WEB-017/018, FEAT-001/002; integrator resolves conflicts)
allowed_paths: [apps/web/**, apps/api/**, packages/contracts/api.md, packages/catalog/**]
request: R-25/R-26/R-27 (Lance/mrgell, Discord #ui 13:22, Destiny-2 inventory screenshot as reference)
---
# FEAT-003 — Destiny-style villager + house showcase on profiles; earn-only cosmetics

1. **Villager showcase (R-25).** On every profile, right below the 3D portrait: a large showcase. The full 3D villager is in the
   center on a turntable (drag to rotate, scroll to zoom, idle animation, wearing their equipped items). Slot tiles run down
   both sides like Destiny 2's inventory screen (left: head/hat, face/glasses, top/jacket, neck/scarf; right: pet,
   voice style, house, photo items/extra). Each tile shows the item icon/thumbnail or an empty slot. Hovering or clicking a tile
   highlights that item on the model. Clicking opens a **detail card**: name, description, slot, rarity, source
   ("Shop · 300 XP", "Event: Spooky Night", "Won: Weekly crown"), date acquired if known, and owner-only Equip/Unequip.
   Read-only for others. Works in mock mode and with fixture avatars when generated assets are missing. Mobile: tiles go below
   the model. Keep WEB-016's Outfit section data, and merge/replace it so there's one coherent showcase, not two lists.
2. **House showcase (R-26).** Below the villager: the member's house as a 3D turntable, with its style/palette (from WEB-018
   when merged; otherwise current house model), placed decorations/house add-ons (backyard, garden items, photo decorations
   from CV-006), and side tiles for each decoration. Same click → detail card behavior. Clicking a house in the town scene
   opens this profile scrolled to the house.
3. **Earn-only cosmetics (R-27).** The registry has event packs (price 0, event-gated). Add an explicit `source` field to the
   catalog entries: `shop` | `event:<pack>` | `earned:<rule>`, plus `rarity`. Add 6–8 **earn-only** cosmetics built from
   existing GLBs/recolors (e.g. champion cape for a weekly crown win, perfect-week halo for all check-ins, streak flame aura
   for a 4-week streak, auditor badge, festival VIP wristband, Mayor's medal for completing a Mayor event). Show them as
   locked silhouettes with "How to earn" in the shop/showcase. API awards them on the matching events (hook existing
   competition win / audit / streak code paths; idempotent). pytest + api.md.
Tests: unit (slot mapping, source labels), e2e (mock showcase click → detail), pytest for awards; real screenshots
(desktop + mobile). Final report per AGENTS.md.
