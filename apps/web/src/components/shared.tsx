import { placeholderFace, type FaceState } from './headPlayback';
import { ModalHeader } from './ModalHeader';
import { VillageIcon, toastIcons, type VillageIconName, type ToastKind } from './VillageIcon';
import { CurrencyIcon, CurrencyText, Reward } from './Currency';
import { sound } from '../sound/engine';
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type KeyboardEventHandler } from 'react';
import { X, Sprout, Flame } from 'lucide-react';
import { LamHead } from './LamHead';
import { GaussianHead, type HeadVoice } from './GaussianHead';
import { api } from '../api/client';
import type { Villager } from '../api/types';

export const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
export function when(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export async function mediaUrl(url: string) {
  const parsed = new URL(url, location.origin);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('This media URL is not supported.');
  const proxiedOrigin = [location.origin, 'http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:8010', 'http://127.0.0.1:8010'].includes(parsed.origin);
  if (proxiedOrigin && parsed.pathname.startsWith('/api/assets/')) {
    const blob = await api.request<Blob>('GET', parsed.pathname.slice(4) + parsed.search);
    return URL.createObjectURL(blob);
  }
  if (parsed.origin !== location.origin && parsed.protocol !== 'https:') throw new Error('Media must use HTTPS.');
  return parsed.href;
}

// Share one authenticated fetch across HUD, scene labels, feed and inbox. Release after
// the last consumer leaves (delay also covers StrictMode and quick panel switches).
const portraits = new Map<string, { promise: Promise<string>; refs: number; timer?: ReturnType<typeof setTimeout> }>();
export function acquirePortrait(key: string, load: () => Promise<string>) {
  let entry = portraits.get(key);
  if (!entry) { entry = { promise: load(), refs: 0 }; portraits.set(key, entry); }
  clearTimeout(entry.timer); entry.refs++;
  const current = entry;
  return { promise: current.promise, release: () => {
    if (--current.refs === 0) current.timer = setTimeout(() => {
      portraits.delete(key);
      void current.promise.then(url => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); }).catch(() => {});
    }, 1000);
  } };
}

