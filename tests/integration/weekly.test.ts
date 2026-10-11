import { expect, test } from 'bun:test';
import { call, ok, owner, users, village, profile } from '../support/api';

test('live weekly auditor, human grades, repeated finalize: one crown and one XP award', async () => {
  const v = await village('weekly', users.slice(0, 4));
  const base = `/villages/${v.id}`;
  const week = await ok(`${base}/weekly/current`);
  expect(users).toContain(week.auditor_id);
  const participant = users.find(u => u !== week.auditor_id)!;
  const goal = await ok(`${base}/goals`, participant, { title: 'QA finish one synthetic task' });
  const path = `${base}/weekly/${week.week_start}`;
  const grade = { ambition: 4, evidence_quality: 4, progress: 5, completed: true, rationale: 'QA human verified task' };
  expect((await call(`${path}/goals/${goal.id}/grade`, participant, grade)).status).toBe(403);
  expect((await call(`${path}/finalize`, week.auditor_id, {})).status).toBe(409);
  await ok(`${path}/goals/${goal.id}/grade`, week.auditor_id, grade);
  const before = (await profile(v.id, participant)).villager.xp;
  const results = await Promise.all(Array.from({ length: 3 }, () => ok(`${path}/finalize`, week.auditor_id, {})));
  for (const result of results) {
    expect(result.winner_id).toBe(participant);
    expect(result.stars).toEqual([participant]);
  }
  expect((await profile(v.id, participant)).villager.xp).toBe(before + 100);
  expect((await ok(base)).villagers.filter((u: any) => u.has_crown).map((u: any) => u.user_id)).toEqual([participant]);
});

test('live weekly, competition and agent-log reject unrelated QA member', async () => {
  const v = await village('new-route-isolation');
  const base = `/villages/${v.id}`;
  const outsider = users[2];
  for (const suffix of ['/weekly/current', '/competitions', '/agent-log']) {
    expect((await call(base + suffix, outsider)).status).toBe(403);
  }
  expect((await call(base + '/competitions', outsider, {
    title: 'Forbidden', terms: 'No entry', friendly: true,
  })).status).toBe(403);
});
