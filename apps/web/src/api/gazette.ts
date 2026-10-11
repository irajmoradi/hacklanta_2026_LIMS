import { normalizeGazetteCopy as copy } from './gazetteCopy';
import type { Village } from './types';

// Provisional API-009 read shapes; keep the integration boundary in one place.
export type GazetteStory = { title: string; body: string; user_ids: string[] };
export type GazetteIssue = { id: string; village_id: string; issue_date: string; created_at: string; headline: string; body: string; weather: string; stories: GazetteStory[]; gossip: string; model: string };
export type MayorMemory = { village_id: string; entries: { id: string; user_id: string | null; text: string; updated_at: string }[] };
export type EventTerms = { tier?: 'solo' | 'pair' | 'group'; effort_hours?: number; reward_xp_min?: number; reward_xp_max?: number; recovery?: string };

export function demoGazette(village: Village): GazetteIssue[] {
  return [0, 1, 2].map(days => {
    const date = new Date(Date.now() - days * 86400000).toISOString();
    return { id: `${village.id}:${date.slice(0, 10)}`, village_id: village.id, issue_date: date.slice(0, 10), created_at: date,
      headline: days ? 'Around the village' : 'The weekly goals are in',
      body: 'The neighbors have posted their weekly goals. Check their profiles for updates.',
      weather: 'Sunny. The noticeboard could use some shade.', model: 'scripted-demo',
      stories: village.villagers.slice(0, 5).map(v => ({ title: `${v.display_name} checks in`, body: `${v.display_name} has ${v.xp} XP. Their profile has the latest updates.`, user_ids: [v.user_id] })),
      gossip: 'The town noticeboard has more ambitious plans than the town has benches. No neighbors were roasted for this demo edition.',
    };
  });
}
export function demoMemory(village: Village): MayorMemory {
  const updated_at = new Date().toISOString();
  return { village_id: village.id, entries: [
    { id: 'village', user_id: null, text: 'Weekly goals and daily check-ins earn village XP.', updated_at },
    ...village.villagers.map(v => ({ id: v.user_id, user_id: v.user_id, text: `${v.display_name} has built a ${v.streak_days}-day streak. Keep encouragement personal and achievable.`, updated_at })),
  ] };
}

/* ---- Adapters for the live API-009 shapes (integrator, D-031) ---- */
type RawStory = { text?: string; title?: string; body?: string; source?: string; user_id?: string | null; user_ids?: string[] };
type RawIssue = { id: string; village_id: string; edition_date?: string; issue_date?: string; created_at: string; model?: string;
  content?: { headline?: string; body?: string; weather?: string; label?: string; stories?: RawStory[]; gossip?: string | { text?: string } } } & Partial<GazetteIssue>;

const pretty = (s?: string) => (s ?? '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function normalizeIssue(raw: RawIssue | null): GazetteIssue | null {
  if (!raw) return null;
  if (!raw.content && raw.headline) return cleanIssue(raw as GazetteIssue); // already in UI shape (mock)
  const c = raw.content ?? {};
  const gossip = typeof c.gossip === 'string' ? c.gossip : c.gossip?.text ?? '';
  const stories = (c.stories ?? []).map(s => ({
    title: s.title ?? (s.source ? pretty(s.source) : 'Village news'),
    body: s.body ?? s.text ?? '',
    user_ids: s.user_ids ?? (s.user_id ? [s.user_id] : []),
  }));
  return cleanIssue({ id: raw.id, village_id: raw.village_id, issue_date: raw.edition_date ?? raw.issue_date ?? raw.created_at.slice(0, 10),
    created_at: raw.created_at, headline: c.headline ?? 'The Village Gazette', body: c.body ?? stories[0]?.body ?? '',
    weather: c.weather?.replace(/_/g, ' ') || 'Clear', stories, gossip, model: raw.model ?? 'unknown' });
}

type RawMemory = { village_id: string; updated_at?: string; entries?: MayorMemory['entries'];
  document?: { weeks?: { week: string; winner?: string | null; completed?: number }[];
    facts?: { villager: string; wins?: number; checkins?: number; reused_evidence?: number }[];
    recent?: { kind?: string; status?: string; summary?: string }[] } };

export function normalizeMemory(raw: RawMemory): MayorMemory {
  if (raw.entries) return raw as MayorMemory;
  const at = raw.updated_at ?? new Date().toISOString(), d = raw.document ?? {};
  const entries: MayorMemory['entries'] = [];
  (d.weeks ?? []).forEach(w => entries.push({ id: `week:${w.week}`, user_id: w.winner ?? null, updated_at: at,
    text: `Week of ${w.week}: ${w.completed ?? 0} goals completed${w.winner ? ' — crown awarded' : ''}.` }));
  (d.facts ?? []).forEach(f => entries.push({ id: `fact:${f.villager}`, user_id: f.villager, updated_at: at,
    text: `${f.checkins ?? 0} check-ins, ${f.wins ?? 0} weekly wins${f.reused_evidence ? `, ${f.reused_evidence} reused evidence photo(s) noticed` : ''}.` }));
  (d.recent ?? []).forEach((r, i) => entries.push({ id: `recent:${i}`, user_id: null, updated_at: at,
    text: `${pretty(r.kind)} (${r.status ?? 'noted'}): ${(r.summary ?? '').replace(/^\[AI Mayor\]\s*/, '')}` }));
  return { village_id: raw.village_id, entries };
}

function cleanIssue(issue: GazetteIssue): GazetteIssue {
  return {...issue, headline: copy(issue.headline), body: copy(issue.body), weather: copy(issue.weather),
    gossip: copy(issue.gossip), stories: issue.stories.map(story => ({...story, title: copy(story.title), body: copy(story.body)}))};
}
