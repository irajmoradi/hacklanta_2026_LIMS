import catalog from '../../../../packages/catalog/catalog.json';
import { makeFixtures } from '../api/fixtures';
import type { Disaster, RepairPlan, IdleActivity, Village, VillageWorld } from '../api/types';

export const LEVELS = catalog.levels;
export const MAX_LEVEL = LEVELS.at(-1)!.level;
export const POPULATIONS = [10, 25, 50, 100] as const;
const activities: IdleActivity[] = ['food', 'reading', 'studying', 'working_out', 'gardening', 'home', 'dancing'];
const colors = ['#ce7752', '#769ebb', '#ae84b5', '#e2b550', '#7da385', '#e69caa'];
export const buildingName = (id: string) => catalog.entries.find(b => b.id === id)?.name ?? id.replaceAll('_', ' ');
export function worldAt(level: number): VillageWorld {
  const row = LEVELS.find(row => row.level === level);
  if (!row) throw new Error('Unknown village level');
  return { level, xp: row.xp, next_level_xp: LEVELS.find(r => r.level > level)?.xp ?? null,
    unlocked: LEVELS.filter(r => r.level <= level).flatMap(r => r.buildings).map(id => ({id, name: buildingName(id)})),
    upcoming: LEVELS.filter(r => r.level > level).flatMap(r => r.buildings.map(id => ({id, name: buildingName(id), xp: r.xp}))),
    weather: 'clear', time_of_day: 'afternoon', disaster: null };
}

/** Independent mock client. Its entire transport is memory; there is no HTTP fallback. */
export class LabSandbox {
  private state: Village;
  constructor(count = 50, level = MAX_LEVEL) {
    this.state = { id: 'lab-sandbox', name: 'Juniper Commons', seed: 24109, active_events: [], villagers: [], world: worldAt(level) };
    this.population(count);
  }
  snapshot(): Village { return structuredClone(this.state); }
  async request<T>(method: string, path: string): Promise<T> {
    if (method !== 'GET' || path !== '/village') throw new Error('Lab client only supports GET /village; use local simulation controls.');
    return this.snapshot() as T;
  }
  population(count: number) {
    if (!POPULATIONS.includes(count as typeof POPULATIONS[number])) throw new Error('Unsupported population');
    const templates = makeFixtures().village.villagers;
    this.state.villagers = Array.from({length: count}, (_, i) => {
      const person = structuredClone(templates[i % templates.length]);
      const user_id = `lab-neighbor-${i + 1}`;
      return {...person, user_id, display_name: `Neighbor ${String(i + 1).padStart(3, '0')}`, house_slot: i,
        house_level: 1 + i % 3, has_crown: false, equipped: [], equipped_ids: [], status_line: 'Enjoying Juniper Commons.', idle_activity: activities[i % activities.length],
        avatar: {...person.avatar, user_id, body: {...person.avatar.body, colors: {...person.avatar.body.colors, shirt: colors[i % colors.length], pants: colors[(i + 3) % colors.length]}}, portrait: {kind: 'initials' as const}}};
    });
    return this.snapshot();
  }
  level(level: number) { this.state.world = worldAt(level); return this.snapshot(); }
  disaster(kind: Disaster['kind']) {
    const closures = {scorch: 'farm_store', outbreak: 'pet_shelter', blackout: null, blight: 'garden'};
    if (!Object.hasOwn(closures, kind)) throw new Error('Unknown disaster');
    this.state.world = {...worldAt(MAX_LEVEL), time_of_day: kind === 'blackout' ? 'night' : 'afternoon',
      disaster: {kind, title: `${kind[0].toUpperCase()}${kind.slice(1)} in Juniper Commons`, body: 'Neighbors rebuild together.',
        started_at: new Date().toISOString(), deadline: new Date(Date.now() + 86400000).toISOString(), repair_event_id: `lab-${kind}`,
        target_checkins: 12, target_people: 5, checkins: 0, people: 0, closed_building: closures[kind], pets_away: kind === 'outbreak'}};
    return this.snapshot();
  }
  checkins() {
    const d = this.state.world?.disaster;
    if (d) { d.checkins = Math.min(d.target_checkins, d.checkins + 3); d.people = Math.min(d.target_people, d.people + 2); }
    return this.snapshot();
  }
  plan(plan: RepairPlan) {
    if (this.state.world?.disaster) this.state.world.disaster.repair_plan = structuredClone(plan);
    return this.snapshot();
  }
  task(kind: string) {
    const task = this.state.world?.disaster?.repair_plan?.tasks.find(t => t.kind === kind);
    if (task) task.progress = Math.min(task.target, task.progress + 1);
    return this.snapshot();
  }
  repair() {
    const d = this.state.world?.disaster;
    if (d && (d.repair_plan ? d.repair_plan.tasks.some(t => t.progress < t.target) : (d.checkins < d.target_checkins || d.people < d.target_people))) throw new Error('Simulate the remaining check-ins first.');
    this.state.world = {...worldAt(MAX_LEVEL), rebuilt_at: new Date().toISOString()};
    return this.snapshot();
  }
  clear() { this.state.world = worldAt(MAX_LEVEL); return this.snapshot(); }
}
