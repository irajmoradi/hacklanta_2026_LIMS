import { expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID as uid, DEMO_VILLAGE_ID as vid } from './fixtures';
import type { Equipment, Profile, Shop, VillageRecord } from './types';
const root = `/villages/${vid}`;

test('equipment replaces one slot, retains ownership, and isolates user and village inventory', async () => {
  const api = new MockApi(), other = uid.slice(0, -1) + '2';
  const post = (path: string, item_id: string) => api.request<Equipment>('POST', root + path, uid, {item_id});
  const neighbor = await api.request<Profile>('GET', `${root}/users/${other}`, uid);
  await post('/shop/buy', 'hat_cap');
  const after = await post('/inventory/equip', 'hat_headphones');
  expect(after.equipped_ids).toContain('hat_headphones'); expect(after.equipped_ids).not.toContain('hat_cap');
  expect(after.equipped_ids).toContain('glasses_round'); expect(after.equipped_ids).toContain('voice_hype_coach');
  expect(after.equipped.filter(i => i.slot === 'head')).toHaveLength(1);
  await post('/inventory/unequip', 'hat_headphones');
  await post('/inventory/unequip', 'hat_headphones');
  const shop = await api.request<Shop>('GET', root + '/shop', uid);
  expect(shop.balance).toBe(395); expect(shop.items.find(i => i.id === 'hat_headphones')?.owned).toBe(true);
  expect(shop.items.find(i => i.id === 'hat_cap')?.owned).toBe(true);
  expect(await api.request<Profile>('GET', `${root}/users/${other}`, uid)).toEqual(neighbor);
  await expect(post('/inventory/equip', 'scarf')).rejects.toMatchObject({status:404});
  const {village} = await api.request<{village: VillageRecord}>('POST', '/villages', uid, {name:'Second crew'});
  await api.request('POST', `/villages/${village.id}/shop/buy`, uid, {item_id:'hat_headphones'});
  await api.request('POST', `/villages/${village.id}/inventory/equip`, uid, {item_id:'hat_headphones'});
  const first = await api.request<Profile>('GET', `${root}/users/${uid}`, uid);
  expect(first.villager.equipped_ids).not.toContain('hat_headphones');
});

test('pets require both owned backyard and shelter; voice styles replace only voice slot', async () => {
  const api = new MockApi();
  await expect(api.request('POST', root + '/shop/buy', uid, {item_id:'pet_dog'})).rejects.toMatchObject({status:409});
  await api.request('POST', root + '/shop/buy', uid, {item_id:'house_backyard'});
  await api.request('POST', root + '/inventory/equip', uid, {item_id:'house_lv2'});
  await api.request('POST', root + '/shop/buy', uid, {item_id:'pet_dog_b'});
  await api.request('POST', root + '/shop/buy', uid, {item_id:'voice_pirate'});
  const person = (await api.request<Profile>('GET', `${root}/users/${uid}`, uid)).villager;
  expect(person.equipped_ids).toContain('pet_dog_b'); expect(person.equipped_ids).toContain('voice_pirate');
  expect(person.equipped_ids).not.toContain('voice_hype_coach'); expect(person.equipped_ids).toContain('hat_headphones');
  const {village} = await api.request<{village: VillageRecord}>('POST', '/villages', uid, {name:'No shelter yet'});
  // Buy the backyard in this village too; its one member has not unlocked the shelter.
  await api.request('POST', `/villages/${village.id}/shop/buy`, uid, {item_id:'house_backyard'});
  await expect(api.request('POST', `/villages/${village.id}/inventory/equip`, uid, {item_id:'pet_dog_b'})).rejects.toMatchObject({status:409});
});
