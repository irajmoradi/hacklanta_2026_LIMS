import { RepairTasks } from './RepairTasks';
import { VillageIcon } from './VillageIcon';
import { Reward } from './Currency';
import { BribePanel } from './BribePanel';
import { sound as sfx } from '../sound/engine';
import { EventTerms } from './EventTerms';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Crown, Sparkles, X } from 'lucide-react';
import { api } from '../api/client';
import type { MayorEvent, Village } from '../api/types';
import { Dialog, EmbeddedDialog, errorText } from './shared';

const labels = { challenge: 'Village challenge', prayer_response: 'Prayer response', recap: 'Weekly recap', random_event: 'Village event' };
// Older servers omit timestamps but already return newest first. Preserve that order.
export function newestEvents(events: MayorEvent[]) {
  if (!events.every(e => e.created_at && Number.isFinite(Date.parse(e.created_at)))) return [...events];
  return [...events].sort((a, b) => Date.parse(b.created_at!) - Date.parse(a.created_at!));
}
function readPinned(key: string): MayorEvent | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return value && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.body === 'string' && Object.hasOwn(labels, value.kind) && typeof value.reward_xp === 'number' && (value.model === undefined || typeof value.model === 'string') ? value : null;
  } catch { return null; }
}
function remember(key: string, event: MayorEvent | null) {
  try { if (event) sessionStorage.setItem(key, JSON.stringify(event)); else sessionStorage.removeItem(key); } catch { /* Storage may be disabled; keep the current response visible. */ }
}
export function MayorModal({ vid, village, onClose, refresh, section, onAnswer, onBusy }: { section?: 'pray' | 'play'; onAnswer?: (text: string) => void; onBusy?: (busy: boolean) => void; vid: string; village: Village; onClose: () => void; refresh: () => Promise<void> }) {
  const embedded = useContext(EmbeddedDialog);
  const key = `village:mayor-response:${api.user}:${vid}`;
  const [text, setText] = useState(''), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [result, setResult] = useState<MayorEvent | null>(() => readPinned(key));
  const [bribeBusy, setBribeBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const card = useRef<HTMLElement>(null);
  const focusAnswer = useRef(false);
  useLayoutEffect(() => {
    if (!result || !focusAnswer.current) return;
    focusAnswer.current = false;
    (card.current?.closest('.mayor-content') ?? card.current?.closest('dialog'))?.scrollTo({ top: 0 });
    card.current?.focus({ preventScroll: true });
  }, [result]);
  useEffect(() => { onBusy?.(!!busy || bribeBusy); }, [busy, bribeBusy, onBusy]);
  useEffect(() => { setResult(readPinned(key)); setExpanded(false); }, [key]);
  async function ask(kind: 'pray' | 'recap') {
    if (busy) return;
    setBusy(kind); setError('');
    try {
      const next = await (kind === 'pray' ? api.pray(vid, text.trim()) : api.recap(vid));
      focusAnswer.current = true;
      setResult(next); remember(key, next); onAnswer?.(`${next.title}. ${next.body}`);
      sfx.play(kind === 'pray' ? 'prayer_chime' : 'mayor_gong');
      await refresh();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(''); }
  }
  const events = newestEvents(village.active_events).filter(e => e.id !== result?.id && (section !== 'play' || e.kind === 'challenge' || e.kind === 'random_event'));
  const content = <>
    {village.world?.disaster && <section aria-label="Mayor repair notice"><h3>Repairs needed</h3><p>{village.world.disaster.body}</p><RepairTasks disaster={village.world.disaster}/></section>}
    {result && section !== 'play' && <article ref={card} tabIndex={-1} className="mayor-response pinned-response" aria-label="Mayor's answer" role="status">
      <div className="response-heading"><span className="mayor-emblem"><Crown size={25} aria-label="Mayor" /></span><span className="eyebrow">THE MAYOR ANSWERS<br />{labels[result.kind]}</span><button className="icon-button" aria-label="Dismiss Mayor's answer" onClick={() => { setResult(null); remember(key, null); }}><X size={18} /></button></div>
      <h3>{result.title}</h3><p>{result.body}</p><EventTerms event={result} /><div className="response-footer">{result.reward_xp > 0 && <b className="reward-chip"><Reward amount={result.reward_xp} /></b>}<small>AI · {result.model || 'Model not supplied'}</small></div>
    </article>}
    {!embedded && <div className="mayor-welcome"><span aria-hidden="true"><VillageIcon name="hat" size={32}/></span><p>The Mayor is taking requests.<br />What’s on your mind, neighbor?</p></div>}
    {section !== 'play' && <form onSubmit={e => { e.preventDefault(); void ask('pray'); }}><label htmlFor="prayer">Pray to the Mayor</label><textarea id="prayer" value={text} onChange={e => setText(e.target.value)} maxLength={1000} rows={3} required placeholder="What should happen around town?" disabled={!!busy} /><div className="mayor-actions"><button className="button primary" type="submit" disabled={!!busy || !text.trim()}><Sparkles size={15} />{busy === 'pray' ? 'The Mayor is thinking…' : 'Send wish'}</button><button className="button secondary" type="button" disabled={!!busy} onClick={() => void ask('recap')}>{busy === 'recap' ? 'Remembering…' : 'Weekly recap'}</button></div></form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {section !== 'pray' && <section aria-label="Mayor events" className="mayor-events"><h3>Village journal</h3>{(expanded ? events : events.slice(0, 3)).map(event => <article key={event.id} className={`event-card event-${event.kind} ${['completed', 'failed'].includes(event.status) ? 'event-muted' : ''}`}><span className="section-label"><Sparkles size={13} />{labels[event.kind]}{event.reward_xp > 0 && <b><Reward amount={event.reward_xp} /></b>}</span><h3>{event.title}</h3><p>{event.body}</p><EventTerms event={event} /><small>{event.status}{event.ends_at && ` · Through ${new Date(event.ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</small>{event.model && <small>AI · {event.model}</small>}</article>)}{events.length > 3 && <button className="text-button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Show fewer' : `Show ${events.length - 3} more`}</button>}{!events.length && <p>No games are open yet. The Mayor will post the next challenge here.</p>}</section>}
    {!section && <BribePanel key={vid + api.user} vid={vid} onBusy={setBribeBusy} balance={village.villagers.find(v => v.user_id === api.user)?.coins ?? 0} refresh={refresh} />}
    <p className="modal-footnote">{api.mode === 'mock' ? 'Demo Mayor · scripted encouragement; no model called' : 'AI Mayor messages are generated after your request.'}</p>
  </>;
  return embedded ? <section>{content}</section> : <Dialog title="A word with the Mayor" eyebrow="TOWN HALL" onClose={onClose} busy={!!busy || bribeBusy}>{content}</Dialog>;
}
