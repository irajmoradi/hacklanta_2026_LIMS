import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { CheckInInput, FeedItem, Profile, Village, WeekState } from '../api/types';
import type { GazetteIssue } from '../api/gazette';
import { sound } from '../sound/engine';
import { Dialog, EmbeddedDialog, errorText, mediaUrl, Portrait } from './shared';
import { CheckInDialogue } from './CheckInDialogue';
import { MayorModal } from './MayorModal';
import { BribePanel } from './BribePanel';
import { MayorScene } from './MayorScene';
import { VillageIcon, type VillageIconName } from './VillageIcon';
import './cinematicScene.css';

const checkinChoices: { label: string; hint: string; icon: VillageIconName }[] = [
  { label: 'Daily note', hint: 'Share a little from today', icon: 'paper' },
  { label: 'Goal progress', hint: 'Celebrate a step toward your goal', icon: 'flag' },
  { label: 'Not now', hint: 'Return to the village', icon: 'walk' },
];

export type SceneKind = 'checkin' | 'mayor';
export type SceneReward = { xp: number; start: number };
const gazettes = new Map<string, { expires: number; value: Promise<GazetteIssue | null> }>();
/** Reuse already-generated Gazette gossip. Reading this cache never schedules a paid job. */
export function sceneGazette(vid: string) {
  const key = `${api.mode}:${api.user}:${vid}`;
  let entry = gazettes.get(key);
  if (!entry || entry.expires <= Date.now()) {
    entry = { expires: Date.now() + 3600000, value: api.gazetteLatest(vid).catch(e => { gazettes.delete(key); throw e; }) };
    gazettes.set(key, entry);
  }
  return entry.value;
}

function Typewriter({ text }: { text: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setCount(text.length); return; }
    setCount(0);
    const start = performance.now();
    const timer = setInterval(() => {
      const next = Math.min(text.length, Math.ceil((performance.now() - start) / 12));
      setCount(next); if (next === text.length) clearInterval(timer);
    }, 32);
    return () => clearInterval(timer);
  }, [text]);
  return <p className="scene-speech" aria-label={text}><span aria-hidden="true">{text.slice(0, count)}<i className="speech-caret"/></span><span className="sr-only" role="status">{text}</span></p>;
}

/** Triggered only by opening a scene. The server caches fixed greetings, with no retries. */
function useGreeting(kind: SceneKind, vid: string) {
  useEffect(() => {
    let alive = true, audio: HTMLAudioElement | undefined, url: string | undefined;
    sound.play('xp_ding');
    if (api.mode !== 'mock' && !sound.settings.muted && !sound.settings.reduced) {
      void api.request<{ audio_url: string | null }>('POST', `/villages/${vid}/scene-voice/${kind}`).then(async line => {
        if (!alive || !line.audio_url) return;
        url = await mediaUrl(line.audio_url);
        if (!alive) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return; }
        audio = new Audio(url); audio.volume = sound.settings.volume;
        if (!sound.settings.muted) await audio.play();
      }).catch(() => { /* The soft greeting blip is the offline/provider fallback. */ });
    }
    const unsubscribe = sound.subscribe(() => { if (audio) { audio.volume = sound.settings.volume; audio.muted = sound.settings.muted; } });
    return () => { alive = false; audio?.pause(); if (url?.startsWith('blob:')) URL.revokeObjectURL(url); unsubscribe(); };
  }, [kind, vid]);
}

export function CinematicScene(props: Parameters<typeof OriginalCinematicScene>[0]) {
  useGreeting(props.kind, props.village.id);
  return props.kind === 'mayor'
    ? <MayorScene {...props} loadGazette={sceneGazette}/>
    : <OriginalCinematicScene {...props}/>;
}

