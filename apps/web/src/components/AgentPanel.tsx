import { VillageIcon } from './VillageIcon';
import { ToastNotice, toast } from './Toast';
import { Reward } from './Currency';
import { sound } from '../sound/engine';
import { MayorMemory } from './MayorMemory';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { ApiError } from '../api/mock';
import type { AgentLog, CheckIn, Village } from '../api/types';
import { Dialog, PanelSkeleton, EmptyState, errorText, when } from './shared';

// apps/api/scripts/seed.py assigns the first seeded user the owner role.
// Never infer ownership from house order for arbitrary villages. Server enforces every mutation.
export const isOwner = (village: Village) => village.owner_user_id !== undefined ? village.owner_user_id === api.user
  : village.my_role !== undefined ? village.my_role === 'owner'
  : village.id === '13370000-0000-4000-8000-000000000000' && api.user === '13370000-0000-4000-8000-000000000001';
export function AgentPanel({ village, onClose, refresh }: { village: Village; onClose: () => void; refresh: () => Promise<void> }) {
  const [entries, setEntries] = useState<AgentLog[]>([]), [error, setError] = useState(''), [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(''), [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true, timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const next = await api.agentLog(village.id); if (active) { setEntries(next); setError(''); } }
      catch (e) { if (active) setError(e instanceof ApiError && e.status === 404 ? 'AI activity is not available on this server yet.' : errorText(e)); }
      finally { if (active) { setLoaded(true); timer = setTimeout(() => void poll(), 10000); } }
    }
    void poll(); return () => { active = false; clearTimeout(timer); };
  }, [village.id, attempt]);
  async function complete(id: string) {
    if (busy || !selected.length) return; setBusy(id); setNotice('');
    try { await api.completeEvent(village.id, id, selected); await refresh(); setNotice('Event completed. Rewards were awarded once per villager.'); }
    catch (e) { toast({kind:'error',title:errorText(e)}); } finally { setBusy(''); }
  }
  return <Dialog title="AI at work" eyebrow="YOUR VILLAGE, WITH A LITTLE HELP" onClose={onClose} wide busy={!!busy}>
    <p className="modal-intro">The Mayor plans, the auditor checks evidence, and the scheduler keeps time. AI decisions refresh every 10 seconds.</p>
    {api.mode === 'mock' && <p className="help-text">Scripted demo decisions · no models are called.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {error && <button className="button secondary" onClick={() => { setError(''); setLoaded(false); setAttempt(n => n + 1); }}>Retry activity</button>}
    <MayorMemory key={`${village.id}:${api.user}`} village={village} />
    <div className="agent-log" aria-label="Agent decisions">{entries.map((entry, i) => <article key={`${entry.created_at}-${i}`}><div className="agent-heading"><strong>{entry.agent}</strong><time>{when(entry.created_at)}</time></div><h3>{entry.action}</h3><p>{entry.reason}</p><small>AI · {entry.model}{entry.target_user_id && ` · ${village.villagers.find(v => v.user_id === entry.target_user_id)?.display_name ?? 'Villager'}`}</small></article>)}</div>
    {!error && !entries.length && (loaded ? <EmptyState>No decisions yet. Your village's story is just beginning.</EmptyState> : <PanelSkeleton label="Reading the village journal..." />)}
    {isOwner(village) && <section className="owner-actions"><h3>Owner · complete a village event</h3><p>Select the villagers who took part.</p><div className="participants">{village.villagers.map(v => <label className="checkbox-line" key={v.user_id}><input type="checkbox" disabled={!!busy} checked={selected.includes(v.user_id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, v.user_id] : ids.filter(id => id !== v.user_id))} />{v.display_name}</label>)}</div>{village.active_events.filter(e => e.status === 'active').map(event => <div className="event-completion" key={event.id}><span>{event.title}{event.reward_xp > 0 && <Reward amount={event.reward_xp} />}</span><button className="button secondary" disabled={!selected.length || !!busy} onClick={() => void complete(event.id)}>{busy === event.id ? 'Completing…' : 'Mark event complete'}</button></div>)}</section>}
    {!isOwner(village) && <p className="help-text">Only village owners can complete events.</p>}
    <ToastNotice message={notice} kind="info"/>
  </Dialog>;
}

export function ReviewBadge({ checkIn, vid, owner, refresh }: { checkIn: CheckIn; vid: string; owner: boolean; refresh: () => Promise<void> }) {
  const [review, setReview] = useState(checkIn.review), [editing, setEditing] = useState(false), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const previousVerdict = useRef(review?.verdict);
  useEffect(() => { if (review?.verdict && review.verdict !== previousVerdict.current) sound.play(review.verdict === 'verified' ? 'evidence_stamp_ok' : 'evidence_buzzer_sus'); previousVerdict.current = review?.verdict; }, [review?.verdict]);
  useEffect(() => { setReview(checkIn.review); }, [checkIn.review]);
  useEffect(() => {
    if (!checkIn.evidence_url && !checkIn.review) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const result = await api.review(vid, checkIn.id); if (active) setReview(result); }
      catch { /* A queued or unavailable review never hides the original check-in. */ }
      finally { if (active) timer = setTimeout(() => void poll(), 10000); }
    }
    void poll(); return () => { active = false; clearTimeout(timer); };
  }, [vid, checkIn.id, checkIn.evidence_url]);
  if (!review && !checkIn.evidence_url) return null;
  return <div className="review"><span className={`review-badge ${review?.verdict ?? 'pending'}`} title={review?.reason ?? 'Waiting for evidence review'} tabIndex={0}>{review ? <><VillageIcon name={review.verdict === 'verified' ? 'check' : 'warning'} size={14}/> {review.verdict}</> : 'Evidence review pending' }</span>{review && <span className="review-reason" role="tooltip">{review.reason}</span>}
    {owner && review && <button className="text-button" onClick={() => setEditing(v => !v)}>Override review</button>}
    {editing && <form onSubmit={e => { e.preventDefault(); if (busy || !reason.trim()) return; setBusy(true); setError(''); void api.overrideReview(vid, checkIn.id, reason.trim()).then(async result => { setReview(result); setEditing(false); await refresh(); }).catch(e => setError(errorText(e))).finally(() => setBusy(false)); }}><p className="help-text">Approve this evidence as verified and record your reason.</p><label>Override reason<input required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label><button className="button secondary" disabled={busy || !reason.trim()}>Save review override</button></form>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
