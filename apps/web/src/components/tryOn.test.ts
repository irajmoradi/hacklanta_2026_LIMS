import { expect, test } from 'bun:test';
import { MockApi } from '../api/mock';
import { DEMO_USER_ID as uid, DEMO_VILLAGE_ID as vid } from '../api/fixtures';
import type { Profile, Shop } from '../api/types';
import { canTryOn, previewsHouse, tryOnPerson } from './tryOn';

test('preview replaces only its slot, keeps colors and metadata, and never mutates the source', async () => {
  const api = new MockApi();
  const {villager} = await api.request<Profile>('GET', `/villages/${vid}/users/${uid}`, uid);
  const shop = await api.request<Shop>('GET', `/villages/${vid}/shop`, uid);
  const before = structuredClone(villager);
  const item = shop.items.find(i=>i.id==='hat_beanie')!;
  const preview = tryOnPerson(villager, item, {primary:'#689b68'});
  expect(preview.equipped.filter(i=>i.slot==='head')).toHaveLength(1);
  expect(preview.equipped.find(i=>i.item_id===item.id)).toMatchObject({colors:{primary:'#689b68'}, asset_key:item.asset_key, rarity:item.rarity});
  expect(preview.equipped.filter(i=>i.slot!=='head')).toEqual(villager.equipped.filter(i=>i.slot!=='head').sort((a,b)=>a.item_id.localeCompare(b.item_id)));
  expect(preview.equipped_ids).toEqual(preview.equipped.map(i=>i.item_id));
  expect(villager).toEqual(before);
  expect((await api.request<Shop>('GET', `/villages/${vid}/shop`, uid)).balance).toBe(shop.balance);
  const authored = tryOnPerson(villager, {...item, colors:{primary:'#557ca7'}});
  expect(authored.equipped.find(i=>i.item_id===item.id)?.colors).toEqual({primary:'#557ca7'});
  for (const slot of ['pet','house_addon','farm_animal'] as const) {
    const candidate = shop.items.find(i=>i.slot===slot)!;
    const next = tryOnPerson(villager, candidate);
    expect(next.equipped_ids).toContain(candidate.id);
    expect(next.equipped.filter(i=>i.slot!==slot)).toEqual(villager.equipped.filter(i=>i.slot!==slot).sort((a,b)=>a.item_id.localeCompare(b.item_id)));
    expect(previewsHouse(candidate)).toBe(slot!=='pet');
  }
  const coloredOwner = {...villager, equipped:preview.equipped};
  expect(tryOnPerson(coloredOwner, item).equipped.find(i=>i.item_id===item.id)?.colors).toEqual({primary:'#689b68'});
  const animals = shop.items.filter(i=>i.slot==='farm_animal').slice(0,2);
  const farm = tryOnPerson(tryOnPerson(villager, animals[0]), animals[1]);
  expect(farm.equipped.filter(i=>i.slot==='farm_animal')).toHaveLength(2);
  expect(tryOnPerson(farm, animals[0]).equipped.filter(i=>i.slot==='farm_animal')).toHaveLength(2);
  const consumable = shop.items.find(i=>i.slot==='consumable')!;
  expect(canTryOn(consumable)).toBe(false);
  expect(tryOnPerson(villager, consumable)).toBe(villager);
  expect(canTryOn(shop.items.find(i=>i.slot==='voice_style')!)).toBe(false);
});
