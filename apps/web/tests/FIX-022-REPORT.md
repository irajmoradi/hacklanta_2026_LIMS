FIX-022: generated head attachment

Branch: fix/FIX-022. Production milestone: 117d8c9.

Generated heads now align a measured lower neck anchor to the preset body's neck socket in X/Z. When the lower mesh does not provide a plausible neck section, fitting uses the head bounding box's bottom center. Existing proportional scaling and the small neck overlap retain collar clearance. Visible vertices are measured in the incoming parent's frame, so exported translations, rotations, scales, or an unrelated source parent cannot displace the attachment. The corrected geometry supplies the existing shared hat/glasses frame. Preset heads and sprite cards retain their existing behavior.

Changed production files: src/scene/headFit.ts and src/scene/headAssets.ts.
Regression tests: src/scene/generatedHead.test.ts and src/scene/cosmeticAssets.test.ts. Coverage includes 36 translated/scaled boxes, an offset neck region, transformed source and destination parents, detachment, fixture visibility, and glasses/headphone alignment. The existing ASSET-013 tests also cover all seven glasses on the shared generated-head frame.

Browser harness: tests/fix022.html, tests/fix022-fixture.tsx, tests/fix022.config.ts and tests/fix022.spec.ts. tests/fix022-contact.py assembles contact sheets. This report is tests/FIX-022-REPORT.md.

No cached generated portrait GLBs were found in this worktree. Following the task's fallback allowance, the browser harness uses all five current mock seats' preset bodies, colors and equipment, with five synthetic self-contained GLBs made in memory. Their geometry has different export origins, proportions and neck-to-face offsets. These are synthetic stand-ins, not the teammates' real generated portraits. No credentials, live API access, model-generation jobs, or world-changing actions are needed.

The harness opens the real town and profile UI and mounts the production WardrobePreview. It captures front, side and three-quarter angles for every seat on each surface (45 renders), plus five contextual UI screenshots. Canvas pixels are read immediately to avoid WebGL clearing and overlapping DOM panels. Town closeups clip foreground scenery so buildings and trees do not conceal the attachment. Each render checks neck alignment within 0.025 head-bone units; head frames must agree across surfaces to four decimal places. Periodic mock refreshes can briefly remount a head, so capture waits for reattachment.

Validation commands, run from apps/web through Git Bash on Windows:

- ../../ops/remote_run.sh bun run typecheck: exit 0.
- ../../ops/remote_run.sh bun run test: exit 0; 258 passed, 0 failed across 67 files.
- ../../ops/remote_run.sh bunx playwright test --config tests/fix022.config.ts --max-failures=1: initial complete pass, exit 0; 5 passed.
- ../../ops/remote_run.sh bunx playwright test --config tests/fix022.config.ts --grep 'Maya|Mario' --max-failures=1: exit 0; 2 passed after the capture retry fix.
- ../../ops/remote_run.sh bunx playwright test --config tests/fix022.config.ts --grep 'Iraj|Lance|Stefanny' --max-failures=1: exit 0; 3 passed with the final capture retry logic.
- ../../ops/remote_run.sh bunx playwright test --config tests/fix022.config.ts --grep 'Iraj|Mario' --max-failures=1: exit 0; 2 passed with clear town closeups and normal render-loop lifecycle.
- python tests/fix022-contact.py (local image assembly): exit 0; 45 measured views, maximum X/Z socket error 1.13e-14 head-bone units. All three contact sheets were visually reviewed, including every front, side and three-quarter view.

Earlier development runs exposed overly strict numeric/catalog assertions, a network guard blocking local module imports, and a mock-refresh capture race. A later capture attempt exposed that pausing the render loop could delay a refreshed avatar's mount; the harness now keeps the normal lifecycle running and reads pixels synchronously. These issues were corrected; production unit tests pass. The remote runner was reachable, and no local fallback test run was used.

Artifacts: apps/web/artifacts/fix022/{seat}-{town|profile|wardrobe}-{front|side|three-quarter}.png, {seat}-ui.png, {seat}-measurements.json, and contact-{town|profile|wardrobe}.png. Generated outputs remain local, outside the source commits. Contact sheets composite transparent preview canvases onto a neutral background; individual PNGs preserve transparency.

To reproduce, run the full Playwright command above, then run `python tests/fix022-contact.py` locally after the wrapper downloads the artifacts (requires Pillow). For interactive review, start Vite in mock mode and open /tests/fix022.html; select a villager's Outfit tab. The browser fixture intercepts asset reads and creates its synthetic GLBs at runtime.

Blockers: none. Limitation: the original real portrait assets were unavailable locally; exact real-person mesh appearance remains unverified, as permitted by the task's fallback. Proposed contract changes: none.
