import { BENCH_SEATS } from './benchSeats';
import { squareTown } from './squareTown';
import { cafeSeat, cafeTime } from './cafeSeats';
import { activityPhase, STUDY_SEATS } from './studySeats';
import { available, type Entry, type District } from '../registryData';
import type { XY, WorldState } from '../worldTypes';
import type { IdleActivity } from '../../api/types';
import type { Activity } from '../worldTypes';
import { seededRandom } from '../worldTypes';
import {lotEntrance, makeStreets, PITCH, type Street} from './streets';
export {PITCH} from './streets';
export const GRID = 4, COLS = 6, ROWS = 6;
export type Lot = { id: string; center: XY; yaw: number; district: District; entry?: Entry; memberSlot?: number };
export type Town = { seed: number; lots: Lot[]; streets: Street[]; petLoop: XY[]; width: number; depth: number; roadsX: number[]; roadsZ: number[]; homes: Map<number, Lot>; unplaced: string[] };
export function createTown(seed: number, entries: Entry[], slots: number[] = [], shape?: 'lab-square'): Town {
  if (shape === 'lab-square') return squareTown(seed, entries, slots);
  const lots: Lot[] = [];
  const addRows = (start: number, count: number, districtOverride?: District) => {
    for (let row = start; row < start + count; row++) for (let col = 0; col < COLS; col++) {
      const district: District = row === 0 || row >= ROWS ? 'residential'
        : row === 1 ? 'commercial' : row === 2 ? (col === 0 || col === 5 ? 'commercial' : 'plaza')
        : col < 3 ? 'park' : 'festival';
      const center: XY=[(col-2.5)*PITCH,(row-2.5)*PITCH];
      // Preserve API seed.py (1337) and mock fixtures (24109); elsewhere vary the building
      // inside its address, independently of membership order or town growth.
      const r=seededRandom(seed+row*8191+col*131);
      const vary=(districtOverride??district)==='residential' && seed!==1337 && seed!==24109;
      const yaw=vary?(r()-.5)*.07:0;
      if(vary) {center[0]+=(r()-.5)*.8;center[1]-=r()*.7;}
      lots.push({id: `${row}:${col}`, center, yaw, district: districtOverride ?? district});
    }
  };
  addRows(0, ROWS);
  const maxSlot = Math.max(-1, ...slots);
  // Addresses stay fixed as membership grows; add complete two-row blocks at the edge.
  const extraRows = Math.max(0, Math.ceil((maxSlot + 1 - COLS) / (COLS * 2)) * 2);
  addRows(ROWS, extraRows);
  const homes = new Map<number, Lot>();
  const residential = lots.filter(l => l.district === 'residential');
  const offset = Math.floor(seededRandom(seed)() * COLS);
  for (let slot = 0; slot <= maxSlot; slot++) {
    const lot = residential[Math.floor(slot / COLS) * COLS + (slot % COLS + offset) % COLS];
    homes.set(slot, lot);
    // Reserve sparse addresses too, so later members cannot displace civic buildings.
    if (slots.includes(slot)) lot.memberSlot = slot;
  }
  const reserved = new Set(homes.values());
  for (const entry of entries.filter(e => !e.tags?.includes('separate_scene') && (e.placement?.district || e.kind === 'building'))) {
    const raw = entry.placement?.district as string | undefined;
    const district: District = raw === 'lake' || raw === 'shelter' ? 'park' : (raw as District) ?? 'commercial';
    const vacant = () => lots.filter(l => !l.entry && !reserved.has(l));
    const candidates = vacant().filter(l => l.district === district);
    // Favor the center while shuffling civic parcels within their district.
    const rank=(l:Lot)=>{const [r,c]=l.id.split(':').map(Number);return Math.hypot(c-2.5,r-2.5)+seededRandom(seed+r*8191+c*131)()*1.8;};
    candidates.sort((a,b) => rank(a)-rank(b));
    if(entry.id==='farm_store') candidates.sort((a,b)=>Number(b.id.endsWith(':5'))-Number(a.id.endsWith(':5')));
    let lot = candidates[0] ?? vacant().find(l => l.district !== 'residential');
    if (!lot) {
      addRows(lots.length / COLS, 2, district);
      lot = lots[lots.length - COLS * 2];
    }
    lot.district = district;
    lot.entry = entry;
  }
  const totalRows = lots.length / COLS;
  return {seed,lots, homes, streets:makeStreets(lots,totalRows,COLS,seed),
    petLoop:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>[x*PITCH,z*PITCH] as XY),
    width: COLS * PITCH + 20, depth: totalRows * PITCH + 20,
    roadsX: Array.from({length: COLS / 2 + 1}, (_,i) => -3*PITCH + i * PITCH * 2),
    roadsZ: Array.from({length: totalRows / 2 + 1}, (_,i) => -3*PITCH + i * PITCH * 2), unplaced: []};
}
export const entrance = lotEntrance;
// Activities occupy most of a ten-minute cycle, with a staggered 90-second home visit.
// Wall time advances even when the API pins time_of_day to afternoon.
export function destination(town: Town, slot: number, _tags: string[], world: WorldState, event: boolean,
  seconds = Date.now() / 1000, idle: IdleActivity = 'home', hasPet = false, studySeat?: number, cafeIndex: number | null = slot, benchIndex: number | null = slot % 3): {target: XY; activity: Activity; yaw?: number; seat?: number} {
  if (world.disaster?.kind === 'blight' && idle === 'gardening' || world.disaster?.kind === 'blackout' && idle === 'dancing') idle = 'home';
  const home = town.homes.get(slot) ?? town.lots[0];
  const open = town.lots.filter(l => l.entry && available(l.entry, world));
  const stage = world.weather === 'festival_night' ? open.find(l => l.district === 'festival' && l.entry?.placement?.shape === 'stage') : undefined;
  const plaza = event ? open.find(l => l.entry?.placement?.action === 'mayor') : undefined;
  const phase = activityPhase(seconds, slot);
  if (stage) return {target: entrance(stage), activity: 'dance'};
  // Mayor events last days: gather for 2 minutes of each 10-minute cycle, otherwise live normally.
  if (plaza && phase < 120) return {target: entrance(plaza), activity: 'gather'};
  const cafe = open.find(l => l.entry?.id === 'storefront_cafe' && world.disaster?.closed_building !== l.entry.id);
  if (cafe && cafeIndex !== null && cafeTime(seconds, slot)) return {...cafeSeat(cafe.center, cafeIndex), activity: 'cafe'};
  if (phase < 510 && idle !== 'home') {
    if (idle === 'gaming') return {target: entrance(home), activity: 'gaming'};
    if (idle === 'working_out') {
      const lot = open.find(l => l.entry?.id === 'fitness_corner');
      if (lot) return {target: [lot.center[0] - 3 + (slot % 4) * 2, lot.center[1] + 3 + Math.floor(slot / 4) % 2 * 2], activity: 'workout'};
      return {target: entrance(home), activity: 'wander'};
    }
    if (idle === 'walk_pet' && hasPet) {
      const loop = town.petLoop;
      return {target: loop[Math.floor(phase / 120) % loop.length], activity: 'walk_pet'};
    }
    if (idle === 'studying') {
      const lot = open.find(l => l.entry?.id === 'study_nook');
      const seat = studySeat === undefined ? undefined : STUDY_SEATS[studySeat];
      if (lot && seat) return {target: [lot.center[0] + seat.offset[0], lot.center[1] + seat.offset[1]], activity: 'study', yaw: seat.yaw, seat: studySeat};
      return {target: entrance(home), activity: 'wander'};
    }
    const ids = {gardening: 'garden', dancing: 'festival_stage', reading: 'fountain', food: 'food_truck'};
    if (idle !== 'walk_pet') {
      // Starter villages already have planted empty park lots; no unlock is required to garden.
      const lot = open.find(l => l.entry?.id === ids[idle]) ?? (idle === 'gardening'
        ? town.lots.find(l => l.district === 'park' && !l.entry && l.memberSlot === undefined) : undefined);
      const activity: Activity = idle === 'gardening' ? 'kneel' : idle === 'reading' ? 'sit' : idle === 'dancing' ? 'dance' : 'eat';
      if (lot && idle === 'reading') { const seat = benchIndex === null ? undefined : BENCH_SEATS[benchIndex]; if (seat) return {target:[lot.center[0]+seat.offset[0],lot.center[1]+seat.offset[1]],activity,yaw:seat.yaw}; }
      else if (lot) return {target: entrance(lot), activity};
    }
  }
  return {target: entrance(home), activity: 'wander'};
}
