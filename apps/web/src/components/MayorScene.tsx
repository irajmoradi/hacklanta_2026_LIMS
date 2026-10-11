import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GazetteIssue } from '../api/gazette';
import type { FeedItem, Profile, Village, WeekState } from '../api/types';
import { Dialog, EmbeddedDialog, errorText } from './shared';
import { MayorScenePortrait as Portrait } from './MayorScenePortrait';
import { VillageIcon, type VillageIconName } from './VillageIcon';
import { MayorModal } from './MayorModal';
import { MayorMemory } from './MayorMemory';
import { MayorSceneDashboard } from './MayorSceneDashboard';
import { MayorSceneBribe } from './MayorSceneBribe';
import { MayorSceneSpeech } from './MayorSceneSpeech';
import { MayorUpdates } from './MayorUpdates';
import './mayorScene.css';

const choices: { label: string; detail: string; icon: VillageIconName }[] = [
  { label: "What's new?", detail: 'Mayor updates & the Gazette', icon: 'paper' },
  { label: "How's the village doing?", detail: 'Neighbors, goals & little victories', icon: 'sprout' },
  { label: 'Make a prayer', detail: 'A hopeful wish for our town', icon: 'star' },
  { label: 'Play', detail: 'Challenges worth coming together for', icon: 'game' },
  { label: 'Bribe', detail: 'An offering from your coin purse', icon: 'bag' },
  { label: 'Rumours', detail: 'A little word around the village', icon: 'chat' },
];
const greeting = "Come in, neighbor. What’s on your mind?";

