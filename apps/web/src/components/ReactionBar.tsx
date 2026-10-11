import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { publishReactions, reactionChanges, reactionPalette, toggleReaction, type Emoji, type Reaction, type ReactionTarget } from '../api/reactions';
import { errorText } from './shared';

const empty: Reaction[] = [];
export function ReactionBar({ vid, target_kind, target_id, reactions = empty }: ReactionTarget & { vid: string; reactions?: Reaction[] }) {
  const key = `${api.user}:${vid}:${target_kind}:${target_id}`;
  const [items, setItems] = useState(reactions), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!pending.current) setItems(reactions); }, [reactions, key]);
  useEffect(() => {
    const update = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail.key === key) setItems(detail.reactions); };
    reactionChanges.addEventListener('change', update);
    return () => reactionChanges.removeEventListener('change', update);
  }, [key]);
  async function toggle(emoji: Emoji) {
    if (pending.current) return;
    const previous = items;
    pending.current = true; setBusy(true); setError('');
    publishReactions(key, toggleReaction(items, emoji));
    try {
      const result = await api.react(vid, {target_kind, target_id}, emoji, !!items.find(r => r.emoji === emoji)?.mine);
      publishReactions(key, result);
    } catch (e) { publishReactions(key, previous); setError(errorText(e)); }
    finally { setOpen(false); pending.current = false; setBusy(false); }
  }
  return <div className="reaction-control"><div className="reaction-bar" role="group" aria-label="Emoji reactions" aria-busy={busy}>
    <button type="button" aria-label="Add reaction" aria-expanded={open} onClick={() => setOpen(!open)}>+😊</button>
    {(open ? reactionPalette : items.filter(i => i.count > 0).map(i => i.emoji)).map(emoji => { const item = items.find(r => r.emoji === emoji); return <button type="button" key={emoji} aria-label={`React ${emoji}`} aria-pressed={!!item?.mine} disabled={busy} onClick={() => void toggle(emoji)}><span>{emoji}</span>{!!item?.count && <small>{item.count}</small>}</button>; })}
  </div>{error && <p className="form-error" role="alert">{error} Try again.</p>}</div>;
}
