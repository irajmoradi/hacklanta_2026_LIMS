import type { Shop, ShopItem, VillageWorld } from './types';
import { buildings } from './world';
import { sourceLabel } from '../components/showcaseData';

export const shopLabel = (id: string) => id.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
/** Legacy requires can name a building or an item; explicit fields disambiguate it. */
export function itemState(item: ShopItem, shop: Shop, world?: VillageWorld) {
  const owns = (id: string) => shop.items.some(i => i.id === id && i.owned) || !!shop.inventory?.some(i => (typeof i === 'string' ? i : i.item_id) === id);
  const unlocked = new Set((shop.unlocks ?? buildings(world)).map(b => typeof b === 'string' ? b : b.id));
  const itemIds = new Set(item.requires_item ? [item.requires_item] : []);
  const buildingIds = new Set(item.requires_building ? [item.requires_building] : []);
  for (const id of Array.isArray(item.requires) ? item.requires : item.requires ? [item.requires] : []) {
    if (buildingIds.has(id) || itemIds.has(id)) continue;
    if (shop.items.some(i => i.id === id) || id.startsWith('house_')) itemIds.add(id);
    else buildingIds.add(id);
  }
  const prerequisites = [...itemIds].filter(id => !owns(id));
  const requirements = prerequisites.map(id => {
    const required = shop.items.find(i => i.id === id);
    return `Needs ${required?.name ?? shopLabel(id)}${required ? ` (${required.price_coins} coins)` : ''} first`;
  });
  for (const id of buildingIds) if (!unlocked.has(id)) requirements.push(`Unlocks when the village builds the ${shopLabel(id)}`);
  const owned = item.owned || owns(item.id);
  const reasons = [...requirements];
  if (item.source && item.source !== 'shop') reasons.push(sourceLabel(item.source));
  if (shop.balance < item.price_coins) reasons.push(`Need ${item.price_coins - shop.balance} more coins`);
  return { state: owned ? 'owned' : reasons.length ? 'locked' : 'buyable', reasons: owned ? [] : reasons, requirements, prerequisites } as const;
}
