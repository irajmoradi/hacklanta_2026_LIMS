import { expect, test } from 'bun:test';
import { API, call, ok, owner, users, village, profile, shop, note, earn } from '../support/api';

test('membership: cross-village reads and writes return 403 without mutations', async () => {
  const a = await village('membership-A', [users[0]]);
  const b = await village('membership-B', [users[1]]);
  const before = await shop(b.id);
  for (const suffix of ['', '/feed', `/users/${owner}`, '/shop']) {
    expect((await call(`/villages/${b.id}${suffix}`, users[0])).status).toBe(403);
  }
  for (const [suffix, body] of [
    ['/goals', { title: 'Forbidden' }], ['/check-ins', note()],
    ['/shop/buy', { item_id: 'hat_cap' }], ['/mayor/pray', { text: 'Forbidden' }],
  ] as const) expect((await call(`/villages/${b.id}${suffix}`, users[0], body)).status).toBe(403);
  expect((await call(`/villages/${a.id}`, users[1])).status).toBe(403);
  expect(await shop(b.id)).toEqual(before);
  // Evidence ownership is exercised in the isolated ASGI suite; no live asset files.

});

test('shop: competing distinct purchases cannot overdraw the balance', async () => {
  const v = await village('shop-race');
  await ok(`/villages/${v.id}/goals`, owner, { title: 'QA race goal' });
  await ok(`/villages/${v.id}/check-ins`, owner, note());
  const before = await shop(v.id);
  const items = before.items.filter((i: any) => !i.requires && i.price_xp > 0 && i.price_xp <= before.balance).slice(0, 2);
  expect(items).toHaveLength(2);
  expect(items[0].price_xp + items[1].price_xp).toBeGreaterThan(before.balance);
  const results = await Promise.all(items.map((i: any) => call(`/villages/${v.id}/shop/buy`, owner, { item_id: i.id })));
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  const winner = items[results.findIndex(r => r.status === 200)];
  const after = await shop(v.id);
  expect(after.balance).toBe(before.balance - winner.price_xp);
  expect(after.items.filter((i: any) => i.owned)).toHaveLength(1);
});

test('retried and concurrent check-ins award XP once; daily cap persists', async () => {
  const v = await village('idempotency');
  const before = (await profile(v.id)).villager.xp;
  const body = note();
  const first = await ok(`/villages/${v.id}/check-ins`, owner, body);
  const retries = await Promise.all(Array.from({ length: 4 }, () => ok(`/villages/${v.id}/check-ins`, owner, body)));
  expect(first.xp_awarded).toBe(10);
  for (const retry of retries) {
    expect(retry.xp_awarded).toBe(0);
    expect(retry.check_in.id).toBe(first.check_in.id);
  }
  const p = await profile(v.id);
  expect(p.villager.xp).toBe(before + 10);
  expect(p.check_ins.filter((c: any) => c.id === first.check_in.id)).toHaveLength(1);
  expect((await ok(`/villages/${v.id}/check-ins`, owner, note('Second daily note'))).xp_awarded).toBe(0);
});

test('shop: concurrent duplicate purchase debits once; rejected purchases are atomic', async () => {
  const v = await village('shop');
  const initial = await shop(v.id);
  const item = initial.items.find((i: any) => !i.requires && i.price_xp > 0);
  expect(item).toBeDefined();
  expect((await call(`/villages/${v.id}/shop/buy`, owner, { item_id: item.id })).status).toBe(409);
  expect(await shop(v.id)).toEqual(initial);
  expect((await call(`/villages/${v.id}/shop/buy`, owner, { item_id: 'QA_unknown_item' })).status).toBe(404);
  expect(await shop(v.id)).toEqual(initial);
  const locked = initial.items.find((i: any) => i.requires);
  expect(locked).toBeDefined();
  expect((await call(`/villages/${v.id}/shop/buy`, owner, { item_id: locked.id })).status).toBe(409);
  expect(await shop(v.id)).toEqual(initial);
  await earn(v.id, item.price_xp);
  const before = await shop(v.id);
  const results = await Promise.all(Array.from({ length: 3 }, () => call(`/villages/${v.id}/shop/buy`, owner, { item_id: item.id })));
  expect(results.some(r => r.status === 200)).toBe(true);
  expect(results.every(r => [200, 409].includes(r.status))).toBe(true);
  const after = await shop(v.id);
  expect(after.balance).toBe(before.balance - item.price_xp);
  expect(after.items.filter((i: any) => i.id === item.id && i.owned)).toHaveLength(1);
});

const health = await ok('/health');
test.skipIf(health.gpu_worker !== 'down')('GPU worker down: real API browsing (skipped while worker up; no service stops)', async () => {
  expect(health.ok).toBe(true);
  const v = await village('gpu-offline');
  expect((await ok(`/villages/${v.id}`)).villagers.length).toBeGreaterThan(0);
});

test.skip('Mayor invalid JSON / unknown proposal items / reward bounds: no public injection hook; never induce paid invalid generations', () => {});
test.skip('retried GPU completion: no public completion test hook; no generation jobs submitted', () => {});
test.skip('independent animation/recoloring: stable UI exposes no recolor control or scene-state inspection hook', () => {});
