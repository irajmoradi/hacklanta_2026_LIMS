import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MayorSceneDashboard } from '../src/components/MayorSceneDashboard';
import { makeFixtures } from '../src/api/fixtures';
import type { Village, WeekState, WeekGoal } from '../src/api/types';
const village: Village = { id: 'test', name: 'Our village', seed: 1, villagers: [], active_events: [] };
const goal = (id: string, status: WeekGoal['status'], excluded = false, completed = false): WeekGoal => ({ id, user_id: id, week_start: '2026-10-05', title: id, detail: null, status, excluded, suggestion: null, grade: { completed, ambition: 1, evidence_quality: 1, progress: 1, rationale: '' } });
const week = (goals: WeekGoal[]): WeekState => ({ id: 'week', village_id: 'test', week_start: '2026-10-05', auditor_id: null, generation: 1, status: 'open', winner_id: null, finalized_at: null, votes: 0, stars: [], goals });
test('dashboard counts completed or graded goals once and excludes auditor goals', () => {
  const html = renderToStaticMarkup(<MayorSceneDashboard village={village} week={week([goal('done', 'done', false, true), goal('graded', 'active', false, true), goal('active', 'active'), goal('auditor', 'done', true)])}/>);
  expect(html).toContain('2 of 3 weekly goals completed');
  expect(html).toContain('66.66666666666666%');
});
test('unavailable and empty progress are distinct, without fictional metrics', () => {
  const unavailable = renderToStaticMarkup(<MayorSceneDashboard village={village} week={null}/>);
  const empty = renderToStaticMarkup(<MayorSceneDashboard village={village} week={week([])}/>);
  expect(unavailable).toContain('Weekly progress unavailable');
  expect(empty).toContain('0 of 0 weekly goals completed');
  expect(empty).not.toContain('NaN');
  expect(empty).toContain('No active challenges');
});
test('repair dashboard uses server counts and targets', () => {
  const world = { disaster: { kind: 'blight', title: 'Repair', body: 'Help the garden.', started_at: '', deadline: '', repair_event_id: 'repair', target_checkins: 6, target_people: 3, checkins: 2, people: 1, closed_building: null, pets_away: false }, level: 1, xp: 0, next_level_xp: 100, unlocked: [], upcoming: [], weather: 'sunny' } as const;
  const html = renderToStaticMarkup(<MayorSceneDashboard village={{ ...village, world: { ...world, unlocked: [], upcoming: [] } }} week={null}/>);
  expect(html).toContain('Rebuilding together');
  expect(html).toContain('max="6" value="2"');
  expect(html).toContain('max="3" value="1"');
});
test('leader bars rank XP without mutating village order, with fixture portrait fallbacks', () => {
  const fixture = makeFixtures().village;
  const before = fixture.villagers.map(person => person.user_id);
  const html = renderToStaticMarkup(<MayorSceneDashboard village={fixture} week={null}/>);
  const leaderboard = html.slice(html.indexOf('Village XP leaders'));
  expect(leaderboard.indexOf('Stefanny')).toBeLessThan(leaderboard.indexOf('Iraj'));
  expect(leaderboard.indexOf('Iraj')).toBeLessThan(leaderboard.indexOf('Maya'));
  expect(html).toContain('7 days');
  expect(html).toContain('data-portrait-kind="initials"');
  expect(fixture.villagers.map(person => person.user_id)).toEqual(before);
});


// Updates retain the dashboard's visibility policy after moving into the Mayor.
import { MayorUpdates } from '../src/components/MayorUpdates';
import type { FeedItem } from '../src/api/types';
test('Mayor updates retain public history and filter private/debug noise', () => {
  const note = (id: string, text: string, type = 'notice', user_id: string | null = null): FeedItem => ({ id, text, type, user_id, created_at: '2026-10-11T12:00:00Z', payload: {} });
  const html = renderToStaticMarkup(<MayorUpdates village={village} feed={[
    note('mayor', '[AI Mayor] Welcome neighbors'), note('system', 'Village festival'),
    note('person', 'Personal checkin', 'checkin', 'person'), note('debug', 'Debug action', 'debug'),
    note('qa', 'QA-private'), note('agent', 'Internal decision', 'agent_decision'),
    note('scheduler', '[AI Scheduler] none: nothing due'),
  ]}/>);
  expect(html).toContain('Welcome neighbors');
  expect(html).toContain('Village festival');
  for (const hidden of ['Personal checkin', 'Debug action', 'QA-private', 'Internal decision', 'nothing due']) expect(html).not.toContain(hidden);
  expect(renderToStaticMarkup(<MayorUpdates village={village} feed={[]}/>)).toContain('No Mayor notes yet');
});
