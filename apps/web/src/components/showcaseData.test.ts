import { expect, test } from 'bun:test';
import { leftSlots, rightSlots, slotItems, sourceLabel, itemDetails } from './showcaseData';
import { equipmentFor, catalog } from '../api/equipment';
import { MockApi } from '../api/mock';
import { DEMO_USER_ID, DEMO_VILLAGE_ID } from '../api/fixtures';

test('slots preserve multiple photo items and isolate house, neck and voice', () => {
  const items = [equipmentFor('scarf'), equipmentFor('house_backyard'), equipmentFor('voice_pirate'), {item_id:'photo',slot:'torso' as const,asset_key:null,custom:true}, equipmentFor('jacket_denim')];
  expect(leftSlots).toEqual(['head','face','torso','neck']);
  expect(rightSlots).toEqual(['pet','voice_style','house','decoration']);
  expect(slotItems(items,'torso').map(i => i.item_id)).toEqual(['photo','jacket_denim']);
  expect(slotItems(items,'neck').map(i => i.item_id)).toEqual(['scarf']);
  expect(itemDetails(items[3]).source).toBe('Photo creation');
});
test('sources distinguish earned, event and purchasable zero-price items', () => {
  expect(sourceLabel('shop',300)).toBe('Shop · 300 coins');
  expect(sourceLabel('event:spooky_night')).toBe('Event: spooky night');
  expect(sourceLabel('earned:weekly_crown')).toBe('Earned: Weekly crown');
  expect(itemDetails(equipmentFor('champion_mantle')).rarity).toBe('legendary');
});
test('mock shop cannot buy any gated item for zero coins', async () => {
  const api = new MockApi();
  const gated = catalog.filter(i => i.source !== 'shop');
  expect(gated.filter(i => i.source?.startsWith('earned:'))).toHaveLength(7);
  for (const item of gated) await expect(api.request('POST', `/villages/${DEMO_VILLAGE_ID}/shop/buy`, DEMO_USER_ID, {item_id:item.id})).rejects.toMatchObject({status:409});
});
