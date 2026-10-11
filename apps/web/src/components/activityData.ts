import type { FeedItem } from '../api/types';

export const isQa = (text?: string | null) => /^QA-/i.test(text?.trimStart() ?? '');
/** Normalize legacy agent prefixes without treating feed text as instructions. */
export function classifyActivity(item: FeedItem) {
  const raw = item.text.trim().replace(/^[\u2022\u00b7]\s*/, '');
  const prefix = /^\[AI\s+([^\]]+)\]\s*:?\s*/i.exec(raw);
  const agent = prefix?.[1].trim();
  const kind: 'mayor' | 'scheduler' | 'agent' | 'system' | 'villager' = agent?.toLowerCase() === 'mayor' ? 'mayor' : agent?.toLowerCase() === 'scheduler' ? 'scheduler' : agent ? 'agent' : !item.user_id ? 'system' : 'villager';
  const text = raw.slice(prefix?.[0].length ?? 0).replace(/^[\u2022\u00b7]\s*/, '');
  const label = kind === 'mayor' ? 'Mayor' : kind === 'scheduler' ? 'Scheduler' : agent ?? (kind === 'system' ? 'Village' : null);
  return {kind, label, text, debug: item.type === 'debug' || /\u{1f41e}/u.test(raw), noop: kind === 'scheduler' && /^none\s*:/i.test(text)};
}
export function visibleActivity(item: FeedItem, debugViewer = false) {
  const row = classifyActivity(item);
  if (!debugViewer && (row.debug || row.noop)) return false;
  const data = item.payload as Record<string, unknown>;
  return ![item.text, data.body, data.text, data.status_line].some(v => typeof v === 'string' && isQa(v))
    && !(/^(checkin|check_in|status)$/.test(item.type) && /:\s*QA-/i.test(item.text));
}
export function reactionEligible(item: FeedItem) {
  if (!visibleActivity(item)) return false;
  if (['goal_set', 'goal_completed', 'stretch_completed', 'reading_completed', 'competition_won', 'badge_earned', 'weekly_win', 'level_up'].includes(item.type)) return true;
  const data = item.payload as Record<string, unknown>;
  return ['checkin', 'check_in'].includes(item.type) && Boolean(data.evidence_url || data.evidence_asset_id || data.has_evidence);
}
export type ActivityGroup = { id: string; items: FeedItem[] };
/** Input is newest first. Do not merge across another person, event type, or UTC day. */
export function groupActivity(feed: FeedItem[], debugViewer = false): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const item of feed.filter(item => visibleActivity(item, debugViewer))) {
    const last = groups.at(-1), prior = last?.items[0];
    if (prior && item.user_id && prior.user_id === item.user_id && prior.type === item.type
      && new Date(prior.created_at).toISOString().slice(0, 10) === new Date(item.created_at).toISOString().slice(0, 10)) last!.items.push(item);
    else groups.push({id: item.id, items: [item]});
  }
  return groups;
}
export function relativeTime(value: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000));
  return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
}
export function activityName(item: FeedItem) {
  const row = classifyActivity(item);
  if (row.label) return row.label;
  return row.text.split(/ bought | checked in:| set a weekly goal:| completed a goal:| reached level | won | earned | received a Mayor text\b|:/)[0] || 'Villager';
}
export function groupLabel(group: ActivityGroup, name: string, now = new Date()) {
  const first = group.items[0];
  const row = classifyActivity(first);
  const text = row.label ? `${row.label}: ${row.text}` : row.text;
  if (group.items.length === 1) return text;
  const day = first.created_at.slice(0, 10) === now.toISOString().slice(0, 10) ? 'today' : `on ${first.created_at.slice(0, 10)}`;
  if (first.type === 'purchase') return `${name} bought ${group.items.length} things ${day}: ${group.items.map(i => {const p = i.payload as {name?: string; item_id?: string}; return p.name ?? p.item_id ?? i.text.split(' bought ')[1]?.replace(/\.$/, '') ?? 'an item';}).join(', ')}`;
  return `${text} · ${group.items.length} ${first.type.replaceAll('_', ' ')} events ${day}`;
}

export function cleanVillager<T extends {status_line: string | null}>(person: T): T {
  return {...person, status_line: isQa(person.status_line) ? null : person.status_line};
}

/** Only structured payload identifiers drive navigation; copy is never a URL. */
export type ActivityTarget =
  | {kind: 'profile' | 'activity' | 'goal' | 'house'; userId: string; id?: string; eventId?: string}
  | {kind: 'competition'; id: string; entryId?: string}
  | {kind: 'shop'; id: string}
  | {kind: 'reading'; id: string; week?: string}
  | {kind: 'media'; id: string; media: 'line' | 'gram'}
  | {kind: 'hall' | 'mayor' | 'gazette' | 'alerts'};
