import { useId, useState } from 'react';
import { api } from '../api/client';
import type { Profile } from '../api/types';
import { monday } from '../api/fixtures';
import { errorText } from './shared';

export function GoalStretch({ vid, profile, editable = false, refresh }: { vid: string; profile: Profile; editable?: boolean; refresh: () => Promise<void> }) {
  const [title, setTitle] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const titleId = useId();
  const goal = profile.goal;
  if (!goal) return null;
  const tiers = goal.stretches ?? [];
  const active = tiers.find(s => s.status === 'active');
  const canEdit = editable && goal.week_start === monday();
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); setTitle(''); await refresh(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <section aria-label="Goal journey" className="goal-context" style={{ display: 'grid', gap: 12 }}>
    <strong>{goal.completed_at || goal.status === 'done' || tiers.length ? '✓ ' : ''}{goal.title}</strong>
    {tiers.some(s => s.status === 'done') && <span className="reward-chip">🚀 Above &amp; beyond</span>}
    {tiers.map(s => {
      const checks = profile.check_ins.filter(c => c.goal_id === goal.id && c.stretch_tier === s.tier).length;
      return <article key={s.tier}><strong>Stretch {s.tier}: {s.title}</strong>
        <p className="help-text">{s.status === 'done' ? '✓ Complete · +10 XP and 10 coins' : `${checks} progress check-ins · In progress`}</p>
        <progress aria-label={`Stretch ${s.tier} progress`} max={2} value={s.status === 'done' ? 2 : checks ? 1 : 0} style={{ width: '100%' }} />
        <small>{s.status === 'done' ? 'Completed' : checks ? 'Progress shared' : 'Ready to begin'}</small>
      </article>;
    })}
    {canEdit && goal.status === 'active' && <button className="button secondary" disabled={busy} onClick={() => void run(() => api.goalStatus(vid, goal.id, 'done'))}>Mark goal done</button>}
    {canEdit && active && <button className="button primary" disabled={busy} onClick={() => void run(() => api.finishStretch(vid, goal.id, active.tier))}>Finish stretch {active.tier} · +10 XP / coins</button>}
    {canEdit && goal.status === 'done' && tiers.length < 3 && <div className="goal-stretch-form">
      <label htmlFor={titleId}>Stretch target (optional)</label>
      <input id={titleId} maxLength={140} placeholder="What would going further look like?" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} />
      <button className="button primary" disabled={busy} onClick={() => void run(() => api.stretch(vid, goal.id, title.trim()))}>🚀 Go beyond</button>
      <p className="help-text">Earn 10 XP and 10 coins per completed tier, up to 3 this week. Each adds 1 ambition point to an approved weekly completion.</p>
    </div>}
    {tiers.length === 3 && !active && <p>All three stretch tiers complete. You went above &amp; beyond!</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
