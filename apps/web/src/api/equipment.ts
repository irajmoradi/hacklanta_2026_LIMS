import type { EquippedItem, ShopItem } from './types';

import { catalog as registry } from '../../../../packages/catalog/dist/catalog';

export const catalog: Omit<ShopItem, 'owned'>[] = registry.entries.filter(e => e.slot && e.tags?.some(t => ['shop', 'earn_only'].includes(t))).map(e => {
  const requiresItem = e.requires?.find(id => registry.entries.find(r => r.id === id)?.kind !== 'building') ?? null;
  const requiresBuilding = e.requires?.find(id => registry.entries.find(r => r.id === id)?.kind === 'building') ?? null;
  return {id:e.id, kind:e.kind, name:e.name, description:e.description, source:e.source, rarity:e.rarity, tint:e.tint,
    price_coins:e.price_coins, requires:requiresBuilding ?? requiresItem, requires_item:requiresItem, requires_building:requiresBuilding,
    asset_key:e.asset?.glb.split('/').pop()?.replace('.glb','') ?? null, slot:e.slot!,
    voice_style:e.kind === 'voice_style' ? e.id.replace('voice_','') as ShopItem['voice_style'] : null};
});

/** Replace only the chosen slot; never mutate another response or villager. */
export function replaceSlot(items: EquippedItem[], item: EquippedItem): EquippedItem[] {
  return [...items.filter(current => item.slot === 'farm_animal' ? current.item_id !== item.item_id : current.slot !== item.slot), { ...item }].sort((a, b) => a.item_id.localeCompare(b.item_id));
}
export function equipmentFor(id: string): EquippedItem {
  const item = catalog.find(item => item.id === id)!;
  if (item.slot === 'consumable') throw new Error('Consumables cannot be equipped');
  return { item_id: item.id, slot: item.slot, asset_key: item.asset_key, tint: item.tint, source: item.source, rarity: item.rarity, description: item.description };
}
