# FEAT-016 handoff

Branch: `feat/FEAT-016`. Implementation milestones: `93ffdef` (scenes and voice contract), `11c8588` (prewarm, camera, interaction and regression tests). The final documentation/artifact commit is the branch HEAD following these milestones.

Check-in now starts with your own 3D villager, a talking pose, four choices, and the existing form. Successful submission plays the FIX-010 cheer, shows the authoritative XP/coin award above the character, and restores the camera. Mayor opens at the ASSET-005 plaza with a hat tip, greeting, six keyboard-accessible choices, typewritten answers, and the existing prayer/bribe/challenge content. Mobile uses a bottom sheet. Reduced motion removes camera interpolation, typing, and character motion.

C opens check-in, Alt+C still works, M opens Mayor, 1-6 choose, Back returns to the menu, and Escape exits. The former follow shortcut is now Shift+C; its hint and regression tests are updated. Text inputs keep number keys. Native dialog focus/inertness and busy-state exit guards remain in place.

The existing town renderer, models and inactive shop/arena remain warm. Geometry, characters and callbacks are memoized so opening dialogue does not rebuild the town or inactive secondary renderers. Entry and return both interpolate for 300 ms, with the original camera view restored. Villagers at home/gaming cut to their doorstep; elsewhere their current position is held. No FEAT-015 house interior was present in this checkout, so the doorstep is the selected fallback.

Rumours reuse the existing generated Gazette gossip, cached for one hour per member/village/API mode, with no new generation job. Play displays existing Mayor events and links to the existing Colosseum challenge flow. Bribe shows the initial offer cost and retains its adjustable coin slider.

`POST /api/villages/{vid}/scene-voice/{checkin|mayor}` is documented in `packages/contracts/api.md`. It requires membership, accepts no arbitrary text, uses only a consented clone for self check-in or the configured stock Mayor voice, and serializes/reuses existing fixed greeting lines. Missing configuration/provider failure returns null for a local soft blip. Greetings are requested only on explicit scene opening, never during prewarm. No migration is needed.

**Validation**

Commands below were run from `apps/web`, except API checks from `apps/api`. Hardware browser runs set `$env:VILLAGE_BROWSER_GPU='hardware'` and use the existing browserGpu configuration.

| Command | Result / exit |
| --- | --- |
| `bun install --frozen-lockfile` | Installed existing locked dependencies; 0 |
| `bun run typecheck` | Passed; 0 |
| `bun run build` | Passed including TypeScript; 0. Existing large-chunk advisory remains. |
| `bun run test --timeout 30000` | 145 passed / 35 files; 0 |
| `bunx playwright test --config playwright.feat016.config.ts` | 4 passed; 0 |
| `bunx playwright test --config playwright.feat016.config.ts --grep "Mayor all six"` | 1 passed; 0. Completed visible typewriter content captured. |
| `bunx playwright test --config playwright.fix010.config.ts` | 2 passed; 0. Existing rig, keyboard and touch emotes. |
| `bunx playwright test --config playwright.web019.config.ts --grep "keyboard moves only"` | 1 passed; 0. Movement, follow, settings/input guards and idle resume. |
| `bunx playwright test --config playwright.feat016-perf.config.ts` | Entry + return budgets passed for both scenes; 0 |
| `python -m pytest tests/test_feat016.py -q` | 9 passed; 0. Service and ASGI route tests, providers/dependencies isolated. |
| `python -m ruff check app/main.py app/voice.py tests/test_feat016.py` | Passed; 0 |
| `python -m ruff format --check app/main.py app/voice.py tests/test_feat016.py` | Passed; 0 |

API checks used the available Python executable at `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`. The external environment path was passed at runtime for the attempted database fixture; secrets were never printed or copied. All browser interactions used `VITE_MOCK=1`. No live village events, disasters, paid provider calls, or transactions were triggered.

E2E coverage includes daily-note persistence exactly once, both rig hands rising during the cheer, return to town, every Mayor choice, actual prayer response, Back/Escape, proof focus, goal selection, an inactive-goal reason, missing GLBs, mobile layout and reduced motion. The Mayor screenshots additionally wait for the visible typewriter text to finish.

**Measured transition performance**

