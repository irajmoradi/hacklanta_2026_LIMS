import { replaceSlot } from '../api/equipment';
import type { ItemColors, ShopItem, Villager } from '../api/types';

export const canTryOn = (item: ShopItem) => !['consumable', 'voice_style'].includes(item.slot);
export const previewsHouse = (item: ShopItem) => ['house', 'house_addon', 'decoration', 'farm_animal'].includes(item.slot);

/** Draft only: keep metadata, authored colors and every unrelated slot intact. */
export function tryOnPerson(person: Villager, item: ShopItem, colors?: ItemColors): Villager {
  if (!canTryOn(item) || item.slot === 'consumable') return person;
  const existing = person.equipped.find(entry => entry.item_id === item.id);
  const equipped = replaceSlot(person.equipped, {
    ...item, ...existing,
    item_id: item.id, slot: item.slot, colors: colors ?? item.colors ?? existing?.colors,
  });
  return {...person, equipped, equipped_ids: equipped.map(entry => entry.item_id)};
}
