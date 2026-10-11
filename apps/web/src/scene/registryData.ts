export type District = 'residential' | 'commercial' | 'plaza' | 'festival' | 'park';
export type Entry = {
  id: string; kind: string; name?: string; tags?: string[]; requires?: string[];
  unlock?: { village_level?: number; id?: string };
  asset?: { glb?: string; attach?: { anchor?: string; bone?: string; offset?: [number, number, number]; rotation?: [number, number, number]; scale?: number } };
  placement?: { district?: District; role?: string; size?: number; color?: string; shape?: string; action?: string; level?: number; variant?: boolean };
};
export function normalizeCatalog(raw: unknown): Entry[] {
  if (!raw || typeof raw !== 'object') return [];
  const value = raw as Record<string, unknown>;
  if (Array.isArray(raw)) return raw.filter(e => e && typeof e.id === 'string');
  const entries = value.entries ?? value.items ?? value.catalog ?? value.CATALOG ?? value.default;
  const result = entries === raw ? [] : normalizeCatalog(entries);
  const buildings = Array.isArray(value.buildings) ? value.buildings : [];
  const byId = new Map(result.map(e => [e.id, e]));
  for (const b of buildings) if (b && typeof b.id === 'string') byId.set(b.id, {...byId.get(b.id), kind: 'building', ...b});
  return [...byId.values()];
}
export function mergeRegistry(base: Entry[], incoming: Entry[]): Entry[] {
  const merged = new Map(base.map(e => [e.id, e]));
  for (const e of incoming) { const old = merged.get(e.id); merged.set(e.id, {...old, ...e, asset: {...old?.asset, ...e.asset}, placement: {...old?.placement, ...e.placement}}); }
  return [...merged.values()];
}
export function available(e: Entry, world: { level?: number; unlocked?: string[] }) {
  return (!e.unlock?.id || !!world.unlocked?.includes(e.unlock.id)) && (!e.unlock?.village_level || (world.level ?? 1) >= e.unlock.village_level)
    && (e.requires ?? []).every(id => world.unlocked?.includes(id));
}
