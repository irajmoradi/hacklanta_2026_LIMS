import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Accomplishment } from '../api/reactions';
import type { Village } from '../api/types';
import { Dialog, EmptyState, errorText, Portrait } from './shared';
import { ReactionBar } from './ReactionBar';

const labels: Record<string, string> = {reading_completed: 'Finished reading', stretch_completed: 'Above & beyond', goal_completed: 'Goal completed', competition_won: 'Competition won', level_up: 'Level up', badge_earned: 'Badge earned'};
export function Accomplishments({ village, onClose }: { village: Village; onClose: () => void }) {
  const [items, setItems] = useState<Accomplishment[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void api.accomplishments(village.id).then(rows => { if (active) setItems(rows); }).catch(e => { if (active) setError(errorText(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [village.id, attempt]);
  return <Dialog title="Accomplishments" eyebrow="AROUND TOWN" onClose={onClose} wide className="accomplishments-dialog">
    <p className="modal-intro">See who finished a goal or earned a reward.</p>
    {loading ? <p role="status">Loading accomplishments…</p> : error ? <div role="alert"><p>{error}</p><button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Retry accomplishments</button></div> : <div className="accomplishment-grid">
      {items.map(item => { const person = village.villagers.find(v => v.user_id === item.user_id); return <article className="accomplishment-card" key={item.id}>
        <header>{person ? <Portrait person={person} /> : <span className="portrait">{item.display_name.slice(0, 2)}</span>}<div><strong>{item.display_name}</strong><span>{labels[item.type] ?? 'Accomplishment'}</span></div><span className="achievement-spark" aria-hidden="true">✦</span></header>
        <h3>{item.title}</h3><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</time>
        <ReactionBar vid={village.id} target_kind={item.target_kind} target_id={item.target_id} reactions={item.reactions} />
      </article>; })}
      {!items.length && <EmptyState>No accomplishments yet; complete a goal to add one.</EmptyState>}
    </div>}
  </Dialog>;
}
