import type { Profile, FeedItem } from '../api/types';
import type { Accomplishment } from '../api/reactions';

export function friendSummary(profile: Profile, accomplishments: Accomplishment[], now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const checkIn = [...profile.check_ins].sort((a,b) => b.created_at.localeCompare(a.created_at)).find(c => c.created_at.startsWith(today));
  const latest = accomplishments.filter(a => a.user_id === profile.villager.user_id).sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
  const justFinished = !!latest && Date.parse(latest.created_at) <= now.getTime() && Date.parse(latest.created_at) >= now.getTime() - 86400000;
  return {checkIn, latest, needsCheer: !checkIn || justFinished, justFinished, progress: profile.check_ins.filter(c => c.kind === 'progress' && c.goal_id === profile.goal?.id).length};
}

// A session-long set prevents a paginated or reordered feed from repeating nudges.
export function socialNudges(feed: FeedItem[], seen: Set<string>, user: string, now = Date.now()) {
  return feed.filter(item => !seen.has(item.id) && item.user_id && item.user_id !== user
    && ['goal_completed', 'checkin', 'check_in'].includes(item.type)
    && Date.parse(item.created_at) <= now && Date.parse(item.created_at) >= now - 86400000);
}
