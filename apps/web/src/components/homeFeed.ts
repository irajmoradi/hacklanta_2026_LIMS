import type { FeedItem } from '../api/types';

/** Keep the newest copy of repeated background decisions, retaining friend activity. */
export function homeFeed(feed: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return feed.filter(item => {
    if (item.type !== 'agent_decision') return true;
    const key = `${item.user_id}:${item.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}
