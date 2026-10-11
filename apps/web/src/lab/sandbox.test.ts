import { expect, spyOn, test } from 'bun:test';
import type { Village } from '../api/types';
import { LabSandbox, LEVELS, MAX_LEVEL, POPULATIONS } from './sandbox';
test('sandbox clients are independent, clone snapshots and never use network transport', async () => {
  const network = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
  try {
    const a = new LabSandbox(), b = new LabSandbox();
    for (const count of POPULATIONS) expect(a.population(count).villagers).toHaveLength(count);
    for (const row of LEVELS) {
      const world = a.level(row.level).world!;
      expect(world.xp).toBe(row.xp);
      expect(world.unlocked.map(v => typeof v === 'string' ? v : v.id)).toEqual(LEVELS.filter(r => r.level <= row.level).flatMap(r => r.buildings));
    }
    for (const kind of ['scorch', 'outbreak', 'blackout', 'blight'] as const) {
      expect(a.disaster(kind).world!.disaster!.kind).toBe(kind);
      expect(() => a.repair()).toThrow();
      for (let i = 0; i < 5; i++) a.checkins();
      expect(a.snapshot().world!.disaster!.checkins).toBe(12);
      expect(a.snapshot().world!.disaster!.people).toBe(5);
      expect(a.repair().world!.disaster).toBeNull();
      expect(a.snapshot().world!.rebuilt_at).toBeTruthy();
    }
    a.disaster('scorch'); a.clear();
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) await expect(a.request(method, '/village')).rejects.toThrow();
    expect(await a.request<Village>('GET', '/village')).toEqual(a.snapshot());
    const copy = a.snapshot(); copy.villagers[0].display_name = 'changed';
    expect(a.snapshot().villagers[0].display_name).toBe('Neighbor 001');
    expect(b.snapshot().villagers).toHaveLength(50);
    expect(b.snapshot().world!.level).toBe(MAX_LEVEL);
    expect(network).not.toHaveBeenCalled();
  } finally {network.mockRestore();}
});
test('synthetic residents have unique addresses and no generated faces or external assets', () => {
  const people = new LabSandbox(100).snapshot().villagers;
  expect(new Set(people.map(p => p.user_id)).size).toBe(100);
  expect(new Set(people.map(p => p.house_slot)).size).toBe(100);
  expect(new Set(people.map(p => p.idle_activity)).size).toBeGreaterThan(4);
  for (const p of people) {
    expect(p.avatar.user_id).toBe(p.user_id);
    expect(p.avatar.body.kind).toBe('preset');
    expect(p.avatar.portrait).toEqual({kind: 'initials'});
    expect(p.equipped).toEqual([]);
  }
  expect(() => new LabSandbox(101)).toThrow();
  expect(() => new LabSandbox(10, 0)).toThrow();
});
