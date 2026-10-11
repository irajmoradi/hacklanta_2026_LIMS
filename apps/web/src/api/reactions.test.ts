import { expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID, DEMO_VILLAGE_ID } from './fixtures';
import { reactionPalette, toggleReaction, type Accomplishment, type Reaction } from './reactions';
import type { Competition, FeedItem, Profile, Village, WeekState } from './types';

const base = `/villages/${DEMO_VILLAGE_ID}`;
test('optimistic toggle preserves others and removes zero counts', () => {
  const before: Reaction[] = [{emoji: '🎉', count: 2, mine: false}, {emoji: '🔥', count: 1, mine: true}];
  expect(toggleReaction(before, '🎉')).toContainEqual({emoji: '🎉', count: 3, mine: true});
  expect(toggleReaction(before, '🔥')).toEqual([before[0]]);
  expect(before).toHaveLength(2);
});

test('completion is idempotent; wall, profile and multi-user reactions agree', async () => {
  const mock = new MockApi();
  const request = <T,>(method: string, path: string, input?: unknown, user = DEMO_USER_ID) => mock.request<T>(method, base + path, user, input);
  const p = await request<Profile>('GET', '/users/' + DEMO_USER_ID);
  for (let i = 0; i < 3; i++) await request('POST', `/goals/${p.goal!.id}/status`, {status: 'done'});
  const feed = await request<FeedItem[]>('GET', '/feed');
  expect(feed.filter(f => f.type === 'goal_completed')).toHaveLength(1);
  const body = {target_kind: 'goal', target_id: p.goal!.id, emoji: '🎉'};
  for (let i = 0; i < 3; i++) expect(await request<Reaction[]>('POST', '/reactions', body)).toEqual([{emoji: '🎉', count: 1, mine: true}]);
  const friend = (await request<Village>('GET', '')).villagers[1].user_id;
  await request('POST', '/reactions', body, friend);
  expect((await request<Profile>('GET', '/users/' + DEMO_USER_ID)).goal!.reactions).toEqual([{emoji: '🎉', count: 2, mine: true}]);
  const wall = await request<Accomplishment[]>('GET', '/accomplishments');
  expect(wall.find(a => a.target_id === p.goal!.id)?.reactions).toEqual([{emoji: '🎉', count: 2, mine: true}]);
  for (let i = 0; i < 2; i++) expect(await request<Reaction[]>('DELETE', '/reactions', body)).toEqual([{emoji: '🎉', count: 1, mine: false}]);
  expect(await request<Accomplishment[]>('GET', '/accomplishments?limit=1')).toHaveLength(1);
  await expect(request('GET', '/accomplishments?limit=0')).rejects.toMatchObject({status: 422});
  await expect(request('POST', '/reactions', {...body, emoji: 'bad'})).rejects.toMatchObject({status: 422});
  await expect(request('POST', '/reactions', {...body, target_id: 'absent'})).rejects.toMatchObject({status: 404});
  await expect(request('POST', '/reactions', body, 'outsider')).rejects.toMatchObject({status: 401});
  const other = await mock.request<{village: {id: string}}>('POST', '/villages', DEMO_USER_ID, {name: 'Private village'});
  await expect(mock.request('POST', `/villages/${other.village.id}/reactions`, friend, body)).rejects.toMatchObject({status: 403});
  for (const emoji of reactionPalette) await request('POST', '/reactions', {...body, emoji});
});

test('feed/check-in reactions and past goals work independently', async () => {
  const mock = new MockApi();
  const p = await mock.request<Profile>('GET', base + '/users/' + DEMO_USER_ID, DEMO_USER_ID);
  const feed = await mock.request<FeedItem[]>('GET', base + '/feed', DEMO_USER_ID);
  for (const [target_kind, target_id] of [['activity', feed[0].id], ['check_in', p.check_ins[0].id], ['goal', p.past_goals[0].id]]) {
    expect(await mock.request<Reaction[]>('POST', base + '/reactions', DEMO_USER_ID, {target_kind, target_id, emoji: '👏'})).toEqual([{emoji: '👏', count: 1, mine: true}]);
  }
  const after = await mock.request<Profile>('GET', base + '/users/' + DEMO_USER_ID, DEMO_USER_ID);
  expect(after.past_goals[0].reactions).toEqual([{emoji: '👏', count: 1, mine: true}]);
  expect((await mock.request<FeedItem[]>('GET', base + '/feed', DEMO_USER_ID))[0].reactions).toEqual([{emoji: '👏', count: 1, mine: true}]);
});

test('mock competition wins, badges and level-ups reach the wall once', async () => {
  const mock = new MockApi();
  const request = <T,>(method: string, path: string, input?: unknown, user = DEMO_USER_ID) => mock.request<T>(method, base + path, user, input);
  const c = await request<Competition>('POST', '/competitions', {title: 'Walk together', terms: 'Go outdoors', friendly: true});
  const path = `/competitions/${c.id}`;
  await request('POST', path + '/join');
  await request('POST', path + '/entries', {body: 'Walked today', idempotency_key: 'walk'});
  await request('POST', path + '/settle'); await request('POST', path + '/settle');
  const self = await request<Profile>('GET', '/users/' + DEMO_USER_ID);
  const remaining = self.villager.level ** 2 * 50 - self.villager.xp;
  for (let i = 0; i < Math.ceil(remaining / 25); i++) await request('POST', '/check-ins', {kind: 'progress', goal_id: self.goal!.id, body: 'Made progress', idempotency_key: `level-${i}`});
  const week = await request<WeekState>('GET', '/weekly/current');
  const eligible = week.goals.filter(g => !g.excluded);
  for (const g of eligible) await request('POST', `/weekly/${week.week_start}/goals/${g.id}/grade`, {ambition: 5, evidence_quality: 5, progress: 5, completed: true, rationale: 'Verified'}, week.auditor_id!);
  await request('POST', `/weekly/${week.week_start}/finalize`, {}, week.auditor_id!);
  await request('POST', `/weekly/${week.week_start}/finalize`, {}, week.auditor_id!);
  const wall = await request<Accomplishment[]>('GET', '/accomplishments');
  expect(wall.filter(a => a.type === 'competition_won')).toHaveLength(1);
  expect(wall.filter(a => a.type === 'badge_earned')).toHaveLength(eligible.length);
  expect(wall.some(a => a.type === 'level_up')).toBe(true);
  const win = wall.find(a => a.type === 'competition_won')!;
  expect(await request<Reaction[]>('POST', '/reactions', {target_kind: win.target_kind, target_id: win.target_id, emoji: '👑'})).toEqual([{emoji: '👑', count: 1, mine: true}]);
});