/** Self-contained Mayor presentation; the shared check-in cinematic keeps its own layout. */
export function MayorScene({ village, profile, week, onClose, refresh, onPlay, loadGazette, feed = [] }: {
  feed?: FeedItem[]; village: Village; profile: Profile; week: WeekState | null; onClose: () => void;
  refresh: () => Promise<void>; onPlay: () => void;
  loadGazette: (vid: string) => Promise<GazetteIssue | null>;
}) {
  const [choice, setChoice] = useState<number | null>(null), [answer, setAnswer] = useState(greeting);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [issue, setIssue] = useState<GazetteIssue | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const version = useRef(0), menu = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null), previous = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  useLayoutEffect(() => {
    const focus = () => {
      if (choice === null) menu.current?.querySelectorAll('button')[previous.current]?.focus();
      else { panel.current?.focus(); panel.current?.scrollTo({ top: 0 }); }
    };
    if ((menu.current ?? panel.current)?.closest('dialog')?.open) { focus(); return; }
    const frame = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(frame);
  }, [choice]);
  useLayoutEffect(() => {
    const dialog = (menu.current ?? panel.current)?.closest('dialog');
    // Removing a retry/dismiss button can leave focus on body. Native Escape
    // must still return to the choices, even when keydown misses the dialog.
    const cancel = (event: Event) => {
      if (choice === null) return;
      event.preventDefault(); event.stopImmediatePropagation(); back();
    };
    dialog?.addEventListener('cancel', cancel, true);
    return () => dialog?.removeEventListener('cancel', cancel, true);
  }, [choice, busy]);
  function back() {
    if (busy) return;
    version.current++; setChoice(null); setAnswer(greeting); setLoading(false); setError('');
  }
  async function choose(index: number) {
    if (busy) return;
    previous.current = index; setChoice(index); setError(''); setIssue(null);
    const request = ++version.current;
    const lines = ['Let’s open the latest edition.', 'Every little effort helps our village grow.', 'What should happen around town?', 'A little friendly competition brings us together.', 'Choose your offering. A wish is never guaranteed.', 'You didn’t hear this from me.'];
    setAnswer(lines[index]);
    if (index !== 0 && index !== 5) return;
    setLoading(true);
    try {
      const next = await loadGazette(village.id);
      if (version.current !== request) return;
      setIssue(next);
      if (index === 0 && next) setAnswer(next.headline);
    } catch (e) { if (version.current === request) setError(errorText(e)); }
    finally { if (version.current === request) setLoading(false); }
  }
  return <Dialog closeDelay={0} title="A visit to the Mayor" eyebrow="TOWN HALL" className="mayor-scene mayor-stage" onClose={onClose} busy={busy} onKeyDown={e => {
    if (e.key === 'Escape' && choice !== null) { e.preventDefault(); back(); return; }
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || (e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return;
    if (choice === null && /^[1-6]$/.test(e.key)) { e.preventDefault(); void choose(Number(e.key) - 1); }
  }}>
    <div className="mayor-stage-body">
      <aside className="mayor-cast" aria-label="The Mayor speaking with you">
        <div className="mayor-cast-caption"><VillageIcon name="house"/> {village.name}<span>THE DOOR IS ALWAYS OPEN</span></div>
        <figure className="mayor-character">
          <svg className="mayor-illustration" viewBox="0 0 300 340" role="img" aria-label="The Mayor, in a top hat and green coat">
            <circle cx="150" cy="163" r="126" fill="#d7c698"/>
            <path d="M40 340v-54q8-73 110-73t110 73v54" fill="#315d50" stroke="#213f37" strokeWidth="5"/>
            <path d="m112 217 38 66 38-66-38 15Z" fill="#fff3d9"/>
            <path d="m91 221 13 69 46-7-36 57H71m138-119-13 69-46-7 36 57h43" fill="#477665" stroke="#213f37" strokeWidth="4"/>
            <ellipse cx="150" cy="155" rx="65" ry="77" fill="#e7ac7e" stroke="#533c31" strokeWidth="4"/>
            <path d="M91 142q-13-37 9-59h101q23 34 7 64l-17-31q-42 16-78 0Z" fill="#e7ddc2"/>
            <path d="M85 91 93 23q55-20 114 0l9 68Z" fill="#2a443c" stroke="#1b342d" strokeWidth="5"/>
            <path d="m90 68 121 0 3 20H87Z" fill="#c29a4e"/>
            <ellipse cx="150" cy="94" rx="94" ry="16" fill="#314f43" stroke="#1b342d" strokeWidth="5"/>
            <path d="M116 145h16m36 0h16" stroke="#533c31" strokeWidth="6" strokeLinecap="round"/>
            <circle cx="123" cy="156" r="4" fill="#342b28"/><circle cx="176" cy="156" r="4" fill="#342b28"/>
            <path d="m147 160-6 20h15" fill="none" stroke="#a26b4d" strokeWidth="4" strokeLinecap="round"/>
            <path d="M149 188q-19-11-39 7 20 14 40-1 21 15 40-1-20-16-41-5" fill="#fff1d4"/>
            <path d="M138 208q13 8 25-1" fill="none" stroke="#704631" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="198" cy="264" r="13" fill="#d4ae5e"/><path d="m192 264 5 5 8-10" stroke="#554522" fill="none" strokeWidth="3"/>
          </svg>
          <figcaption><strong>The Mayor</strong><span><i/> Speaking · keeper of the village</span></figcaption>
        </figure>
        <div className="mayor-listener"><Portrait person={profile.villager} large animate={!reducedMotion}/><div><span>LISTENING</span><strong>{profile.villager.display_name}</strong><p>A seat here is always yours.</p></div></div>
      </aside>
      <main className="mayor-conversation">
        <div className="mayor-dialogue"><span className="mayor-overline"><VillageIcon name="hat"/> THE MAYOR</span><MayorSceneSpeech text={answer}/></div>
        {choice === null ? <div ref={menu} className="mayor-menu" role="group" aria-label="Dialogue choices">{choices.map((item, index) => <button key={item.label} onClick={() => void choose(index)}><span className="mayor-option-icon"><VillageIcon name={item.icon} size={26}/></span><span><strong>{item.label}</strong><small>{item.detail}</small></span><kbd>{index + 1}</kbd></button>)}</div> : <>
          <div className="mayor-navigation"><button className="button secondary" onClick={back} disabled={busy}>← Back</button><span>{choices[choice].label}</span></div>
          <div className="mayor-content" ref={panel} tabIndex={0} role="region" aria-label={choices[choice].label}>
            {choice === 0 && <MayorUpdates village={village} feed={feed}/>}
            {loading ? <p role="status">Opening the village journal…</p> : error ? <div role="alert"><p>{error}</p><button className="button secondary" onClick={() => void choose(choice)}>Try again</button></div> : <>
              {choice === 0 && <section className="mayor-gazette"><span className="mayor-overline">THE VILLAGE GAZETTE {issue && ` / ${issue.issue_date}`}</span><h3>{issue?.headline ?? 'A fresh page awaits'}</h3><p>{issue?.body ?? 'No Gazette has been published yet. Come back for the next edition.'}</p>{issue && <><p className="mayor-weather"><VillageIcon name="sun"/> {issue.weather}</p><div className="mayor-stories">{issue.stories.map((story, i) => <article key={i}><div className="mayor-story-neighbors">{story.user_ids.map(id => { const person = village.villagers.find(p => p.user_id === id); return person ? <Portrait key={id} person={person}/> : null; })}</div><h4>{story.title}</h4><p>{story.body}</p></article>)}</div><small>AI Gazette · {issue.model}</small></>}</section>}
              {choice === 1 && <MayorSceneDashboard village={village} week={week}/>}
              <EmbeddedDialog.Provider value={true}>
                {choice === 2 && <><h3>Make a prayer</h3><p>A small wish, a big idea, or a little encouragement.</p><MayorModal vid={village.id} village={village} refresh={refresh} onClose={back} section="pray" onAnswer={() => setAnswer('Your answer is here, neighbor.')} onBusy={setBusy}/></>}
                {choice === 3 && <><div className="mayor-play-intro"><h3>Better together</h3><p>Read the terms, join your neighbors, and give it a go.</p><button className="button primary" onClick={onPlay}>Visit the Colosseum challenges</button></div><MayorModal vid={village.id} village={village} refresh={refresh} onClose={back} section="play"/></>}
              </EmbeddedDialog.Provider>
              {choice === 4 && <MayorSceneBribe vid={village.id} balance={profile.villager.coins} refresh={refresh} onBusy={setBusy}/>}
              {choice === 5 && <><section className="mayor-rumour"><VillageIcon name="chat" size={32}/><h3>Word around the village</h3><blockquote>{issue?.gossip || 'The benches are plotting a longer lunch break. No fresh rumours have reached the noticeboard yet.'}</blockquote>{issue && <small>From the Gazette · {issue.issue_date} · AI</small>}</section><MayorMemory village={village}/></>}
            </>}
          </div>
        </>}
        <footer className="mayor-footer"><span>{choice === null ? '1–6 to choose' : 'Esc to go back'}</span><span>{choice === null ? 'Esc returns to town' : 'Close returns to town'}</span></footer>
      </main>
    </div>
  </Dialog>;
}
