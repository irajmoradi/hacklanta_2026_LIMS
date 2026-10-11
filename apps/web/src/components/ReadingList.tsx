import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { readingLink, readingMonday, type ReadingDraft, type ReadingShelf } from '../api/reading';
import type { Village } from '../api/types';
import { Dialog, errorText, Portrait } from './shared';
import { ReactionBar } from './ReactionBar';
import './ReadingList.css';

const blank: ReadingDraft = { title: '', link: '', author: '', why: '' };
export function ReadingList({ village, onClose, refresh }: { village: Village; onClose: () => void; refresh: () => Promise<void> }) {
  const [week, setWeek] = useState(readingMonday), [shelf, setShelf] = useState<ReadingShelf | null>(null);
  const [draft, setDraft] = useState(blank), [takeaways, setTakeaways] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<ReadingDraft[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), revision = useRef(0);
  const path = `/villages/${village.id}/reading`;
  useEffect(() => {
    let active = true; setShelf(null); setError('');
    const load = async () => { const version = ++revision.current; try { const result = await api.request<ReadingShelf>('GET', `${path}?week_start=${week}`); if (active && version === revision.current) setShelf(result); } catch (e) { if (active && version === revision.current) setError(errorText(e)); } };
    void load();
    const timer = setInterval(() => { if (!pending.current) void load(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [path, week]);
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; revision.current++; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(errorText(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  function move(days: number) { const date = new Date(`${week}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); setWeek(date.toISOString().slice(0, 10)); }
  return <Dialog title="Reading list" eyebrow="THE VILLAGE LIBRARY" onClose={onClose} busy={busy} wide>
    <div className="reading-library">
      <div className="reading-shelf-art" aria-hidden="true">{Array.from({length: 18}, (_, i) => <i key={i} style={{height: `${28 + i * 13 % 29}px`, background: ['#779184', '#bd7755', '#cfb675', '#6b8195'][i % 4]}} />)}</div>
      <p className="reading-intro">A little reading, shared with friends.</p>
      <p>Earn +5 XP and 5 coins for each of your first five reads this week. Your weekly goal stays separate.</p>
      <nav className="reading-weeks" aria-label="Reading weeks"><button className="button secondary" disabled={busy} onClick={() => move(-7)}>Previous week</button><strong>Week of {week} (UTC)</strong><button className="button secondary" disabled={busy || week >= readingMonday()} onClick={() => move(7)}>Next week</button></nav>
      {error && <p role="alert">{error} <button className="text-button" disabled={busy} onClick={() => void run(async () => setShelf(await api.request('GET', `${path}?week_start=${week}`)))}>Reload list</button></p>}
      {!shelf && !error && <p role="status">Opening the library…</p>}
      {shelf && <>
        <p className="help-text">{shelf.read_only ? 'Archived shelf · read-only' : `${shelf.items.length}/10 reading spots · ${shelf.awarded_count}/5 reading rewards earned`}</p>
        {!shelf.items.length && <p className="reading-empty">This shelf is waiting for its first story.{!shelf.read_only && ' Add a book, article, or essay for your neighbors.'}</p>}
        <div className="reading-cards">{shelf.items.map(item => {
          const mine = item.readers.find(r => r.user_id === api.user);
          return <article className="reading-card" key={item.id}>
            <h3>{readingLink(item.link) ? <a href={readingLink(item.link)} target="_blank" rel="noopener noreferrer">{item.title} ↗</a> : item.title}</h3>
            {item.author && <p className="help-text">by {item.author}</p>}{item.why && <p>{item.why}</p>}
            <small>Added by {village.villagers.find(p => p.user_id === item.user_id)?.display_name ?? 'a neighbor'}</small>
            {item.readers.map(reader => { const person = village.villagers.find(p => p.user_id === reader.user_id); return <div className="reading-reader" key={reader.user_id}>
              <div>{person && <Portrait person={person}/>}<span>{person?.display_name ?? 'A neighbor'} finished reading</span></div>
              {reader.takeaway && <blockquote>{reader.takeaway}</blockquote>}
              {!shelf.read_only && reader.activity_id && <ReactionBar vid={village.id} target_kind="activity" target_id={reader.activity_id} reactions={reader.reactions}/>}
              {shelf.read_only && reader.reactions.map(r => <span key={r.emoji}>{r.emoji} {r.count} </span>)}
            </div>; })}
            {mine ? <p className="reading-done" role="status">✓ Read · {mine.awarded ? '+5 XP / 5 coins earned' : 'Weekly reward cap reached'}</p> : !shelf.read_only && <form onSubmit={e => { e.preventDefault(); void run(async () => { setShelf(await api.request('POST', `${path}/${item.id}/complete`, {takeaway: takeaways[item.id] ?? ''})); await refresh(); }); }}>
              <label>One-line takeaway (optional)<input maxLength={280} value={takeaways[item.id] ?? ''} onChange={e => setTakeaways({...takeaways, [item.id]: e.target.value})}/></label>
              <button className="button primary" disabled={busy}>Mark as read{ shelf.awarded_count < 5 ? ' · +5 XP / coins' : ''}</button>
            </form>}
          </article>;
        })}</div>
        {!shelf.read_only && <section className="reading-add"><h3>Add to this week's shelf</h3>
          <form onSubmit={e => { e.preventDefault(); void run(async () => { setShelf(await api.request('POST', path, draft)); setDraft(blank); }); }}>
            <label>Title<input required maxLength={180} value={draft.title} onChange={e => setDraft({...draft, title: e.target.value})}/></label>
            <div className="reading-fields"><label>Author (optional)<input maxLength={120} value={draft.author} onChange={e => setDraft({...draft, author: e.target.value})}/></label><label>Link (optional)<input type="url" maxLength={2000} value={draft.link} onChange={e => setDraft({...draft, link: e.target.value})}/></label></div>
            <label>Why read it? (optional)<textarea maxLength={500} value={draft.why} onChange={e => setDraft({...draft, why: e.target.value})}/></label>
            <button className="button primary" disabled={busy || shelf.items.length >= 10 || !draft.title.trim()}>Add reading</button>
          </form>
          <button className="button secondary" disabled={busy || shelf.items.length >= 10} onClick={() => void run(async () => { const result = await api.request<{items: ReadingDraft[]}>('POST', `${path}/suggest`); setSuggestions(result.items); })}>Suggest reading</button>
          <p className="help-text">The Mayor suggests up to two reads from recent goals, once per week. Choose one to fill in the form.</p>
          {suggestions.map((s, i) => <button key={i} className="reading-suggestion" disabled={busy} onClick={() => setDraft(s)}><strong>{s.title}</strong><span>{s.why}</span></button>)}
        </section>}
      </>}
    </div>
  </Dialog>;
}
