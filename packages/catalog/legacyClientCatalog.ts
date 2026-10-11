import type { VillageCatalog, Entry } from './dist/catalog';

/** Temporary boundary for the integrator-owned apps/web/src/api/types.ts union.
 * Runtime slots are preserved verbatim: the HTTP API and replaceSlot accept them.
 * Remove this adapter after EquipmentSlot includes bottoms and shoes upstream.
 * New code should use catalogData/entriesById for the complete slot type.
 */
export function legacyClientCatalog(data: VillageCatalog) {
  type LegacyEntry = Omit<Entry, 'slot'> & { slot?: Exclude<Entry['slot'], 'bottoms' | 'shoes'> };
  return data as unknown as Omit<VillageCatalog, 'entries'> & { entries: [LegacyEntry, ...LegacyEntry[]] };
}
