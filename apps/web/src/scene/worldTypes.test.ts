import { expect, test } from 'bun:test';
import { activityTarget, housePlot, ISLAND_RADIUS, isNight, isUnlocked, readWorld, townLayout, worldHour } from './worldTypes';
import type { Village } from '../api/types';

test('seeded districts and member plots are stable, distinct and inside the expanded island', () => {
  expect(townLayout(1337)).toEqual(townLayout(1337));
  expect(townLayout(1337)).not.toEqual(townLayout(1338));
  expect(ISLAND_RADIUS ** 2 / 13 ** 2).toBeCloseTo(2.5, 1);
  for (let seed = 1; seed <= 30; seed++) {
    const layout = townLayout(seed);
    for (const p of [layout.park, layout.festival, layout.lake, layout.shelter]) expect(Math.hypot(...p)).toBeLessThan(ISLAND_RADIUS - 4);
    const plots = Array.from({length: 9}, (_, slot) => housePlot(slot, seed));
    for (let i = 0; i < plots.length; i++) {
      expect(Math.hypot(...plots[i])).toBeLessThan(ISLAND_RADIUS - 3);
      for (let j = i + 1; j < plots.length; j++) expect(Math.hypot(plots[i][0] - plots[j][0], plots[i][1] - plots[j][1])).toBeGreaterThan(3.8);
    }
  }
});
test('unlock gating is explicit, defensive and independent of level', () => {
  expect(isUnlocked({}, 'pet_shelter')).toBe(false);
  expect(isUnlocked({level: 99, unlocked: ['well']}, 'pet_shelter')).toBe(false);
  expect(isUnlocked({unlocked: ['pet_shelter']}, 'pet_shelter')).toBe(true);
  expect(readWorld({world: {unlocked: 'pet_shelter'}} as unknown as Village).unlocked).toEqual([]);
  expect(readWorld({} as Village).unlocked).toEqual([]);
});
test('time overrides and local-time fallback drive night correctly', () => {
  expect(worldHour({time_of_day: 'toString'}, 11)).toBe(11);
  expect(worldHour({}, 13.5)).toBe(13.5);
  expect(worldHour({time_of_day: '21:30'})).toBe(21.5);
  expect(worldHour({time_of_day: '25:70'}, 11)).toBe(11);
  expect(worldHour({time_of_day: NaN}, 11)).toBe(11);
  expect(isNight({time_of_day: 'day'})).toBe(false);
  expect(isNight({time_of_day: 'night'})).toBe(true);
  expect(isNight({time_of_day: 12, weather: 'festival_night'})).toBe(true);
});
test('activities prioritize active Mayor gatherings, then night dancing, then daytime visits and benches', () => {
  expect(activityTarget(1, 0, 0, true, true, [1]).activity).toBe('gather');
  expect(activityTarget(1, 0, 0, true, false, [1]).activity).toBe('dance');
  expect(activityTarget(1, 0, 1, false, false, [1]).activity).toBe('sit');
  const visit = activityTarget(1, 0, 2, false, false, [0, 1]);
  const house = housePlot(1, 1);
  expect(visit).toEqual({activity: 'visit', target: [house[0], house[1] + 2]});
  expect(activityTarget(1, 0, 0, false, false, [1]).activity).toBe('wander');
});
