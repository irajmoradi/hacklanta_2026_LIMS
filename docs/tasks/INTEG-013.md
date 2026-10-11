---
id: INTEG-013
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-013 (from main)
allowed_paths: [apps/**, docs/**]
---
# INTEG-013 — Land WEB-034 (toast system) + COPY-001 (de-AI copy) on main

`git merge --no-ff web/WEB-034` then `git merge --no-ff copy/COPY-001`. Both branched before many merges (WEB-035 widgets, WEB-036 alert badge,
VFX-001, INTEG-012 icon set, FIX-013 weekly review, FIX-014 profile overview, FEAT-014 colosseum, currency alignment CSS). Conflicts are expected in
App.tsx, Modals.tsx, Onboarding.tsx, Villagergram.tsx, shared.tsx, Messages.tsx, HouseEditor.tsx, AgentPanel.tsx, styles.css (WEB-034) and App.tsx,
fixtures.ts, Colosseum.tsx, CompetitionsPanel.tsx, MayorModal.tsx, ProfilePanel.tsx, WeekPanel.tsx (COPY-001).
- WEB-034: every ad-hoc toast/pill goes through `useToast()`; keep main's newer UI (alert badge, icons, widgets).
- COPY-001: its job is copy only. Re-apply its new strings onto main's current components (main's structure wins; COPY's wording wins for the same
  string). Also apply its de-AI pass to any NEW copy that landed after it branched (WEB-036 shortened colosseum text, FIX-013 review lines, WEB-035
  widgets, FEAT-014 auditor booth) so the voice is consistent. Update tests that assert strings.
Run web typecheck/test/build + HUD overlap + the branch e2e suites. Don't merge to main. Report.