const field = (item: FeedItem, ...keys: string[]) => {
  const data = item.payload as Record<string, unknown>;
  for (const key of keys) if (typeof data[key] === 'string' && data[key].trim()) return data[key] as string;
  return undefined;
};
export function activityTarget(item: FeedItem): ActivityTarget {
  const id = (...keys: string[]) => field(item, ...keys), type = item.type;
  const userId = id('owner_id', 'house_owner_id') ?? item.user_id;
  if (type.startsWith('competition_') && id('competition_id')) return {kind:'competition',id:id('competition_id')!,entryId:id('entry_id')};
  if (['friend_voice','voice_line','villagergram'].includes(type)) {
    if (id('line_id','voice_line_id')) return {kind:'media',media:'line',id:id('line_id','voice_line_id')!};
    if (id('gram_id','villagergram_id')) return {kind:'media',media:'gram',id:id('gram_id','villagergram_id')!};
  }
  if (type === 'purchase' && id('item_id')) return {kind:'shop',id:id('item_id')!};
  if (type.startsWith('reading_') && id('item_id','reading_item_id')) return {kind:'reading',id:id('item_id','reading_item_id')!,week:id('week_start')};
  if (type.startsWith('hall_') || id('house_id') === 'hall') return {kind:'hall'};
  if (userId && /^(house_|furniture_|decor)/.test(type)) return {kind:'house',userId};
  if (userId && /^(goal_|stretch_)/.test(type)) return {kind:'goal',userId,id:id('goal_id')};
  if (userId && ['checkin','check_in','progress','status','evidence_uploaded','evidence_reviewed'].includes(type)) return {kind:'activity',userId,id:id('check_in_id','checkin_id'),eventId:item.id};
  if (/^(disaster_|pets_away)/.test(type)) return {kind:'alerts'};
  if (/gazette|weekly_recap|weekly_finalized/.test(type)) return {kind:'gazette'};
  if (/^(mayor_|event|outbox_sent)/.test(type) || classifyActivity(item).kind === 'mayor') return {kind:'mayor'};
  return userId ? {kind:'profile',userId} : {kind:'mayor'};
}

export const activityActions: Record<string, string> = {
  checkin:'checked in', check_in:'checked in', progress:'shared progress', status:'shared a note', evidence_uploaded:'shared evidence',
  goal_set:'set a weekly goal', goal_completed:'completed a goal', stretch_completed:'went above and beyond',
  competition_created:'started a competition', competition_joined:'joined a competition', competition_entry_submitted:'submitted an entry',
  competition_entry_decided:'had an entry reviewed', competition_settled:'finished a competition', competition_won:'won a competition',
  purchase:'bought something', reading_completed:'finished reading', reading_added:'shared a read',
  house_updated:'updated their house', furniture_added:'added furniture', furniture_moved:'moved furniture', hall_item_added:'added something to the Hall',
  friend_voice:'made your villager say something!', voice_line:'created a voice line', villagergram:'sent a Villager-gram',
  badge_earned:'earned a badge', weekly_win:'earned a weekly win', level_up:'reached a new level', xp:'earned XP',
  village_created:'founded the village', village_joined:'joined the village', avatar_queued:'added an avatar photo',
  outbox_sent:'received a Mayor text', poke:'sent a wave', cheer:'sent a cheer', equip:'changed their outfit', settings:'updated their profile',
  group_photo_queued:'added a group photo', group_photo_ready:'has a group photo ready', group_photo_claimed:'claimed their photo',
  evidence_reviewed:'had evidence reviewed', building_unlocked:'unlocked a building', outbox_failed:'has an undelivered message', penalty_repaired:'helped repair the village',
  weekly_auditor_assigned:'is the weekly auditor', weekly_auditor_replaced:'is the new weekly auditor', weekly_finalized:'finished the week', weekly_graded:'received a weekly grade', weekly_insufficient_vote:'voted on the week',
};
const systemTitles: Record<string, string> = {
  mayor_event:'A new event from the Mayor', mayor_message:'A message from the Mayor', event:'A village event', event_completed:'A village event is complete',
  disaster_started:'The village needs a hand', disaster_repaired:'The village is repaired', pets_away:'The pets are away',
  gazette:'A new Gazette', gazette_published:'A new Gazette', weekly_recap:'The weekly recap', debug:'Village debug update',
};
export function activityCopy(item: FeedItem, name = activityName(item)) {
  const row = classifyActivity(item);
  // friend_voice belongs to the speaker, but the sender performed the action.
  const actor = item.type === 'friend_voice' ? field(item,'sender_name') ?? (row.text.includes(' made your villager say:') ? row.text.split(' made your villager say:')[0] : name) : name;
  const action = Object.hasOwn(activityActions,item.type) ? activityActions[item.type] : undefined;
  const title = Object.hasOwn(systemTitles,item.type) ? systemTitles[item.type] : item.type === 'agent_decision' ? `${row.label ?? name} shared an update` : action ? `${actor} ${action}` : `${name} shared an update`;
  const detail = field(item,'body','title','name','reason') ?? field(item,'text') ?? row.text;
  const subtitle = item.type === 'friend_voice' ? detail.replace(/^.*? made your villager say:\s*/, '') : detail;
  return {title, subtitle: redundant(title, subtitle) ? '' : subtitle};
}
// Short entries keep only their title: no subtitle that just restates it (R-170).
const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function redundant(title: string, subtitle: string) {
  const t = norm(title), s = norm(subtitle);
  return !s || t.includes(s) || (s.includes(t) && s.length - t.length < 16);
}
export function groupCopy(group: ActivityGroup, name: string) {
  const first = activityCopy(group.items[0], name);
  if (group.items.length === 1) return first;
  return {
    title: group.items[0].type === 'purchase' ? `${name} bought ${group.items.length} things` : `${first.title} (${group.items.length} events)`,
    subtitle: [...new Set(group.items.map(item => activityCopy(item,name).subtitle).filter(Boolean))].join(' · '),
  };
}
