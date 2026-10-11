# FEAT-025 verification and handoff

One Canvas now contains every storey, spaced 3.4 m apart. Upper storeys use 25% opacity and ignore pointer hits; lower storeys remain visible. Each adjacent pair shares one instanced stair flight and an actual opening in the upper slab. Floor shortcuts land at the stairs, while walking, stair buttons, and E traverse the same continuous path. Camera height follows the player. Existing edit permissions, pinned drafts, undo/redo, and save behavior remain in place.

## Design choices

- Front stair lane: x=-3..3, z=2.5..3.5. New furniture placements reserve the lane and landings. Existing saved arrangements are not rewritten.
- Movement sends optional y alongside the existing FEAT-022 payload. Current servers strip y; receivers reconstruct stair height from x/z/floor in the reserved lane. The browser mock deliberately strips y too.
- Avatar identities stay mounted across floors. Ghost materials are cloned per floor and disposed on unmount. Stair treads use one instanced draw per flight.
- The old scene/InteriorAvatars.tsx was outside allowed_paths; its replacement lives in components/InteriorAvatars.tsx.
- No API, contract, root, environment, or live-village changes. No paid generation or credentials required.

## Reproduce

From apps/web, with the configured runner:

```sh
../../ops/remote_run.sh bun run test
../../ops/remote_run.sh bun run build
../../ops/remote_run.sh bunx playwright test --config tests/feat025.config.ts
```

The Playwright config starts Vite on port 5225. HTTP and WebSocket traffic is fulfilled entirely by the fixture transport. Two separate browser contexts exercise peer height without a real API. Tests cover the two-floor Hall and three-floor private home, both stair directions, E, keyboard entry, floor shortcuts, owner permissions, and floor-spanning draft undo/redo/save.

Screenshots are in tests/artifacts/feat025: ground-floor.png, floor-2.png, cutaway-climbing.png, home-floor-3.png.

## Integration notes

No required contract changes or blockers. An optional future API change could preserve finite y on house movement and enforce the reserved stair footprint for older clients. Existing furniture saved in that footprint may need owner rearrangement; this task does not silently relocate it.

## Files changed

- src/components/HouseInterior.tsx
- src/components/HouseInteriorFloors.tsx (new)
- src/components/InteriorAvatars.tsx (new)
- src/components/interiorWalk/useInteriorWalk.ts
- src/scene/interiorWalk.ts
- tests/interiorWalk.test.ts
- tests/feat019Mock.ts
- tests/feat025.config.ts and tests/feat025.spec.ts (new)
- tests/feat025.md and tests/artifacts/feat025/*.png (handoff and screenshots)

## Results

All commands above ran through ops/remote_run.sh on the configured runner:

- bun run test: exit 0; 256 passed, 0 failed across 67 files.
- bun run build: exit 0; TypeScript and Vite production build passed. Vite reports its existing large-bundle advisory.
- bunx playwright test --config tests/feat025.config.ts: exit 0; both browser tests passed (1.1 minutes).
- git diff --check: exit 0.

Earlier checks caught an arrow encoding error and a middle-floor landing/button interaction regression. Both were fixed before the successful final runs. Screenshots were opened and visually reviewed, including the three-storey framing.

Branch: feat/FEAT-025. Implementation milestone: 6a07582; subsequent verification commit contains the final fixes, tests, screenshots, and this report.
