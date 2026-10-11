import { equipmentFor } from './equipment';
import { levelFor, type AvatarManifest, type Profile, type Village } from './types';

export const DEMO_VILLAGE_ID = '11111111-1111-4111-8111-111111111111';
export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
export function monday(date = new Date()) {
  const d = new Date(date); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function makeFixtures() {
  const names = ['Iraj', 'Lance', 'Stefanny', 'Maya', 'Mario'];
  const shirts = ['#d88354', '#759fbc', '#b38cbe', '#e4b457', '#80a789'];
  const hair = ['#302b2b', '#624133', '#382d29', '#372b25', '#302b2b'];
  const skin = ['#bc855e', '#dfad87', '#ca906c', '#965f44', '#b68058'];
  const xp = [420, 275, 680, 350, 190];
  const titles = ['Ship a group photo album', 'Run three times this week', 'Make a little art every day', 'Finish my first music mix', 'Cook dinner for the crew'];
  const statuses = ['Working on the photo album.', 'Morning miles, evening builds.', 'Paint on the desk again.', 'Mixing track four.', 'Dinner at seven.'];
  const profiles: Record<string, Profile> = {};
  const villagers = names.map((display_name, i) => {
    const user_id = `00000000-0000-4000-8000-00000000000${i + 1}`;
    const avatar: AvatarManifest = { schema_version: 1, user_id, revision: 1,
      body: { kind: 'preset', preset_id: 'preset_default', colors: { hair: hair[i], shirt: shirts[i], pants: '#435267', shoes: '#403a35', skin: skin[i] } },
      portrait: { kind: 'initials' }, generation: { segment: 'none', head: 'none', body: 'none' } };
    const house_level = [2, 1, 3, 2, 1][i];
    const equipped_ids = [...(house_level >= 2 ? [`house_lv${house_level}`] : []), ...[['glasses_round', 'hat_headphones', 'voice_hype_coach'], ['hat_festival', 'pet_dog', 'house_backyard'], ['hat_crown', 'scarf'], ['jacket_denim'], ['hat_cap']][i]];
    const equipped = equipped_ids.map(equipmentFor);
    const villager = { user_id, display_name, house_slot: i, house_level, coins: xp[i], xp: xp[i], level: levelFor(xp[i]), streak_days: [4, 3, 7, 5, 2][i], avatar, equipped, equipped_ids, status_line: statuses[i], has_crown: i === 2 };
    const goal = { id: `goal-${i}`, user_id, week_start: monday(), title: titles[i], detail: '', status: 'active' as const };
    profiles[user_id] = { villager, goal,
      past_goals: [{ ...goal, id: `past-${i}`, week_start: monday(new Date(Date.now() - 7 * 86400000)), title: ['Learn something new', 'Spend an hour outside', 'Try a new creative project', 'Make time for music', 'Learn a new recipe'][i], status: 'done' }],
      check_ins: [0, 1, 2].map(j => ({ id: `check-${i}-${j}`, user_id, created_at: new Date(Date.now() - (j + 1) * 86400000 - i * 3600000).toISOString(), kind: j === 2 ? 'status' : 'progress', body: ["Got another session in today.", 'Worked on my goal today.', statuses[i]][j], goal_id: j === 2 ? null : goal.id, evidence_url: null })) };
    return villager;
  });
  const village: Village = { owner_user_id: DEMO_USER_ID, id: DEMO_VILLAGE_ID, name: 'Hacklanta Crew', seed: 24109, villagers,
    active_events: [{ id: 'challenge-1', kind: 'challenge', tier: 'group', effort_hours: 2, reward_xp_min: 30, reward_xp_max: 60, recovery: 'Share one group check-in to clear the fog.', title: 'Roll call', body: 'Everyone post an update on your weekly goal. Five updates earn a village celebration.', reward_xp: 50, penalty: 'Fog over the square', status: 'active', ends_at: new Date(Date.now() + 3 * 86400000).toISOString() }] };
  return { village, profiles };
}
