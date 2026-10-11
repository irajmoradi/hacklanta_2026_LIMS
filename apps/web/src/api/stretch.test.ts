import { expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID, DEMO_VILLAGE_ID } from './fixtures';
import type { Goal, Profile, CheckInResult } from './types';

test('stretch mock preserves base goal, targets progress, caps and rewards once', async () => {
  const mock = new MockApi(), root = `/villages/${DEMO_VILLAGE_ID}`;
  const post = <T,>(path: string, data: unknown) => mock.request<T>('POST', root + path, DEMO_USER_ID, data);
  const profile = () => mock.request<Profile>('GET', root + `/users/${DEMO_USER_ID}`, DEMO_USER_ID);
  const before = await profile(), gid = before.goal!.id, path = `/goals/${gid}`;
  await post(path + '/status', {status: 'done'});
  for (let tier = 1; tier <= 3; tier++) {
    const start = await post<Goal>(path + '/stretch', {title: `Target ${tier}`});
    expect(start.status).toBe('stretch'); expect(start.stretches).toHaveLength(tier);
    const duplicate = await post<Goal>(path + '/stretch', {title: `Target ${tier}`});
    expect(duplicate.stretches).toHaveLength(tier);
    await expect(post('/check-ins', {kind: 'progress', body: 'More work', goal_id: gid, idempotency_key: `bad${tier}`})).rejects.toThrow();
    const check = await post<CheckInResult>('/check-ins', {kind: 'progress', body: 'More work', goal_id: gid, stretch_tier: tier, idempotency_key: `ok${tier}`});
    expect(check.check_in.stretch_tier).toBe(tier);
    await post(path + `/stretch/${tier}/status`, {status: 'done'});
    await post(path + `/stretch/${tier}/status`, {status: 'done'});
  }
  await expect(post(path + '/stretch', {})).rejects.toThrow();
  const after = await profile();
  expect(after.goal!.title).toBe(before.goal!.title);
  expect(after.villager.xp - before.villager.xp).toBe(105);
  expect(after.villager.coins - before.villager.coins).toBe(105);
});
