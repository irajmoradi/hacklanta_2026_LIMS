import { expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID, DEMO_VILLAGE_ID, makeFixtures } from './fixtures';
import type { GazetteIssue, MayorMemory } from './gazette';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { EventTerms } from '../components/EventTerms';
import { SolanaPot } from '../components/SolanaPot';
import type { Competition } from './types';

const base = `/villages/${DEMO_VILLAGE_ID}`;
test('Gazette latest and archive agree, profile links resolve, and responses are isolated', async () => {
  const api = new MockApi();
  const issue = await api.request<GazetteIssue>('GET', `${base}/gazette/latest`, DEMO_USER_ID);
  const archive = await api.request<GazetteIssue[]>('GET', `${base}/gazette?limit=2`, DEMO_USER_ID);
  expect(archive).toHaveLength(2); expect(archive[0].id).toBe(issue.id);
  expect(issue.stories.length).toBeGreaterThanOrEqual(3); expect(issue.stories.length).toBeLessThanOrEqual(5);
  expect(issue.model).toBe('scripted-demo');
  for (const story of issue.stories) for (const id of story.user_ids) expect(makeFixtures().village.villagers.some(v => v.user_id === id)).toBe(true);
  issue.stories.length = 0;
  expect((await api.request<GazetteIssue>('GET', `${base}/gazette/latest`, DEMO_USER_ID)).stories).toHaveLength(5);
});
test('memory has village and villager timestamps; read endpoints enforce membership', async () => {
  const api = new MockApi();
  const memory = await api.request<MayorMemory>('GET', `${base}/mayor/memory`, DEMO_USER_ID);
  expect(memory.entries.some(e => e.user_id === null)).toBe(true);
  expect(memory.entries.filter(e => e.user_id)).toHaveLength(5);
  expect(memory.entries.every(e => Number.isFinite(Date.parse(e.updated_at)))).toBe(true);
  const created = await api.request<{ village: { id: string } }>('POST', '/villages', DEMO_USER_ID, { name: 'Private' });
  for (const path of ['gazette/latest', 'gazette?limit=14', 'mayor/memory']) await expect(api.request('GET', `/villages/${created.village.id}/${path}`, DEMO_USER_ID.slice(0, -1) + '2')).rejects.toMatchObject({ status: 403 });
});
test('challenge terms preserve solo/pair/group, zero effort and recovery; legacy events are honest', () => {
  const event = makeFixtures().village.active_events[0];
  for (const tier of ['solo', 'pair', 'group'] as const) {
    const html = renderToStaticMarkup(createElement(EventTerms, { event: { ...event, tier, effort_hours: 0 } }));
    expect(html).toContain(tier); expect(html).toContain('0 hours'); expect(html).toContain('30–60 XP'); expect(html).toContain('clear the fog');
  }
  const legacy = renderToStaticMarkup(createElement(EventTerms, { event: { ...event, tier: undefined, effort_hours: undefined, reward_xp_min: 100, reward_xp_max: 100 } }));
  expect(legacy).not.toContain('Not supplied');
  expect(legacy).not.toContain('<dt>Tier</dt>');
  expect(legacy).not.toContain('<dt>Effort</dt>');
  expect(legacy).toContain('100 XP');
  expect(legacy).not.toContain('100–100');
});
test('SOL entry gating covers both flags, friendly, zero and settled competitions', () => {
  const competition: Competition = { id: 'c', creator_id: 'u', title: 'Sprint', terms: 'Run', friendly: false, entry_lamports: 1000, status: 'open', result: null };
  const render = (extra: Partial<Competition> = {}, vid?: string) => renderToStaticMarkup(createElement(SolanaPot, { vid, competition: { ...competition, ...extra } }));
  expect(render()).toContain('Creator must create and confirm the devnet pot');
  expect(render()).toContain('DEVNET');
  expect(render({ pot_address: 'pot' } as Partial<Competition>, 'v')).toContain('Join pot with wallet');
  expect(render({ pot_address: 'pot', status: 'settled' } as Partial<Competition>, 'v')).not.toContain('Join pot with wallet');
  expect(render({ friendly: true })).toBe(''); expect(render({ entry_lamports: 0 })).toBe('');
});


import { normalizeGazetteCopy } from './gazetteCopy';
test('QA15-04 repairs old prose and roster names without altering links or mixed casing', () => {
  const raw = "hello everyone.iraj is powering ahead with mckenzie!welcome. It's sunny. https://iraj.dev/a.b 3.14 U.S.";
  const result = normalizeGazetteCopy(raw, ['iraj','McKenzie']);
  expect(result).toBe("Hello everyone. Iraj is powering ahead with McKenzie! Welcome. It's sunny. https://iraj.dev/a.b 3.14 U.S.");
  expect(normalizeGazetteCopy(result, ['iraj','McKenzie'])).toBe(result);
  expect(normalizeGazetteCopy('Pair a+b with irajson and iraj.', ['A+B','iraj'])).toBe('Pair A+B with irajson and Iraj.');
});
