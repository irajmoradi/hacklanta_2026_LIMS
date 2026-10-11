import { useEffect, useState } from 'react';
import { normalizeGazetteCopy } from '../api/gazetteCopy';
import { api } from '../api/client';
import type { GazetteIssue } from '../api/gazette';
import type { Village } from '../api/types';
import { PanelSkeleton, EmptyState, Dialog, errorText } from './shared';

export function HeadlineTicker({ vid, onOpen, onIssue }: { vid: string; onOpen: () => void; onIssue?: (id: string | null) => void }) {
  const [headline, setHeadline] = useState('Read the village paper');
  useEffect(() => {
    let active = true; setHeadline('Read the village paper');
    void api.gazetteLatest(vid).then(issue => { if (active) { setHeadline(issue?.headline ?? 'The first edition is on its way'); onIssue?.(issue?.id ?? null); } }).catch(() => {});
    return () => { active = false; };
  }, [vid, onIssue]);
  return <button className="headline-ticker" onClick={onOpen}><span>Today's headline</span><strong>{headline}</strong></button>;
}

export function Gazette({ village, onClose, onProfile }: { village: Village; onClose: () => void; onProfile: (id: string) => void }) {
  const [issues, setIssues] = useState<GazetteIssue[]>([]), [latest, setLatest] = useState<GazetteIssue | null>(null);
  const [chosen, setChosen] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void Promise.allSettled([api.gazetteLatest(village.id), api.gazetteArchive(village.id)]).then(([current, archive]) => {
      if (!active) return;
      setLatest(current.status === 'fulfilled' ? current.value : null);
      setIssues(archive.status === 'fulfilled' ? archive.value : []);
      setChosen(''); setLoading(false);
      const failure = current.status === 'rejected' ? current.reason : archive.status === 'rejected' ? archive.reason : null;
      if (failure) setError(`The Gazette could not fully load. ${errorText(failure)}`);
    });
    return () => { active = false; };
  }, [village.id, attempt]);
  const copy = (text: string) => normalizeGazetteCopy(text, village.villagers.map(person => person.display_name));
  const all = [...(latest ? [latest] : []), ...issues.filter(i => i.id !== latest?.id)];
  const issue = all.find(i => i.id === chosen) ?? all[0];
  return <Dialog title="The Village Gazette" eyebrow="THE TOWN PAPER" wide onClose={onClose}>
    {loading && <PanelSkeleton label="Unfolding the paper..." />}
    {error && <p role="alert">{error} <button className="text-button" onClick={() => setAttempt(n => n + 1)}>Retry Gazette</button></p>}
    {!loading && !error && !issue && <EmptyState>The first edition is on its way. Check back after the Mayor publishes.</EmptyState>}
    {!loading && issue && <div className="gazette-paper">
      <header className="gazette-masthead"><p>{village.name} · Your neighborhood, in print</p><h2>The Village Gazette</h2><div><time dateTime={issue.issue_date}>{new Date(`${issue.issue_date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}</time><span>{copy(issue.weather)}</span></div></header>
      <article className="gazette-lead"><span className="eyebrow">THE BIG LITTLE STORY</span><h3>{copy(issue.headline)}</h3><p>{copy(issue.body)}</p></article>
      <div className="gazette-stories">{issue.stories.map((story, index) => <article key={index}><h3>{copy(story.title)}</h3><p>{copy(story.body)}</p>{story.user_ids.map(id => { const person = village.villagers.find(v => v.user_id === id); return person ? <button className="text-button" key={id} onClick={() => onProfile(id)}>Visit {person.display_name} →</button> : null; })}</article>)}</div>
      <aside className="gazette-gossip"><h3>Over the garden fence</h3><p>{copy(issue.gossip)}</p></aside>
      <footer>AI-generated · Model: {issue.model || 'Not supplied'}{api.mode === 'mock' && ' · Scripted demo; no model called'}</footer>
    </div>}
    {all.length > 0 && <label className="gazette-archive">Past issues<select aria-label="Past issues" value={issue?.id} onChange={e => setChosen(e.target.value)}>{all.map(i => <option key={i.id} value={i.id}>{i.issue_date} — {i.headline}</option>)}</select></label>}
  </Dialog>;
}
