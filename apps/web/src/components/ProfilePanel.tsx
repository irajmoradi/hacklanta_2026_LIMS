import { badgeLabel } from './badgeLabel';
import { lazyPanel } from './lazyPanel';
import { GoalStretch } from './GoalStretch';
import { clockedVoice, placeholderFace, waitForFaces } from './headPlayback';
import { ModalHeader } from './ModalHeader';
import { VillageIcon } from './VillageIcon';
const HeadStudio = lazyPanel(() => import('./HeadStudio').then(m => ({default:m.HeadStudio})));
const HouseInterior = lazyPanel(() => import('./HouseInterior').then(m => ({default:m.HouseInterior})));
const MakeItReal = lazyPanel(() => import('./MakeItReal').then(m => ({default:m.MakeItReal})));
import { ProfileIdleActivity } from './IdleActivityPicker';
import { ReactionBar } from './ReactionBar';
const HouseEditor = lazyPanel(() => import('./HouseEditor').then(m => ({default:m.HouseEditor})));
const ProfileOutfit = lazyPanel(() => import('./ProfileOutfit').then(m => ({default:m.ProfileOutfit})));
import { PresenceDot } from './Presence';
import { SocialActions } from './Messages';
import { ProfileRewards, ProfileNews } from './ProfileSections';
import { Evidence } from './Evidence';
import { useEffect, useId, useRef, useState } from 'react';
import { Volume2, Check, Flag, ArrowUpRight, Settings } from 'lucide-react';
import { AvatarStep } from './Onboarding';
import { ReviewBadge } from './AgentPanel';
import { pollExpression } from './voiceMotion';
import type { HeadVoice } from './GaussianHead';
import { api } from '../api/client';
import type { Profile } from '../api/types';
import { PanelSkeleton, EmptyState, errorText, mediaUrl, Portrait, Streak, when, XpBar } from './shared';

