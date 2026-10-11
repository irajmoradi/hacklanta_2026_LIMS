import type { EquippedItem, EquipmentSlot } from '../api/types';
import { entriesById } from '../../../../packages/catalog/dist/catalog';

export const leftSlots: EquipmentSlot[] = ['head', 'face', 'torso', 'neck'];
export const rightSlots: EquipmentSlot[] = ['pet', 'voice_style', 'house', 'decoration'];
export const slotLabels: Record<EquipmentSlot, string> = {farm_animal:'Farm animals', house_addon:'House add-ons', head:'Head / hat', face:'Face / glasses', torso:'Top / jacket', neck:'Neck / scarf', pet:'Pet', voice_style:'Voice style', house:'House', decoration:'Photo items / extra'};
export const slotItems = (items: EquippedItem[], slot: EquipmentSlot) => items.filter(i => i.slot === slot);
export function sourceLabel(source = 'shop', price = 0) {
  if (source === 'shop') return `Shop · ${price} coins`;
  const [kind, rule] = source.split(':');
  if (!rule) return source;
  const names: Record<string, string> = {weekly_crown:'Weekly crown', perfect_week:'Perfect week', streak_28:'28-day streak', auditor:'Audit completion', festival_vip:'Festival VIP', mayor_event:'Mayor event', competition_win:'Competition win'};
  return `${kind === 'event' ? 'Event' : 'Earned'}: ${names[rule] ?? rule.replaceAll('_', ' ')}`;
}
export function itemDetails(item: EquippedItem) {
  const entry = entriesById.get(item.item_id);
  return {
    name: item.name ?? entry?.name ?? (item.custom ? 'Custom photo item' : item.item_id.replaceAll('_', ' ')),
    description: item.description ?? entry?.description ?? (item.custom ? 'A personal item made from a photo.' : 'An item from this villager’s collection.'),
    rarity: item.rarity ?? entry?.rarity ?? 'common',
    source: item.custom ? 'Photo creation' : sourceLabel(item.source ?? entry?.source, entry?.price_coins),
  };
}