Windows headless Chromium, ANGLE/D3D11, NVIDIA RTX 5090, 1440x1000. Measured after town prewarm and its existing 8-second warmup/2-second quality sample; recorded every rAF interval across the request. This is a measured hardware result, not a guarantee for arbitrary devices or software rendering.

| Transition | Camera ready | Worst frame |
| --- | --- | --- |
| check-in-enter | 303.6 ms | 33.3 ms |
| check-in-return | 312.4 ms | 16.7 ms |
| mayor-enter | 303.9 ms | 33.3 ms |
| mayor-return | 314.8 ms | 16.8 ms |

Raw samples are in `artifacts/feat016/*-performance.json`. Earlier runs exposed the canvas-resize timer restart, unnecessary inactive-renderer reconciliation, keyboard focus, and accumulating talking-arm rotation; these were fixed. The legacy emote test also caught the header intercepting its button after fullscreen sizing; only the canvas wrapper is now fullscreen, and both legacy emote tests pass. A first unextended unit run had one 5-second paddock timeout; its isolated rerun and the full 30-second-timeout suite passed.

**Artifacts**

- Desktop: [check-in](tests/screenshots/FEAT-016/checkin-desktop.png), [form](tests/screenshots/FEAT-016/checkin-form.png), [cheer](tests/screenshots/FEAT-016/checkin-cheer.png), [Mayor](tests/screenshots/FEAT-016/mayor-desktop.png).
- Mobile: [check-in](tests/screenshots/FEAT-016/checkin-mobile.png), [Mayor](tests/screenshots/FEAT-016/mayor-mobile.png), [proof](tests/screenshots/FEAT-016/proof-mobile.png).
- Each Mayor option: `tests/screenshots/FEAT-016/mayor-choice-1.png` through `mayor-choice-6.png`.
- Offline fallback: [missing models](tests/screenshots/FEAT-016/missing-models.png).
- Videos: [check-in](artifacts/feat016/checkin.webm), [Mayor](artifacts/feat016/mayor.webm).

**Try it**

From `apps/web`, run `$env:VITE_MOCK='1'; $env:VITE_DEMO_AUTH='1'; bun run dev`. Choose a demo seat if prompted. Press C, choose Daily note, submit, and watch the cheer/return. Press M and use 1-6 to visit each Mayor option. Resize to 390x844 for the bottom sheet. Use the dedicated Playwright configuration above to reproduce the seeded setup automatically. For connected mode the API reads `VILLAGE_ENV_FILE` at runtime; a consented clone enables check-in speech and `MAYOR_VOICE=1` enables Mayor speech when ElevenLabs is configured.

**Limitations / integration notes**

A database-backed test attempt failed before reaching the route because the existing shared fixture reapplies migration 047 and encounters `DuplicateColumn: competitions.scoring`. The unrelated migration was not changed. Database-backed integration and real provider audio playback are therefore not claimed; the new endpoint is covered by isolated service and HTTP dependency tests. No other feature blocker remains. No further contract change is proposed; the additive greeting endpoint is already documented within this task's allowed contract path.

**Files changed**

- `apps/api/app/main.py`
- `apps/api/app/voice.py`
- `apps/api/tests/test_feat016.py`
- `apps/web/playwright.feat016-perf.config.ts`
- `apps/web/playwright.feat016.config.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/CinematicScene.tsx`
- `apps/web/src/components/MayorModal.tsx`
- `apps/web/src/components/Modals.tsx`
- `apps/web/src/components/cinematicScene.css`
- `apps/web/src/components/shared.tsx`
- `apps/web/src/scene/CinematicContext.ts`
- `apps/web/src/scene/GridTown.tsx`
- `apps/web/src/scene/MayorPlaza.tsx`
- `apps/web/src/scene/TownCamera.tsx`
- `apps/web/src/scene/VillageScene.tsx`
- `apps/web/src/scene/usePlayerController.ts`
- `apps/web/tests/feat016-perf.spec.ts`
- `apps/web/tests/feat016.spec.ts`
- `apps/web/tests/fix010.spec.ts`
- `apps/web/tests/web019.spec.ts`
- `packages/contracts/api.md`
- `apps/web/FEAT-016-REPORT.md`
- `apps/web/tests/screenshots/FEAT-016/*.png`
- `apps/web/artifacts/feat016/*.json` and `*.webm`
