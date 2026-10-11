---
id: INTEG-019
owner: codex (gpt-6-astra, high)
branch: integ/INTEG-019
allowed_paths: [apps/web/**, apps/api/**, packages/contracts/api.md]
---
# INTEG-019 — Land INTEG-017 (pinned previews) + FEAT-022 (interior avatars, stairs) on main with WEB-049 (undo)

Main has WEB-049 (house undo/redo, `houseHistory.ts`, leave guards; live) and FEAT-021 (town movement sync; live). Two
finished branches conflict with WEB-049 in the house editors:
- `integ/INTEG-017` (WEB-047: preview pinned beside the outfit/house editors, sticky Save/Cancel, Esc cancels,
  `decorDraft`/`editSession`; see `apps/web/tests/INTEG-017.md` there). Conflicts: HouseEditor.tsx, HouseInterior.tsx,
  ProfilePanel.tsx, tests/feat019.spec.ts.
- `feat/FEAT-022` (your own avatar and visitors' avatars inside interiors, click/WASD walking, stairs between floors, live
  positions over the house WebSocket; `InteriorAvatars.tsx`, `interiorWalk.ts`; see `FEAT-022-report.md` there).
In this worktree, merge `integ/INTEG-017` and then `feat/FEAT-022` (`--no-ff`), resolving so that ALL of these survive:
WEB-049's undo stack and inverse synced moves; WEB-047's draft/preview/sticky actions (undo should operate on the draft
model, so make the two compatible); FEAT-019's Hall/floors; FEAT-022's walking, avatars and stairs (walking pauses while
decorating). Reuse FEAT-021's movement message shape if FEAT-022 diverges.
Run typecheck, the full web unit suite, the WEB-047, WEB-049, FEAT-019 and FEAT-022 Playwright specs, and the build via
`ops/remote_run.sh` (AGENTS.md); mock or scratch only (no live Tiger writes). Commit on `integ/INTEG-019`. Final report
per AGENTS.md, with screenshots of: decorate with the pinned preview, undo after a move, and two avatars upstairs.
