---
id: INTEG-012
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-012 (from main)
allowed_paths: [apps/web/**]
---
# INTEG-012 — Land WEB-037 (custom icon set) on main

`git merge --no-ff web/WEB-037`. Main gained VFX-001 (DisasterEffects rewrite, RepairReveal) and WEB-036 (disaster card → top-bar alert badge,
tighter colosseum copy) since WEB-037 branched; conflicts in package.json (union test lists), App.tsx, DisasterBanner.tsx, DisasterEffects.tsx.
Keep all behavior from main; apply WEB-037's icon components wherever it replaced emoji (banner/badge icons, feed rows, activity badges, widget
headers, toasts). Run web typecheck/test/build + the HUD overlap checks. Don't merge to main. Short report.
