import { reactionPalette, type Accomplishment, type Emoji, type Reaction } from './reactions';
import type { FeedItem, Profile } from './types';

export class ReactionMock {
  private votes = new Map<string, Map<Emoji, Set<string>>>();
  summary(vid: string, kind: string, id: string, user: string): Reaction[] {
    const votes = this.votes.get(`${vid}:${kind}:${id}`);
    return reactionPalette.flatMap(emoji => { const users = votes?.get(emoji); return users?.size ? [{emoji, count: users.size, mine: users.has(user)}] : []; });
  }
  change(vid: string, user: string, data: Record<string, unknown>, remove: boolean, profiles: Record<string, Profile>, feed: FeedItem[], fail: (status: number, message: string) => never) {
    const {target_kind: kind, target_id: id, emoji} = data;
    if (!['activity', 'goal', 'check_in'].includes(String(kind)) || typeof id !== 'string' || !reactionPalette.includes(emoji as Emoji)) return fail(422, 'Choose a supported target and emoji.');
    const targets = kind === 'activity' ? feed : kind === 'goal' ? Object.values(profiles).flatMap(p => [...(p.goal ? [p.goal] : []), ...p.past_goals]) : Object.values(profiles).flatMap(p => p.check_ins);
    if (!targets.some(t => t.id === id)) return fail(404, 'Reaction target not found in this village.');
    const key = `${vid}:${kind}:${id}`, votes = this.votes.get(key) ?? new Map<Emoji, Set<string>>(), users = votes.get(emoji as Emoji) ?? new Set<string>();
    if (remove) users.delete(user); else users.add(user);
    votes.set(emoji as Emoji, users); this.votes.set(key, votes);
    return this.summary(vid, String(kind), id, user);
  }
  accomplishments(vid: string, user: string, profiles: Record<string, Profile>, feed: FeedItem[]): Accomplishment[] {
    const goals: Accomplishment[] = Object.values(profiles).flatMap(p => [...(p.goal ? [p.goal] : []), ...p.past_goals].filter(g => (g.status === 'done' || g.status === 'stretch')).map(g => ({id: g.id, target_kind: 'goal', target_id: g.id, user_id: g.user_id, display_name: p.villager.display_name, type: 'goal_completed', title: g.title, created_at: g.completed_at ?? `${g.week_start}T12:00:00Z`, reactions: this.summary(vid, 'goal', g.id, user)})));
    const events: Accomplishment[] = feed.filter(f => ['competition_won', 'level_up', 'badge_earned', 'stretch_completed', 'reading_completed'].includes(f.type) && f.user_id).map(f => { const data = f.payload as {title?: string; level?: number}; return {id: f.id, target_kind: 'activity', target_id: f.id, user_id: f.user_id!, display_name: profiles[f.user_id!]?.villager.display_name ?? 'Villager', type: f.type, title: data.title ?? `Reached level ${data.level}`, created_at: f.created_at, reactions: this.summary(vid, 'activity', f.id, user)}; });
    return [...goals, ...events].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  }
}
