import { expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID as user, DEMO_VILLAGE_ID as vid } from './fixtures';
import type { Profile, Shop } from './types';

test('mock purchase and photo token spend coins while check-in grants both exactly once', async () => {
  const api = new MockApi(), base = `/villages/${vid}`;
  const profile = () => api.request<Profile>('GET', `${base}/users/${user}`, user);
  const before = (await profile()).villager;
  const shop = await api.request<Shop>('GET', `${base}/shop`, user);
  for (const item_id of ['hat_cap', 'photo_token']) {
    await api.request('POST', `${base}/shop/buy`, user, { item_id });
  }
  const spent = ['hat_cap', 'photo_token'].reduce((n, id) => n + shop.items.find(i => i.id === id)!.price_coins, 0);
  const bought = (await profile()).villager;
  expect(bought.xp).toBe(before.xp);
  expect(bought.level).toBe(before.level);
  expect(bought.coins).toBe(before.coins - spent);
  const input = { goal_id: (await profile()).goal!.id, kind: 'progress', body: 'Done', idempotency_key: 'coin-award' };
  await api.request('POST', `${base}/check-ins`, user, input);
  await api.request('POST', `${base}/check-ins`, user, input);
  const earned = (await profile()).villager;
  expect(earned.coins).toBe(bought.coins + 25);
  expect(earned.xp).toBe(bought.xp + 25);
});

test('mock coins debug is replay safe and bribes preserve XP', async () => {
  const api = new MockApi(), base = `/villages/${vid}`;
  const body = { amount: 500, idempotency_key: 'coins-debug', reason: 'test' };
  for (let i = 0; i < 2; i++) await api.request('POST', '/demo/debug/coins', user, body);
  await api.request('POST', `${base}/mayor/bribe`, user, { currency: 'coins', coins: 50, wish: 'Picnic' });
  const { villager } = await api.request<Profile>('GET', `${base}/users/${user}`, user);
  expect(villager.coins).toBe(870);
  expect(villager.xp).toBe(420);
  await expect(api.request('POST', `${base}/mayor/bribe`, user, { currency: 'sol_intent', wish: 'No' })).rejects.toMatchObject({ status: 422 });
});
