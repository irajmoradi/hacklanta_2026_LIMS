# WEB-034 — shared notifications

Branch: `web/WEB-034`. Implementation milestone: `f66ee0c` (`feat(web): unify transient notifications and celebration cards`). Follow-up validation and responsive refinements are committed on the same branch.

## Behavior and choices

- `useToast()` and the shared store accept success, reward, event, disaster, error and info cards, optional detail/thumbnail, amount/currency, and an async action. At most three cards display, newest first; overflow waits without expiring. Normal cards last four seconds, moments 2.5 seconds, and errors persist until dismissal. Hover, keyboard focus and running actions pause the countdown.
- The single viewport is mounted through the existing root `Reconnecting` component. Duplicate dialog reconnect pills were removed. Notifications portal into an open native dialog and use a manual browser popover, escaping clipping even when the dialog scrolls while keeping their buttons operable within the modal focus scope.
- Placement measures the top bar, dashboard, dock, profile, widget pop-out and native dialogs. On small screens, full-screen panels reserve one notification lane based on the actual wrapped top-bar height; additional cards wait. If no usable rectangle exists, notices remain queued.
- Repair, building unlock, level-up and crown/competition celebrations use illustrated cream cards and local confetti. The existing scene's celebrated IDs, goal bursts, sound hooks and VFX files are preserved; no scene particle implementation was changed. Reduced motion disables card/confetti/progress animation.
- Migrated check-ins, goals, purchases/equipment, house/settings saves, social messages, Villager-grams, onboarding/agent notices, clean-view hints, reconnection and celebrations. New event/disaster notifications use typed cards; disaster cards include a View action.
- Field validation, durable receipts, job progress, and the ongoing disaster repair checklist remain beside their controls. These are persistent workflow content rather than transient confirmations. The redundant face-recognition pill and shop checkout receipt overlay were removed.
- Everything works with mock fixtures, failed/missing generated assets and no GPU/API credentials. No paid generation, messaging, transactions, secrets or contract edits were needed.

## Files

New: `src/components/Toast.tsx`, `toastStore.ts`, `toastStore.test.ts`, `nativePopover.d.ts` (React 18 attribute typing); `tests/web034.config.ts`, `web034.spec.ts`, this report and `tests/artifacts/web034/*.png` (with generated build/results ignored).

Updated: `src/App.tsx`, `src/styles.css`; components `AgentPanel`, `Celebration`, `FaceCheck`, `HouseEditor`, `Messages`, `Modals`, `Onboarding`, `Reconnecting`, `SettingsPanel`, `Villagergram`, `Wardrobe`, and `shared`.

Legacy assertions migrated in `tests/feat013.spec.ts`, `features.spec.ts`, `polish.spec.ts`, `web015.spec.ts`, and `web021.spec.ts`. Purchase notifications retain the item name as their detail. Those complete historical suites were not rerun; the focused WEB-034 suite covers the affected notification behaviors and real purchase/check-in/settings flows.

## Try it

From `apps/web`, run `bunx playwright test --config tests/web034.config.ts`. The configuration starts an isolated mock Vite server on port 5334 without secrets or an API. It exercises real check-in, level-up, purchase, settings-save and disaster/repair flows as well as every notification kind, actions, queue/timers, and panel geometry at 1280×720, 1600×900 and 390×844. Clock jumps avoid replaying thousands of software-rendered 3D frames in the timer test.

For manual testing, start `bun run dev` with `VITE_MOCK=1` and `VITE_DEMO_AUTH=1`, select a demo seat, submit a check-in, buy a Village Cap, or save Settings. Notifications remain accessible with a profile or dialog open. Use `const {toast} = useToast()` in components; legacy string callers map to success. Supply `{kind:'error',title,action:{label:'Retry',onClick}}` for failures, or `{variant:'moment',title,icon}` for celebrations.

Screenshots: `tests/artifacts/web034/profile-*.png`, `repair-*.png`, `widget-*.png`, `dialog-*.png`, and `kind-*.png` cover the three viewport sizes and all kinds, including coin/diamond rewards and level/crown moments.

## Validation

Commands run from `apps/web`:

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | Exit 0; installed the missing local dependencies without lockfile edits. |
| `bun run typecheck` | Exit 0. |
| `bun run test` | Exit 0; 142 tests pass across 35 files. |
| `bun test src/components/toastStore.test.ts` | Exit 0; 6 queue/placement/lifecycle tests pass. |
| `bunx playwright test --config tests/web034.config.ts` | Exit 0; all 7 browser tests pass in the final uninterrupted run (4.4 minutes). |
| `bunx vite build --outDir tests/artifacts/web034/build` | Exit 0; production build succeeds. Vite reports chunks over 500 kB. |
| `git diff --check` | Exit 0. |

Earlier runs caught the wrapped mobile top bar needing measured clearance, the disaster checklist occupying the notification lane, and clipping when scrolling a native dialog. Those cases are covered by the final responsive and real repair tests. Timer tests now use clock jumps instead of replaying every WebGL animation frame. An early browser run was invalidated by editing a Vite module during the run; the final run kept runtime sources stable. The native popover attribute is declared locally for the pinned React 18 typings. Screenshots were opened and visually reviewed, including desktop/mobile repair cards, dialog placement, rewards, errors and crown moments.

No contract changes proposed. No external-service dependency or approval blocker.
