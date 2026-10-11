export const reactionPalette = ['🎉', '🔥', '👏', '💪', '❤️', '😂', '🤯', '👑'] as const;
export type Emoji = typeof reactionPalette[number];
export type Reaction = { emoji: Emoji; count: number; mine: boolean };
export type ReactionTarget = { target_kind: 'activity' | 'goal' | 'check_in'; target_id: string };
export type Accomplishment = ReactionTarget & { id: string; user_id: string; display_name: string; type: string; title: string; created_at: string; reactions: Reaction[] };

export function toggleReaction(reactions: Reaction[], emoji: Emoji): Reaction[] {
  const prior = reactions.find(r => r.emoji === emoji);
  const count = (prior?.count ?? 0) + (prior?.mine ? -1 : 1);
  return [...reactions.filter(r => r.emoji !== emoji), ...(count ? [{emoji, count, mine: !prior?.mine}] : [])];
}

// Keep the same target consistent when it appears in a profile and the wall.
export const reactionChanges = new EventTarget();
export function publishReactions(key: string, reactions: Reaction[]) {
  reactionChanges.dispatchEvent(new CustomEvent('change', {detail: {key, reactions}}));
}
