---
id: INTEG-017
owner: codex (gpt-6-astra, high)
branch: integ/INTEG-017
allowed_paths: [apps/web/**]
---
# INTEG-017 — Merge WEB-047 (pinned color/house previews) onto current main

`web/WEB-047` (a live preview pinned beside the outfit color editor and the house exterior/interior editors, sticky
Save/Cancel, Esc cancels drafts, `decorDraft` preview; see `apps/web/tests/WEB-047.md` on that branch) was built on the
interior code from before FEAT-019. It conflicts with main in `components/HouseInterior.tsx`, `HouseInterior.css` and
`ProfileOutfit.tsx`. Main now has:
- FEAT-019: Community Hall (`hall` mode, creator-only edits, "VILLAGE COMMONS"), floors, photo objects, duplicate,
  categories, a context menu and stairs;
- R-124: `scrollWithinPanel()` in ProfileOutfit, which replaced `scrollIntoView`. Keep it: `scrollIntoView` scrolls the whole page.
In this worktree, `git merge --no-ff web/WEB-047` and resolve so BOTH survive in full: every FEAT-019 interior feature plus
WEB-047's pinned preview, draft/`editSession`/`previewDecor` flow, `is-decorating` layout and sticky actions. Where both
sides changed a function (e.g. `place()`), merge the logic: hall/creator checks and duplicate support, plus the edit-session
guard and draft preview.
Note: WEB-049 (undo for house customization) is running in parallel on the same files. Keep the draft model clean and
documented in your report so it can rebase.
Run typecheck, the full web unit suite, the WEB-047 and FEAT-019 Playwright specs, and a production build via
`ops/remote_run.sh` (AGENTS.md); mock mode only. Commit the merge on `integ/INTEG-017`. Final report per AGENTS.md.
