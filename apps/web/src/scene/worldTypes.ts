import type { Village } from '../api/types';
export type WorldState = { disaster?: import("../api/types").Disaster|null; level?: number; unlocked?: string[]; weather?: 'clear' | 'rain' | 'fog' | 'festival_night'; time_of_day?: number | string };
export function readWorld(village: Village): WorldState {
  const raw = (village as Village & { world?: WorldState }).world;
  return raw && typeof raw === 'object' ? { ...raw, unlocked: Array.isArray(raw.unlocked) ? raw.unlocked.flatMap(v => typeof v === 'string' ? [v] : v && typeof v === 'object' && 'id' in v && typeof v.id === 'string' ? [v.id] : []) : [] } : { unlocked: [] };
}
export function worldHour(world: WorldState, localHour = new Date().getHours() + new Date().getMinutes() / 60) {
  const value = world.time_of_day;
  if (typeof value === 'number' && Number.isFinite(value)) return ((value % 24) + 24) % 24;
  if (typeof value === 'string') {
    const named: Record<string, number> = { dawn: 6, morning: 9, day: 12, afternoon: 15, dusk: 18, evening: 19, night: 22 };
    if (Object.hasOwn(named, value)) return named[value];
    if (/^\d{1,2}:\d{2}$/.test(value)) { const [h, m] = value.split(':').map(Number); if (h < 24 && m < 60) return h + m / 60; }
  }
  return localHour;
}
export const isNight = (world: WorldState, hour = worldHour(world)) => world.weather === 'festival_night' || hour < 6 || hour >= 19;
export const isUnlocked = (world: WorldState, name: string) => world.unlocked?.includes(name) === true;
export function seededRandom(seed: number) {
  let value = seed | 0;
  return () => { value += 0x6d2b79f5; let t = Math.imul(value ^ value >>> 15, 1 | value); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export type XY = [number, number];
export const ISLAND_RADIUS = 20.55; // 2.5 times the original 13m-radius island's area.
export function housePlot(slot: number, seed: number): XY {
  const random = seededRandom(seed + slot * 701);
  const angle = Math.PI + (slot % 9) / 8 * Math.PI;
  const radius = 10.5 + Math.floor(slot / 9) * 3 + random() * .6;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius - 1];
}
export function townLayout(seed: number) {
  const random = seededRandom(seed);
  const offset = () => (random() - .5) * 1.2;
  return { festival: [10 + offset(), 6 + offset()] as XY, park: [-7 + offset(), 9 + offset()] as XY,
    lake: [1 + offset(), 13 + offset()] as XY, shelter: [-13 + offset(), 3 + offset()] as XY,
    trees: Array.from({length: 90}, (_, i) => { const a = i / 90 * Math.PI * 2; const r = 18 + random() * 1.5; return { x: Math.cos(a) * r, z: Math.sin(a) * r, scale: .55 + random() * .6, shade: '#789973' }; }) };
}
export type Activity = 'cafe' | 'workout' | 'gaming' | 'study' | 'kneel' | 'eat' | 'walk_pet' | 'wander' | 'sit' | 'dance' | 'visit' | 'gather';
export function activityTarget(seed: number, slot: number, turn: number, night: boolean, event: boolean, friendSlots: number[]): { activity: Activity; target: XY } {
  const layout = townLayout(seed), random = seededRandom(seed + slot * 701 + turn * 31);
  if (event) { const a = slot * 2.4; return {activity: 'gather', target: [Math.cos(a) * 3, Math.sin(a) * 3 + .3]}; }
  if (night) return { activity: 'dance', target: [layout.festival[0] - 1.5 + slot % 3, layout.festival[1] + 1.5 + Math.floor(slot / 3)] };
  if (turn % 3 === 1) return { activity: 'sit', target: [layout.park[0] - 2, layout.park[1] + (slot % 3 - 1) * 1.8] };
  const friends = friendSlots.filter(friend => friend !== slot);
  if (turn % 3 === 2 && friends.length) { const p = housePlot(friends[slot % friends.length], seed); return { activity: 'visit', target: [p[0], p[1] + 2] }; }
  const a = random() * Math.PI * 2;
  return {activity: 'wander', target: [Math.cos(a) * 5, Math.sin(a) * 4]};
}
