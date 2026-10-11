import type { Building, Village, VillageWorld } from './types';

const label = (id: string) => id.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
/** API-007 sends upcoming as {building, level, xp}; the UI wants {id, name, xp}. */
export const upcoming = (world?: VillageWorld): { id: string; name: string; xp: number }[] =>
  ((world?.upcoming ?? []) as Array<{ id?: string; name?: string; building?: string; xp: number }>).map(b => {
    const id = b.id ?? b.building ?? 'building';
    return { id, name: b.name ?? label(id), xp: b.xp };
  });
export const buildings = (world?: VillageWorld): Building[] => (world?.unlocked ?? []).map(item => typeof item === 'string' ? { id: item, name: label(item) } : item);
export function newBuildings(previous: Village | null, next: Village): Building[] {
  if (!previous?.world || previous.id !== next.id || !next.world) return [];
  const known = new Set(buildings(previous.world).map(b => b.id));
  return buildings(next.world).filter(b => !known.has(b.id));
}
/** Offline fixture economy only. Live progression is always supplied by the API. */
export function demoWorld(xp: number): VillageWorld {
  const catalog = [{ id: 'square', name: 'Village square', xp: 0 }, { id: 'garden', name: 'Community garden', xp: 1500 }, { id: 'pet_shelter', name: 'Pet shelter', xp: 1500 }, { id: 'farm_store', name: 'Farm Store', xp: 2500 }, { id: 'library', name: 'Little library', xp: 1800 }, { id: 'observatory', name: 'Observatory', xp: 2500 }];
  const unlocked = catalog.filter(b => b.xp <= xp), upcoming = catalog.filter(b => b.xp > xp);
  return { level: unlocked.length, xp, next_level_xp: upcoming[0]?.xp ?? null, unlocked, upcoming, weather: 'Clear skies', time_of_day: 'Afternoon' };
}
