import type { Entry, District } from '../registryData';
import { seededRandom, type XY } from '../worldTypes';
import type { Lot, Town } from './town';
import { makeStreets, PITCH } from './streets';

/** Demo Lab only: addresses may move when the population slider changes. */
export function squareTown(seed: number, entries: Entry[], slots: number[]): Town {
  const civic = entries.filter(e => !e.tags?.includes('separate_scene') && (e.placement?.district || e.kind === 'building'));
  const count = Math.max(-1, ...slots) + 1;
  // Leave breathing room for pocket parks between residential blocks.
  const side = Math.max(8, Math.ceil(Math.sqrt((count + civic.length + 12) / .8) / 2) * 2);
  const start = 3 - side / 2;
  const lots: Lot[] = [];
  for (let row = start; row < start + side; row++) for (let col = start; col < start + side; col++) {
    lots.push({id: `${row}:${col}`, center: [(col - 2.5) * PITCH, (row - 2.5) * PITCH], yaw: 0, district: 'park'});
  }
  const rank = (lot: Lot, target: XY) => Math.hypot(lot.center[0] - target[0], lot.center[1] - target[1]);
  const reach = side * PITCH * .3;
  for (const entry of civic) {
    const raw = entry.placement?.district as string | undefined;
    const district: District = raw === 'lake' || raw === 'shelter' ? 'park' : (raw as District) ?? 'commercial';
    // Plaza/shops form the civic core; lake, gardens and festival anchor different neighborhoods.
    const target: XY = entry.placement?.shape === 'lake' ? [-reach, -reach]
      : district === 'festival' ? [reach, reach]
      : district === 'park' ? [-reach, reach] : [0, 0];
    const lot = lots.filter(l => !l.entry).sort((a, b) => rank(a, target) - rank(b, target))[0];
    lot.entry = entry; lot.district = district;
  }
  const vacant = lots.filter(l => !l.entry);
  // Seeded scattering reserves green gaps, rather than filling successive solid rows.
  const score = (lot: Lot) => {
    const [r, c] = lot.id.split(':').map(Number);
    return seededRandom(seed + r * 8191 + c * 131)();
  };
  vacant.sort((a, b) => score(a) - score(b));
  const homes = new Map<number, Lot>();
  for (let slot = 0; slot < count; slot++) {
    const lot = vacant[slot], random = seededRandom(seed + slot * 977 + 37);
    lot.district = 'residential';
    lot.yaw = (random() - .5) * .07;
    lot.center[0] += (random() - .5) * .8;
    lot.center[1] -= random() * .7;
    if (slots.includes(slot)) lot.memberSlot = slot;
    homes.set(slot, lot);
  }
  const roads = Array.from({length: side / 2 + 1}, (_, i) => (-side / 2 + i * 2) * PITCH);
  return {seed, lots, homes, streets: makeStreets(lots, side, side, seed, start),
    width: side * PITCH + 20, depth: side * PITCH + 20, roadsX: roads, roadsZ: [...roads],
    petLoop: [[-PITCH, -PITCH], [PITCH, -PITCH], [PITCH, PITCH], [-PITCH, PITCH]], unplaced: []};
}