/** Stable portrait slot: image today, LAM renderer can mount here when its package format lands. */
export function Portrait({ person, large = false, animate = false, voice, onHeadState, cacheHead = false }: { person: Villager; large?: boolean; animate?: boolean; voice?: HeadVoice; onHeadState?: (state: FaceState) => void; cacheHead?: boolean }) {
  const [source, setSource] = useState<string | null>(null);
  const headState = useRef(onHeadState); headState.current = onHeadState;
  const revisionUrl = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new URL(value, location.origin);
    parsed.searchParams.set('rev', String(person.avatar.revision));
    return parsed.href;
  };
  const url = revisionUrl(person.avatar.portrait.asset_url);
  const headUrl = revisionUrl(person.avatar.portrait.head_package_url);
  useEffect(() => {
    let active = true;
    setSource(null);
    const cached = url ? acquirePortrait(`${api.mode}:${api.user}:${person.avatar.revision}:${url}`, () => mediaUrl(url)) : null;
    void cached?.promise.then(value => { if (active) setSource(value); }).catch(() => { if (active) headState.current?.('failed'); });
    return () => { active = false; cached?.release(); };
  }, [url, person.avatar.revision, api.user, api.mode]);
  useEffect(() => { if (!animate || person.avatar.portrait.kind !== 'lam_head' || !/\.zip(?:\?|$)/i.test(person.avatar.portrait.head_package_url ?? '')) headState.current?.(url ? 'loading' : 'ready'); }, [animate, headUrl, url]);
  return <span className={`portrait ${large ? 'large' : ''} ${animate && person.avatar.portrait.kind === 'lam_head' ? 'head-portrait' : ''}`} style={{ background: person.equipped.find(i => i.slot === 'torso')?.colors?.primary ?? person.avatar.body.colors.shirt }} data-portrait-kind={person.avatar.portrait.kind}>
    {animate && person.avatar.portrait.kind === 'lam_head' && /\.zip(?:\?|$)/i.test(person.avatar.portrait.head_package_url ?? '') ? <GaussianHead key={person.user_id} packageUrl={headUrl!} photo={source} name={person.display_name} voice={voice} onState={onHeadState} cacheHead={cacheHead} /> : animate && person.avatar.portrait.kind === 'lam_head' ? <LamHead packageUrl={person.avatar.portrait.head_package_url} photo={source} name={person.display_name} /> : source ? <img src={source} alt={person.display_name} onLoad={() => requestAnimationFrame(() => headState.current?.('ready'))} onError={() => {setSource(null);headState.current?.('failed');}} /> : person.display_name.slice(0, 2)}
    {placeholderFace(person) && <small className="placeholder-label">placeholder face</small>}
    {person.has_crown && <span className="portrait-crown" role="img" aria-label="Crown"><VillageIcon name="crown" size={14}/></span>}
  </span>;
}
export function XpBar({ person }: { person: Villager }) {
  const floor = (person.level - 1) ** 2 * 50, next = person.level ** 2 * 50;
  return <div className="xp-block"><div className="xp-caption"><span><Sprout size={14} /> Level {person.level}</span><span><CurrencyIcon currency="XP" />{person.xp} / {next} XP</span></div><div className="xp-track" role="progressbar" aria-label={`${person.display_name}'s level progress`} aria-valuemin={floor} aria-valuemax={next} aria-valuenow={person.xp}><i style={{ width: `${Math.max(0, Math.min(100, (person.xp - floor) / (next - floor) * 100))}%` }} /></div></div>;
}
export function Streak({ days }: { days: number }) { return <span className="streak"><Flame size={14} /> {days} day streak</span>; }
export const EmbeddedDialog = createContext(false);
type DialogProps = { closeDelay?: number; onKeyDown?: KeyboardEventHandler<HTMLDialogElement>; active?: boolean; title: string; eyebrow: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean; className?: string };
export function Dialog(props: DialogProps) {
  const embedded = useContext(EmbeddedDialog);
  return embedded ? <section className="scene-form" aria-label={props.title}><p className="eyebrow">{props.eyebrow}</p><h2>{props.title}</h2>{props.children}</section> : <ModalDialog {...props}/>;
}
function ModalDialog({ closeDelay = 160, onKeyDown, title, eyebrow, children, onClose, busy = false, wide = false, className = '', active = true }: DialogProps) {
  const titleId = useId();
  const opener = useRef(active ? document.activeElement as HTMLElement | null : null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const close = () => {
    if (busy || closing) return;
    if (closeDelay === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return; }
    setClosing(true);
    closeTimer.current = setTimeout(onClose, closeDelay);
  };
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (!active) return;
    const previous = opener.current ?? document.activeElement as HTMLElement | null;
    opener.current = null;
    setClosing(false);
    el.showModal();
    // React's autoFocus runs before showModal; explicitly focus after entering the top layer.
    el.querySelector<HTMLElement>('textarea, input:not([type="file"])')?.focus();
    return () => { clearTimeout(closeTimer.current); el.close(); if (previous?.isConnected) previous.focus(); };
  }, [active]);
  return <dialog ref={ref} aria-hidden={!active || undefined} onKeyDown={e => { onKeyDown?.(e); e.stopPropagation(); }} className={`modal ${wide ? 'wide' : ''} ${className} ${closing ? 'is-closing' : ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) close(); }} onClick={event => { if (event.target === ref.current && !busy) { const r = ref.current.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } }}>
    {/* The root notification viewport portals into the active dialog. */}
    <ModalHeader title={title} titleId={titleId} eyebrow={eyebrow} onClose={close} disabled={busy || closing} />
    {children}
  </dialog>;
}
export function blip() { sound.play('xp_ding'); }

/** Reserve panel space while retaining a single, readable loading announcement. */
export function PanelSkeleton({ label = 'Getting things ready...' }: { label?: string }) {
  return <div className="panel-skeleton" role="status"><span>{label}</span><div aria-hidden="true"><i /><i /><i /></div></div>;
}
export function EmptyState({ children, symbol = 'sprout' }: { children: ReactNode; symbol?: VillageIconName }) {
  return <div className="empty-state"><span aria-hidden="true"><VillageIcon name={symbol} size={28}/></span><p>{children}</p></div>;
}
