---
id: POLISH-001
owner: codex (gpt-6-astra, medium)
branch: polish/POLISH-001
allowed_paths: [apps/web/src/components/**, apps/web/src/styles.css, apps/web/src/App.tsx, apps/web/tests/** (not scene*.spec.ts)]
---
# POLISH-001 — Make the UI feel like a shipped cozy game (not a dashboard)

Read AGENTS.md and look at the stills in C:\Users\mourn\Downloads\hacklanta\data\demo\v2_stills\ and the live preview
http://localhost:4173. Scene code (src/scene/**) is out of scope. Keep the existing palette/brand (sage greens, cream,
rounded cards) but raise the craft:
- Consistent spacing/typography scale across all modals and panels; one dialog component style; tidy headers; no cramped
  forms; truncate long text gracefully; consistent iconography and button hierarchy (one primary per view).
- Micro-interactions: 120–200 ms ease for open/close, hover/press states, XP gain toast with a little count-up, level-up
  moment, skeleton loaders instead of blank panels, friendly empty states with small illustrations/emojis.
- The bottom HUD: clearer active state, group related actions (Check in primary; Week/Compete/Shop/Mayor/Gazette secondary),
  badges for unread inbox / new Gazette / pending grading; tooltips with keyboard shortcuts.
- Accessibility: focus rings, aria labels, contrast ≥ 4.5:1 for text, respects prefers-reduced-motion.
- Mobile 390×844: everything reachable, no overlaps (FIX-002 fixed label hit-testing — keep it).
No behavior changes to API calls. All existing tests green; update snapshots/screens; add before/after screenshots
(desktop + mobile) to the report. Final report per AGENTS.md.
