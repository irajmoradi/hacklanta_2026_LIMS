import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import catalog from '../catalog.fallback.json';
import type { Entry } from '../registryData';
import { createTown, entrance, PITCH } from './town';
import { sidewalkGraph } from './navigation';
import { parcel, townDecor } from './variety';

const entries = catalog.entries as Entry[];
// SHA-256 of complete serialized Town (including ordered Map entries), captured
// from the pre-WEB-057 implementation. No regenerated expectations from new code.
const golden = [
  'd1e2161876939996c068bb6ec0763efbcfb947ccbf10f4d0e6910e0b85324ae4',
  '56ceb5418bf6f248cd0ce7396fcea90f0d1a91f16d4effdd64bc7917e6e3b8ff',
  '833e78925938047ad24bd40e7d7cb67f7951eabc1a0e238c6c683107e214191d',
  '15a2e87e3d68ba0297c16231ffafa085748701073e763b3249cb96630c2dd41f',
  'fe10e06b22c42cecc628208346f3b711bbdfdc0a7f8f8be614b4dd59122c83c7',
  'b22f55f05e0205ab61874bc78f6e393e394fa8733f025bd51db9b029c0e84dd4',
  '18907f04a787b2da85b16fa5dac52ae78b3dd510ed67c7d6484de6135f86e52e',
  '32ce9af3f9e2b82e06151a0a9aaddad486070c12694286255db8c6661b30c279',
  '1f3c0a5c5913144b9d18cdec0cd0ead9baa4603d8635e07409d7942698a05377',
];
test('default village output stays byte-identical to the original layout', () => {
  let i = 0;
  for (const seed of [0, 1337, 24109]) for (const slots of [[], [0, 3, 17], Array.from({length:100}, (_, i) => i)]) {
    const town = createTown(seed, entries, slots);
    expect(createHash('sha256').update(JSON.stringify(town, (_, v) => v instanceof Map ? [...v] : v)).digest('hex')).toBe(golden[i++]);
  }
});

for (const count of [25, 50, 100]) test(`${count} Lab homes: square, connected, spaced and centered`, () => {
  for (const seed of [0, 42, 24109]) {
    const slots = Array.from({length:count}, (_, i) => i);
    const town = createTown(seed, entries, slots, 'lab-square');
    expect(town).toEqual(createTown(seed, entries, [...slots].reverse(), 'lab-square'));
    expect(town.width / town.depth).toBe(1);
    expect(town.homes.size).toBe(count);
    const homes = [...town.homes.values()];
    const span = (axis: number) => Math.max(...homes.map(l => l.center[axis])) - Math.min(...homes.map(l => l.center[axis]));
    expect(span(0) / span(1)).toBeGreaterThan(.8);
    expect(span(0) / span(1)).toBeLessThan(1.25);
    for (let i = 0; i < town.lots.length; i++) for (const other of town.lots.slice(i + 1)) {
      // Conservative 14m envelopes leave at least 5m between neighboring homes.
      expect(Math.hypot(town.lots[i].center[0] - other.center[0], town.lots[i].center[1] - other.center[1])).toBeGreaterThan(19);
    }
    const graph = sidewalkGraph(town), visited = new Set<string>(), queue = [graph.keys().next().value!];
    for (let i = 0; i < queue.length; i++) {
      const key = queue[i]; if (visited.has(key)) continue;
      visited.add(key); queue.push(...graph.get(key)!.neighbors);
    }
    expect(visited.size).toBe(graph.size);
    for (const home of homes) {
      expect(visited.has(entrance(home).join(','))).toBe(true);
      const access = town.streets.find(s => s.id === `access:${home.id}`)!;
      expect(access.points[0]).toEqual(entrance(home));
      expect(town.streets.some(s => s.kind !== 'drive' && s.points.some(p => p.join() === access.points.at(-1)!.join()))).toBe(true);
    }
    for (const home of homes) for (const street of town.streets) for (const p of street.points) {
      expect(Math.max(Math.abs(p[0] - home.center[0]), Math.abs(p[1] - home.center[1]))).toBeGreaterThan(7);
    }
    for (const lot of town.lots.filter(l => l.district === 'plaza')) expect(Math.hypot(...lot.center)).toBeLessThan(PITCH * 3);
    expect(town.lots.filter(l => !l.entry && l.memberSlot === undefined).length).toBeGreaterThan(count * .15);
    const trees = townDecor(town).filter(d => d.role.startsWith('tree_'));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      expect(homes.some(l => l.center[0] * sx > PITCH && l.center[1] * sz > PITCH)).toBe(true);
      expect(trees.some(d => d.p[0] * sx > PITCH && d.p[2] * sz > PITCH)).toBe(true);
    }
    for (const lot of town.lots) expect(Math.max(...parcel(lot).map(Math.abs)) + 9).toBeLessThan(town.width / 2);
  }
});
