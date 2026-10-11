WEB-019 — current-seat movement and drag-to-ride

Branch: `web/WEB-019`. Implementation: `298a1a7`. Verified fixes, tests and evidence: `957d801`. This report is committed separately on the same branch. All changes are within `apps/web/**`.

Completed behavior

- WASD and arrows move the current seat's villager relative to the camera. Shift runs; Space waves; C toggles smooth follow. House footprints and town edges block movement, including large steps. Ground drops route along the existing sidewalk graph with collision-checked start/end connections.
- Manual input suspends only that villager's schedule, which resumes after 20 seconds without input. Attraction activities last 120 seconds. Keyboard movement cancels an activity. Inputs, editable content, IME, modifiers and open modals do not trigger movement. F remains unhandled for fullscreen integration.
- Hold for 250 ms or drag the current villager's visible body/nameplate to pick it up. The avatar lifts above its ground ring; the cursor changes, and available drop targets highlight. Mouse and touch gestures work; blank-map pan/rotate/zoom remain available. Dropping outside the scene, over HUD chrome, onto an invalid building, or cancelling returns the villager. Other villagers cannot be picked up.
- Ferris wheel: the villager is actually portaled into an upright gondola, travels for two revolutions (104.72 seconds at 0.12 radians/second), then disembarks at the entrance and resumes its schedule. Seat switching clears ride ownership. The wheel uses local procedural geometry so cabin anchors work with all model downloads blocked.
- Stage: dance on its platform. Fountain: sit with a book. Garden: kneel at the beds. Food truck: eat. Shelter: kneel and pet a visible dog. Own house: chill at its entrance. Study nook: use an available study seat. Colosseum entrance: gather for the temporary activity.
- A dismissible first-visit walking hint explains controls. Conflicting panel shortcuts are now Alt+A (accomplishments), Alt+C (check-in), Alt+W (weekly review), and Alt+S (shop); toolbar shortcut labels were updated.

Choices and integration notes

The checked-out routing implementation is WEB-017's rectangular town. Movement and drops derive their positions/bounds from its town and graph data. WEB-029's proposed curved layout is not present in this branch; its future integrator should preserve graph/footprint agreement when changing lot dimensions or roads.

The catalog deliberately puts the colosseum in a separate scene. A small town-side entrance provides the requested local drop activity; the arena itself remains in its existing scene. No API or contract changes are needed. Controls and temporary activities are local, with no paid generation calls.

Files changed

- `src/App.tsx`: current identity, modal guard and panel shortcut integration.
- `src/scene/VillageScene.tsx`: schedule override, body/emote rendering, ride parenting, activity props, hint and colosseum entrance.
- `src/scene/TownCamera.tsx`: smooth current-villager follow, preserving map controls.
- `src/scene/GridTown.tsx`, `src/scene/RideWheel.tsx`: visible wheel with stable gondola anchors.
- `src/scene/OptionalModel.tsx`: loaded-rig wave, kneeling and eating arm poses.
- `src/scene/playerControl.ts`, `src/scene/usePlayerController.ts`, `src/scene/DropHighlights.tsx`: collision/routing, keyboard/pointer lifecycle, target resolution and highlights.
- `src/styles.css`: walking hint presentation.
- `src/scene/playerControl.test.ts`, `package.json`: unit coverage and inclusion in the standard test command.
- `playwright.web019.config.ts`, `tests/web019.spec.ts`, `tests/web019Scene.ts`: isolated fixture server and browser tests; the scene inspection/clock helper is test-only.
- `artifacts/web019/`: four browser screenshots and a WebM recording.
- `WEB-019-REPORT.md`: this report.

Verification

Commands below ran from `apps/web`, except the targeted `bun test` command and `git diff --check`, which ran from the worktree root. Browser commands used `$env:VILLAGE_BROWSER_GPU='hardware'` on this Windows machine. The config defaults to SwiftShader when that variable is absent.

- `bun test src/scene/playerControl.test.ts src/scene/layout/town.test.ts` ? exit 0; 16 passed, 4,157 assertions.
- `bun run test --timeout 30000` ? exit 0; 105 passed, 12,028 assertions.
- `bun run typecheck` ? exit 0 after installing the existing dependency sets.
- `bun run build` ? final exit 0; TypeScript and Vite build passed. Vite reports its existing large-chunk advisory.
- `bunx playwright test --config playwright.web019.config.ts web019.spec.ts` ? exit 0; all four feature scenarios passed.
- `bunx playwright test --config playwright.web019.config.ts web017.spec.ts --grep 'left drag|touch pinch|zoom and repeated|opening a profile'` ? exit 0; four existing map-control regression scenarios passed.
- `bunx playwright test --config playwright.web019.config.ts web019.spec.ts --grep 'hold own|body pickup'` ? final exit 0; two targeted scenarios passed after the final ownership guard, including switching away from and back to a riding villager.
- `git diff --check` ? exit 0.

The browser checks cover actual keyboard movement, waves, camera follow, modal/input blocking, inactivity resumption, mouse/body/touch pickup, highlighted targets, ground routing, ownership, two-loop disembarkation, cancellation, temporary activity expiry and fully blocked model downloads. They use fixture API data and real Chromium rendering, not a live backend. Long activity deadlines and the end of the two-loop ride are advanced through test-only clocks; the WebM shows real-time boarding and motion.

During development, initial browser failures exposed the legacy shortcut conflict and the HTML-label event-container boundary; both were fixed. One default five-second unit timeout in the existing paddock suite occurred under load; the complete suite then passed with the 30-second test budget. Missing initial dependencies and a fresh npm install's mismatched Playwright peer version were corrected locally to the versions in the existing Bun lockfile. No dependency-version changes were committed.

Visual evidence (reviewed)

- `artifacts/web019/keyboard-wave.png`
- `artifacts/web019/drop-highlights.png`
- `artifacts/web019/ferris-ride.png`
- `artifacts/web019/offline-controls.png`
- `artifacts/web019/ferris-walkthrough.webm`

Try it

1. From `apps/web`, install the locked dependencies with `bun install --frozen-lockfile` (the existing postinstall also installs the isolated pot panel dependencies).
2. Run the four feature scenarios with `bunx playwright test --config playwright.web019.config.ts web019.spec.ts`. They unlock the wheel only in their local fixture response; production unlock rules remain enforced.
3. For manual play, run Vite in the existing demo/live configuration and choose a seat. Walk with WASD/arrows, hold Shift to run, wave with Space, or use C to stop camera follow. Hold your own body or nameplate and drop onto one of the highlighted attractions. A live village must have the Ferris wheel unlocked to offer its ride.

Blockers: none. Proposed contract changes: none. No pushes or merges performed.