export function ProfilePanel({ profile, loading, error, onRetry, onClose, onCheckIn, mine, vid, owner, refresh, onSettings, onMessage, onShopItem, houseTarget = 0, accomplishmentTarget = 0 }: { houseTarget?: number; accomplishmentTarget?: number; onShopItem: (id: string) => void; onMessage?: () => void; onSettings: () => void; profile: Profile | null; loading: boolean; error: string; onRetry: () => void; onClose: () => void; onCheckIn: () => void; mine: boolean; vid: string; owner: boolean; refresh: () => Promise<void> }) {
  const [inside, setInside] = useState(false);
  const interiorOpener = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const opener = useRef(document.activeElement as HTMLElement | null);
  const surface = useRef<HTMLDialogElement>(null);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width:1050px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width:1050px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const el = surface.current;
    // Only one modal owns the top layer, including when the viewport changes
    // while an interior is open. Reopen the profile after leaving the room.
    if (mobile && !inside) el?.showModal();
    if (!inside) {
      (interiorOpener.current?.isConnected ? interiorOpener.current : close.current)?.focus();
      interiorOpener.current = null;
    }
    return () => { if (mobile) el?.close(); };
  }, [mobile, inside]);
  const Surface = mobile ? 'dialog' : 'aside';
  const [tab, setTab] = useState<'overview' | 'accomplishments' | 'outfit' | 'house' | 'rewards' | 'activity'>(houseTarget ? 'house' : accomplishmentTarget ? 'accomplishments' : 'overview');
  useEffect(() => { if (houseTarget) setTab('house'); }, [houseTarget]);
  useEffect(() => { if (accomplishmentTarget) setTab('accomplishments'); }, [accomplishmentTarget]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false), [actionError, setActionError] = useState(''), [actionBusy, setActionBusy] = useState(false);
  const [voiceState, setVoiceState] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [sillyBusy, setSillyBusy] = useState(false);
  const [lipSync, setLipSync] = useState<'approximate' | 'Audio2Expression' | null>(null);
  const [voice, setVoice] = useState<HeadVoice>();
  const stopVoice = useRef<() => void>(() => {});
  const audio = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { close.current?.focus(); return () => { if (opener.current?.isConnected) opener.current.focus(); }; }, []);
  useEffect(() => {
    generation.current++; setVoiceState(''); setSpeaking(false); setLipSync(null); setVoice(undefined);
    return () => { generation.current++; stopVoice.current(); if (audio.current) { audio.current.pause(); if (audio.current.src.startsWith('blob:')) URL.revokeObjectURL(audio.current.src); audio.current = null; } };
  }, [profile?.villager.user_id]);
  async function hear() {
    if (!profile || speaking || placeholderFace(profile.villager)) return;
    const current = generation.current; stopVoice.current(); setSpeaking(true); setVoiceState('');
    const controller = new AbortController();
    let context: AudioContext | undefined;
    try { context = new AudioContext(); void context.resume().catch(() => {}); } catch { /* Playback works without WebAudio. */ }
    let stopMotion = () => {};
    stopVoice.current = () => { controller.abort(); stopMotion(); if (context && context.state !== 'closed') void context.close(); };
    try {
      const result = await api.voice(profile.villager.user_id, profile.villager.status_line || `Hello from ${profile.villager.display_name}!`, vid);
      if (current !== generation.current) return;
      if (!result.audio_url) { setVoiceState('Their voice is not connected yet. Come back soon.'); setSpeaking(false); setLipSync(null); stopVoice.current(); return; }
      const source = await mediaUrl(result.audio_url);
      if (current !== generation.current) { if (source.startsWith('blob:')) URL.revokeObjectURL(source); return; }
      if (!context) throw new Error('Audio is unavailable in this browser.');
      let buffer: AudioBuffer;
      try { buffer = await context.decodeAudioData(await (await fetch(source, {signal:controller.signal})).arrayBuffer()); }
      finally { if (source.startsWith('blob:')) URL.revokeObjectURL(source); }
      controller.signal.throwIfAborted();
      const playback = clockedVoice(context, buffer); stopMotion = playback.stop;
      setVoice({audio:playback.audio, expr:playback.expr});
      const exprUrl = result.expr_url ?? `/api/assets/avatars/${profile.villager.user_id}/voice/${result.id}/line_expr.json`;
      if (api.mode !== 'mock') void pollExpression(exprUrl, controller.signal).then(expr => { if (expr && !controller.signal.aborted) {setVoice({audio:playback.audio,expr});setLipSync('Audio2Expression');} }).catch(() => {});
      await waitForFaces(['profile'], () => surface.current?.querySelector('[data-head-state="loading"], [data-head-state="hidden"]') ? 'loading' : 'ready', controller.signal);
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      controller.signal.throwIfAborted(); playback.start(); setLipSync('approximate');
      await playback.ended;
      if (current === generation.current) {setSpeaking(false);setLipSync(null);setVoice(undefined);}
      stopVoice.current();
    } catch (e) { if (current === generation.current) { stopVoice.current(); setVoiceState(errorText(e)); setSpeaking(false); setLipSync(null); } }
  }
  return <><Surface ref={surface} className="profile-panel" aria-label="Villager profile" onCancel={e => { if (e.target !== e.currentTarget) return; e.preventDefault(); onClose(); }} onKeyDown={e => { if (!mobile && e.key === 'Escape') onClose(); }}>
    <ModalHeader title={mine ? 'Your profile' : 'Villager profile'} eyebrow={mine ? 'THIS IS YOU' : 'YOUR NEIGHBOR'} onClose={onClose} closeLabel="Close profile" closeRef={close} />
    {loading ? <PanelSkeleton label="Visiting your neighbor..." /> : error ? <div><p role="alert" className="form-error">{error}</p><button className="button secondary" onClick={onRetry}>Retry profile</button></div> : profile && <>
      <div className="profile-hero"><Portrait person={profile.villager} large /><div className="profile-name"><h2>{profile.villager.display_name}</h2><PresenceDot user={profile.villager.user_id} />{mine && <button className="icon-button profile-settings" aria-label="Profile settings" title="Profile settings" onClick={onSettings}><Settings size={16} /></button>}</div><XpBar person={profile.villager} /><small>Treasury (devnet): {profile.villager.treasury_xp ?? 0} personal XP &middot; counts toward auditor selection</small><div className="profile-honors">{profile.villager.has_crown && <span>Weekly crown</span>}{profile.villager.star_badges?.map(b => <span key={b.week_start + b.kind}>{badgeLabel(b.kind, b.week_start)}</span>)}</div><Streak days={profile.villager.streak_days} /><p className="status-line">“{profile.villager.status_line || 'A new day in the village.'}”</p><button className="text-button hear-button" disabled={speaking || sillyBusy || placeholderFace(profile.villager)} onClick={() => void hear()}><Volume2 size={15} /> {speaking ? 'Listening…' : 'Hear them'}</button><p className="help-text">AI-generated voice</p>{speaking && lipSync && profile.villager.avatar.portrait.kind === 'lam_head' && /\.zip(?:\?|$)/i.test(profile.villager.avatar.portrait.head_package_url ?? '') && <small className="lip-sync-hint" role="status">lip-sync: {lipSync}</small>}{voiceState && <p className="help-text" role="status">{voiceState}</p>}</div>
      <div className="profile-tabs" role="tablist" aria-label="Profile tabs" onKeyDown={e => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const tabs = ['overview', 'accomplishments', 'outfit', 'house', 'rewards', 'activity'] as const;
        const next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        setTab(next); document.getElementById(`${panelId}-${next}`)?.focus();
      }}>{(['overview', 'accomplishments', 'outfit', 'house', 'rewards', 'activity'] as const).map(value => <button key={value} id={`${panelId}-${value}`} role="tab" aria-selected={tab === value} aria-controls={`${panelId}-panel`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
      <div className="profile-tab-content" key={tab} id={`${panelId}-panel`} role="tabpanel" aria-labelledby={`${panelId}-${tab}`} tabIndex={0}>
      {tab === 'overview' && <HeadStudio key={profile.villager.user_id} people={[profile.villager]} vid={vid} externalVoice={voice} onBusyChange={setSillyBusy} onStart={() => {generation.current++;stopVoice.current();audio.current?.pause();setSpeaking(false);setVoice(undefined);}} />}
      {tab === 'accomplishments' && <ProfileNews vid={vid} uid={profile.villager.user_id} person={profile.villager} accomplishments />}
      {tab === 'outfit' && <><ProfileOutfit onShopItem={onShopItem} person={profile.villager} mine={mine} vid={vid} refresh={refresh} section="outfit" />{mine && <div className="profile-tools"><button className="button secondary" onClick={() => setAvatarOpen(v => !v)}>Customize my avatar</button>{avatarOpen && <><ProfileIdleActivity person={profile.villager} refresh={refresh} /><MakeItReal vid={vid} refresh={refresh} /><AvatarStep uid={profile.villager.user_id} person={profile.villager} onChanged={refresh} /></>}</div>}</>}
      {tab === 'house' && <><button className="button secondary full" onClick={e => { interiorOpener.current = e.currentTarget; setInside(true); }}>Go inside</button>{!inside && !editorOpen && <ProfileOutfit onShopItem={onShopItem} person={profile.villager} mine={mine} vid={vid} refresh={refresh} section="house" onClose={onClose} />}{mine && <><button className="button secondary full" onClick={() => setEditorOpen(v => !v)}>{editorOpen ? 'Close house editor' : 'Edit my house'}</button>{editorOpen && <HouseEditor onClose={() => setEditorOpen(false)} key={vid + profile.villager.user_id} person={profile.villager} vid={vid} refresh={refresh} />}</>}</>}
      {tab === 'rewards' && <ProfileRewards profile={profile} mine={mine} vid={vid} />}
      {tab === 'activity' && <ProfileNews vid={vid} uid={profile.villager.user_id} person={profile.villager} />}
      {tab === 'overview' && <div className="profile-overview">
      {!mine && onMessage && <SocialActions vid={vid} user={profile.villager.user_id} onMessage={onMessage} refresh={refresh} />}
      <section className="profile-section"><div className="section-label"><Flag size={14} /> THIS WEEK’S GOAL</div>{profile.goal ? <><h3>{profile.goal.title}</h3>{profile.goal.detail && <p>{profile.goal.detail}</p>}<span className="goal-progress"><span className="small-check"><Check size={12} /></span> {profile.check_ins.filter(c => c.kind === 'progress' && c.goal_id === profile.goal?.id).length} progress check-ins</span></> : <p>No goal set this week.</p>}{profile.goal && <p className="help-text">Goal: {profile.goal.status}</p>}{profile.goal && <ReactionBar key={api.user + profile.goal.id} vid={vid} target_kind="goal" target_id={profile.goal.id} reactions={profile.goal.reactions} />}{profile.goal?.status === 'active' && (mine || owner) && <div className="goal-actions">{(['done', 'missed'] as const).map(status => <button className="button secondary" key={status} disabled={actionBusy} onClick={() => { setActionBusy(true); setActionError(''); void api.goalStatus(vid, profile.goal!.id, status).then(refresh).catch(e => setActionError(errorText(e))).finally(() => setActionBusy(false)); }}>Mark {status}</button>)}</div>}<button className="text-button" onClick={() => setTab('accomplishments')}>{mine ? 'See my accomplishments' : 'See their accomplishments'}</button><GoalStretch vid={vid} profile={profile} editable={mine} refresh={refresh} />{actionError && <p role="alert">{actionError}</p>}{mine && <button className="text-button" onClick={onCheckIn}>Share progress <ArrowUpRight size={14} /></button>}</section>
      <section className="profile-section"><div className="section-label">RECENT CHECK-INS</div><div className="checkin-list">{profile.check_ins.slice(0, 2).map(c => <article key={c.id}><div className="checkin-meta"><span><VillageIcon name={c.kind === 'progress' ? 'flag' : 'sun'} size={14}/> {c.kind === 'progress' ? 'Progress' : 'Daily note'}</span><time dateTime={c.created_at}>{when(c.created_at)}</time></div><p>{c.body}</p><ReviewBadge checkIn={c} vid={vid} owner={owner} refresh={refresh} />{c.evidence_url && <Evidence url={c.evidence_url} review={c.review} vid={vid} checkId={c.id} />}</article>)}{!profile.check_ins.length && <EmptyState>No check-ins yet.</EmptyState>}</div></section>
      <ProfileNews vid={vid} uid={profile.villager.user_id} person={profile.villager} accomplishments />
    </div>}
      </div>
    </>}
  </Surface>{inside && profile && <HouseInterior person={profile.villager} vid={vid} onClose={() => setInside(false)} />}</>;
}
