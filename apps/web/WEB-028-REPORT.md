# WEB-028 delivery report

Branch: `web/WEB-028`. Implementation milestone: `71861cc`. Final QA commit: the commit containing this report (`git log -1`). All changes are inside `apps/web`.

Compete opens directly into an empty Colosseum. The arena stays mounted through banner previews, selection, filters, creation, joins and evidence inspection. The existing town canvas pauses and retains its camera. The HUD includes Open / Current / Mine / Past, participant portrait stacks, status and SOL intent amounts, and a parchment creation form. Clicking locks a competition, with terms/cost confirmation or a standing summary. Existing submission, human review, settlement, friendly-mode and auditor restrictions remain intact.

Transitions use a 240 ms entrance, 160 ms return, 180 ms damped-spring UI/contender motion, staggered drops with dust rings, and the existing 320 ms cubic camera move. Stands remain batched/instanced and no longer rebuild when changing gate view. Village avatars stay mounted and are reused. Reduced motion disables camera interpolation, torch motion, dust and avatar drops; UI uses fades. Crowd audio uses the existing muted/reduced-sound lifecycle.

Files changed:
- `src/components/CompetitionsPanel.tsx`: persistent arena, banner rail, filters, polling of banner detail, integrated creation.
- `src/components/Colosseum.tsx`: empty state, preview versus locked state, standing summary, village return.
- `src/components/colosseum.css`: arena HUD, responsive mobile rail, scroll form and transitions.
- `src/scene/ColosseumScene.tsx`: persistent contender pool, spring drops/dust, cached architecture, reduced motion.
- `tests/web028.spec.ts`, `playwright.web028.config.ts`: interaction, fallback, reduced-motion, strict frame timing, video and trace coverage.
- `tests/colosseum.spec.ts`, `tests/audits.spec.ts`: update changed UI selectors and locate settled competitions in Past; transition limit tightened to 300 ms.
- `artifacts/web028/*`: browser screenshots, walkthrough, performance data and trace.
- This report.

Validation (commands run from `apps/web` unless noted):
- `bun install --frozen-lockfile`: exit 0. Local dependencies were initially absent.
- `bun run typecheck`: final exit 0. Initial attempts failed before dependency installation and the nested pot postinstall finished; no source type errors remain.
- `bun run test`: exit 0, 69 tests, 914 assertions.
- `bun run build`: exit 0, production assets generated; Vite warns about chunks over 500 kB.
- `bunx playwright test --config playwright.web028.config.ts --grep 'arena first'`: exit 0, full new interaction workflow passed.
- `$env:VILLAGE_ARENA_HARDWARE_QA='1'; bunx playwright test --config playwright.web028.config.ts`: exit 1, 8 passed, 1 skipped live-API-only test, 1 strict performance failure. Includes audited evidence upload/approve/reject/settle/winner, mobile friendly entry/settle, existing evidence dialogs, missing models, reduced motion, new preview/create/join/filter/evidence/return, and canvas identity preservation.
- `git diff --check` from the worktree root: exit 0.

Performance is NOT accepted: Chromium used ANGLE/SwiftShader even when forced-software flags were removed. The combined run measured a 450.1 ms maximum during entry/selection transitions. The existing steady-state capture measured median 50 ms and p95 66.7 ms; the CSS entrance was 240 ms. This host does not demonstrate 60 fps or the required no-frame-over-50-ms transition budget. The test intentionally fails rather than skipping or loosening this requirement. A final targeted capture and its result are recorded below.

Artifacts (actual browser captures of synthetic demo fixtures; no real-person photos or paid generation):
- `artifacts/web028/arena-empty.png`
- `artifacts/web028/arena-create.png`
- `artifacts/web028/arena-evidence.png`
- `artifacts/web028/arena-mobile.png`
- `artifacts/web028/arena-walkthrough.webm` (approximately 29 seconds)
- `artifacts/web028/steady-state-performance.json`
- `artifacts/web028/transition-performance.json`
- `artifacts/web028/transition-trace.zip`

Teammate trial, PowerShell from `apps/web`:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5188
```

Open http://localhost:5188, choose Iraj if prompted, then Compete. Hover a banner; click to lock; inspect a contender. Create a challenge, read terms and confirm Join, or use Submit / manage competition. Open filters show joinable challenges; use Past after settling. Escape backs out of evidence/controls first, then returns to town; the Village button returns directly. View the trace with `bunx playwright show-trace artifacts/web028/transition-trace.zip`.

Decisions/contracts: Current means all unsettled competitions; Open is the subset this user may join; Mine includes creator, auditor and joined participant; Past means settled. The API has only open/settled, so the banner's active chip means an open competition with submitted entries. Team/mode/dates/XP/auditor-fee metadata remains optional, as in the existing arena. No contract edits are required for this implementation. An authoritative active lifecycle or configurable team/date/XP terms would require integrator-owned contract work. No live API mutations, model generation, SOL signatures or payments were performed. No secrets were copied.

Outstanding acceptance blocker: verify and, if necessary, further optimize transitions on an actual hardware GPU; the strict 50 ms / 60 fps acceptance criterion remains unmet on this host.

Final timing capture: `$env:VILLAGE_ARENA_HARDWARE_QA='1'; bunx playwright test --config playwright.web028.config.ts --grep 'record transition' --output test-results/web028-perf` exited 1. Sampling runs continuously through the complete camera move. Maximum frame interval: 200.1 ms; 27 intervals exceeded 50 ms. Renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver). The committed trace and transition JSON are from this final capture.
