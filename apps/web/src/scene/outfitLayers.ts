import type { EquippedItem } from '../api/types';

/** One head item (hats/headphones are exclusive); a reward mantle may overlay a top. */
export function outfitLayers(items: EquippedItem[], crown = false): EquippedItem[] {
  const result = new Map<string, EquippedItem>();
  for (const item of items) {
    if (!['head', 'face', 'torso', 'neck', 'bottoms', 'shoes'].includes(item.slot)) continue;
    result.set(item.item_id === 'champion_mantle' ? 'mantle' : item.slot, item);
  }
  if (crown) result.set('head', { item_id: 'weekly_crown', slot: 'head', asset_key: 'hat_crown' });
  return ['torso', 'neck', 'bottoms', 'shoes', 'mantle', 'face', 'head'].flatMap(slot => result.has(slot) ? [result.get(slot)!] : []);
}