function OriginalCinematicScene({ kind, village, profile, week, reward, onClose, onGoal, submit, refresh, onPlay }: {
  kind: SceneKind; feed?: FeedItem[]; village: Village; profile: Profile; week: WeekState | null; reward: SceneReward | null;
  onClose: () => void; onGoal: () => void; submit: (input: CheckInInput) => Promise<void>; refresh: () => Promise<void>; onPlay: () => void;
}) {
  const greeting = kind === 'checkin' ? 'What did I do today?' : "What's on your mind, neighbor?";
  const [choice, setChoice] = useState<number | null>(null), [answer, setAnswer] = useState(greeting);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { if (!leaving) return; const timer = setTimeout(() => setLeaving(false), 80); return () => clearTimeout(timer); }, [leaving]);
  const request = useRef(0), buttons = useRef<HTMLDivElement>(null);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => { if (reward) setChoice(null); }, [reward]);
  const back = () => { request.current++; setLoading(false); setError(''); setChoice(null); setLeaving(false); setAnswer(greeting); requestAnimationFrame(() => buttons.current?.querySelector('button')?.focus()); };
  const progressOpen = profile.goal?.status === 'active' || !!profile.goal?.stretches?.some(tier => tier.status === 'active');
  const balance = profile.villager.coins;
  const options = kind === 'checkin' ? checkinChoices.map(item => item.label) : ["🗞️ What's new?", "🎯 How's the village doing?", '🙏 Make a prayer', '🎲 Play', `💰 Bribe · ${Math.min(50, balance)} coins`, '🤫 Rumours'];
  async function choose(index: number) {
    if (busy || reward || (kind === 'checkin' && index === 1 && !progressOpen)) return;
    if (kind === 'checkin' && index === 2) { onClose(); return; }
    if (kind === 'checkin') setLeaving(true);
    setChoice(index); setError('');
    const version = ++request.current;
    if (kind === 'checkin') return;
    if (index === 0 || index === 5) {
      setLoading(true); setAnswer(index === 5 ? 'Let me consult the noticeboard…' : 'Opening the Gazette…');
      try {
        const issue = await sceneGazette(village.id);
        if (version !== request.current) return;
        setAnswer(index === 5 ? issue?.gossip || 'The benches are plotting a longer lunch break. No fresh rumours have reached the noticeboard yet.' : issue ? `${issue.headline}. ${issue.body} ${issue.stories[0]?.body ?? ''}` : 'No Gazette has been published yet.');
      } catch (e) { if (version === request.current) { setError(errorText(e)); setAnswer('The noticeboard is a little out of reach. Try again when you are ready.'); } }
      finally { if (version === request.current) setLoading(false); }
    } else if (index === 1) {
      const leaders = [...village.villagers].sort((a,b) => b.xp-a.xp).slice(0,3).map(v => `${v.display_name}: ${v.xp} XP`).join(' · ');
      setAnswer(`${village.villagers.length} neighbors live here. ${week ? `${week.goals.filter(g => g.status === 'done' || g.grade?.completed).length} of ${week.goals.length} weekly goals completed.` : 'Weekly progress is still arriving.'} Village XP leaders: ${leaders}.`);
    } else setAnswer(index === 2 ? 'What should happen around town?' : index === 3 ? 'Here are our village games and challenges. Choose a challenge.' : `An offering starts at 1 coin. Your purse holds ${balance} coins. Choose your cost below; wishes are never guaranteed.`);
  }
  useEffect(() => { const frame = requestAnimationFrame(() => buttons.current?.querySelector('button')?.focus()); return () => cancelAnimationFrame(frame); }, []);
  const panel = choice !== null && (kind === 'checkin' || [2,3,4].includes(choice));
  return <Dialog closeDelay={0} title={kind === 'checkin' ? 'A moment with your villager' : 'A visit to the Mayor'} eyebrow="" className={`cinematic-scene ${kind}-scene`} onClose={onClose} busy={busy || !!reward} onKeyDown={e => {
      if (kind === 'checkin' && e.key === 'Tab' && (e.target as HTMLElement).closest('dialog') === e.currentTarget) {
        // Native dialogs may hand Tab to browser chrome at the last control.
        // Keep this conversation contained; a portalled camera dialog owns its own keys.
        const stops = [...e.currentTarget.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex]')]
          .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[aria-hidden="true"]') && el.getClientRects().length > 0);
        const first = stops[0], last = stops[stops.length - 1], active = document.activeElement;
        if (!first || !last) { e.preventDefault(); return; }
        if (e.shiftKey ? active === first || !stops.includes(active as HTMLElement) : active === last || !stops.includes(active as HTMLElement)) {
          e.preventDefault(); (e.shiftKey ? last : first).focus();
        }
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || (e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return;
      const index = Number(e.key)-1;
      if (choice === null && index >= 0 && index < options.length) { e.preventDefault(); void choose(index); }
    }}>
    <div className="scene-vignette" aria-hidden="true"/>
    {kind === 'checkin' && <div className="checkin-letterbox" aria-hidden="true"><span>VILLAGE / A LITTLE MOMENT</span><span>Small steps. Shared together.</span></div>}
    <div className={`scene-conversation ${panel ? 'has-form' : ''}`}>
      {kind === 'checkin' && <div className="checkin-portrait"><Portrait person={profile.villager} large/><span>Today, in my village</span></div>}
      <span className="scene-speaker">{kind === 'checkin' ? profile.villager.display_name : 'The Mayor'} <small>{kind === 'checkin' ? 'YOUR LITTLE CORNER' : 'KEEPER OF THE VILLAGE'}</small></span>
      <Typewriter text={reward ? `+${reward.xp} XP · +${reward.xp} coins. Check-in saved.` : answer}/>
      {loading && <p role="status">Reading the village journal…</p>}{error && <p role="alert">{error}</p>}
      {(choice === null || leaving) && !reward && <div ref={buttons} aria-hidden={leaving || undefined} className={`scene-choices ${leaving ? 'checkin-choices-leaving' : ''}`} aria-label="Dialogue choices">{options.map((label, index) => <button autoFocus={index === 0} key={label} disabled={leaving || (kind === 'checkin' && index === 1 && !progressOpen)} aria-describedby={kind === 'checkin' && index === 1 && !progressOpen ? 'scene-goal-hint' : undefined} onClick={() => void choose(index)}>{kind === 'checkin' ? <><span className="checkin-option-icon"><VillageIcon name={checkinChoices[index].icon} size={26}/></span><span className="checkin-option-copy"><strong>{label}</strong><small>{checkinChoices[index].hint}</small></span><kbd>{index+1}</kbd></> : <><kbd>{index+1}</kbd>{label}</>}</button>)}{kind === 'checkin' && !progressOpen && <p id="scene-goal-hint">Set an active weekly goal to share goal progress. <button className="text-button" disabled={leaving} onClick={onGoal}>{profile.goal?.status === 'done' ? '\u{1F680} Go beyond' : 'Set a weekly goal'}</button></p>}</div>}
      {choice !== null && <><button className="button secondary scene-back" disabled={busy} onClick={back}>{kind === 'checkin' ? '\u2190 choose again' : '\u2190 Back'}</button><EmbeddedDialog.Provider value={true}>
        {kind === 'checkin' && <CheckInDialogue key={choice} vid={village.id} profile={profile} initialKind={choice === 1 ? 'progress' : 'status'} onBusy={setBusy} onClose={() => { /* Submit owns the cheer and return transition. */ }} submit={submit}/>}
        {kind === 'mayor' && choice === 2 && <MayorModal vid={village.id} village={village} refresh={refresh} onClose={back} section="pray" onAnswer={setAnswer} onBusy={setBusy}/>}
        {kind === 'mayor' && choice === 3 && <><MayorModal vid={village.id} village={village} refresh={refresh} onClose={back} section="play"/><button className="button primary" onClick={onPlay}>Visit the Colosseum challenges</button></>}
        {kind === 'mayor' && choice === 4 && <BribePanel vid={village.id} balance={balance} refresh={refresh} onBusy={setBusy}/>}
      </EmbeddedDialog.Provider></>}
      {kind === 'checkin' && reward && <div className="checkin-stamp" role="status">Shared with the village</div>}
      <p className="scene-key-hint">{choice === null ? 'Number keys to choose · ' : ''}Esc returns to town</p>
    </div>
  </Dialog>;
}
