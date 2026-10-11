import { expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID as uid, DEMO_VILLAGE_ID as vid } from './fixtures';
import type { Profile, Shop } from './types';

test('mock recolors owned clothing only and retains palette across slot changes', async () => {
  const api = new MockApi(), root = `/villages/${vid}`, colors = {primary:'#AABBCC', accent:'#123456'};
  const save = (user = uid, item = 'outfit_hoodie', value = colors) => api.request('PATCH', `${root}/inventory/${item}/colors`, user, {colors:value});
  await expect(save()).rejects.toMatchObject({status:404});
  await api.request('POST', `${root}/shop/buy`, uid, {item_id:'outfit_hoodie'});
  await save();
  for (const action of ['unequip','equip']) await api.request('POST', `${root}/inventory/${action}`, uid, {item_id:'outfit_hoodie'});
  const profile = await api.request<Profile>('GET', `${root}/users/${uid}`, uid);
  expect(profile.villager.equipped.find(i => i.item_id === 'outfit_hoodie')?.colors).toEqual({primary:'#aabbcc',accent:'#123456'});
  const shop = await api.request<Shop>('GET', root + '/shop', uid);
  expect(shop.items.find(i => i.id === 'outfit_hoodie')?.colors).toEqual({primary:'#aabbcc',accent:'#123456'});
  await expect(save(uid.slice(0,-1)+'2')).rejects.toMatchObject({status:404});
  await expect(save(uid, 'voice_hype_coach')).rejects.toMatchObject({status:404});
  await expect(save(uid,'outfit_hoodie',{primary:'red',accent:'#123456'})).rejects.toMatchObject({status:422});
});
