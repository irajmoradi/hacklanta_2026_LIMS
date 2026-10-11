import type { FaceState } from './headPlayback';
import { ModalHeader } from './ModalHeader';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { configureHeadControls } from './headControls';
import './HeadStudio.css';
import { api } from '../api/client';
import { scheduleHead, type ExprData, type LamHead } from './lamRuntime';

export type HeadVoice = { audio: HTMLAudioElement; expr: ExprData | null };
export function GaussianHead({ packageUrl, photo, name, voice, onState, cacheHead = false }: { packageUrl: string; photo: string | null; name: string; voice?: HeadVoice; onState?: (state: FaceState) => void; cacheHead?: boolean }) {
  const host = useRef<HTMLSpanElement>(null), head = useRef<LamHead>();
  const [state, setState] = useState('loading');
  const notify = useRef(onState); notify.current = onState;
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), expandButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const collapse = () => {
    restoreFocus.current = true;
    // Moving out of the portal remounts the portrait renderer. Its opener is
    // absent while loading, so restore focus only when it is mounted again.
    setState('loading');
    setExpanded(false);
  };
  const reset = useRef(() => {});
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
  }, [expanded]);
  const [tabVisible, setTabVisible] = useState(document.visibilityState === 'visible');
  const [modalVisible, setModalVisible] = useState(true);
  const [intersecting, setIntersecting] = useState(false);
  const visible = tabVisible && intersecting && modalVisible;
  useEffect(() => {
    if (!expanded && restoreFocus.current && state === 'ready' && visible && expandButton.current) {
      expandButton.current.focus({preventScroll:true});
      restoreFocus.current = false;
    }
  }, [expanded, state, visible]);
  useEffect(() => { notify.current?.(visible ? state as FaceState : 'loading'); }, [state, visible]);
  useEffect(() => {
    const update = () => {
      const top = [...document.querySelectorAll('dialog[open]')].at(-1);
      setModalVisible(!top || !!host.current && top.contains(host.current));
    };
    const observer = new window.MutationObserver(update);
    observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['open']});
    update();
    return () => observer.disconnect();
  }, [expanded]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setIntersecting(entries.some(entry => entry.isIntersecting)));
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [expanded]);
  useEffect(() => { const update = () => setTabVisible(document.visibilityState === 'visible'); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []);
  useEffect(() => {
    if (!visible || !host.current) return;
    let active = true, dispose: (() => void) | undefined;
    setState('loading');
    // Includes auth and queue time. The package cannot abort an in-flight mount;
    // its eventual handle is disposed before another singleton mount can start.
    const timer = setTimeout(() => { active = false; dispose?.(); head.current = undefined; setState('failed'); }, 30000);
    void (async () => {
      // Credentials may only go to our API, never to a manifest-supplied external origin.
      const url = new URL(packageUrl, location.origin);
      if (![location.origin, 'http://localhost:8010', 'http://127.0.0.1:8010'].includes(url.origin) || !url.pathname.startsWith('/api/assets/')) throw new Error('Unsupported head URL');
      const headers = await api.authHeaders();
      if (!active) return;
      dispose = scheduleHead(host.current!, { packageUrl: url.pathname + url.search, headers, backgroundColor: expanded ? '0x121720' : '0xf0f3e7' }, value => { requestAnimationFrame(() => requestAnimationFrame(() => { if (!active) return; clearTimeout(timer); head.current = value; reset.current = configureHeadControls(value); setState('ready'); })); }, () => { clearTimeout(timer); setState('failed'); }, cacheHead);
    })().catch(() => { clearTimeout(timer); if (active) setState('failed'); });
    return () => { clearTimeout(timer); active = false; head.current = undefined; dispose?.(); };
  }, [packageUrl, visible, expanded, cacheHead]);
  useEffect(() => { head.current?.setAudio(voice?.audio ?? null); head.current?.setExpr(voice?.expr ?? null); }, [voice, state]);
  const content = <span className="lam-head" data-head-state={visible ? state : 'hidden'}>
    {(state !== 'ready' || !visible) && (photo ? <img src={photo} alt={name} /> : <span>{name.slice(0, 2)}</span>)}
    <span ref={host} className="lam-canvas" role="img" onDoubleClick={() => reset.current()} aria-label={`${name}'s animated head`} style={{ visibility: state === 'ready' && visible ? 'visible' : 'hidden' }} />
    {visible && state === 'loading' && <span className="head-shimmer" role="status">Loading 3D portrait…</span>}
    {state === 'failed' && <small className="head-fallback">Photo preview</small>}
    {state === 'ready' && visible && <span className="head-tools"><button type="button" onClick={() => reset.current()} aria-label="Reset head view">Reset</button>{!expanded && <button type="button" ref={expandButton} onClick={() => setExpanded(true)} aria-label="Open big head view">&#10530;</button>}</span>}
  </span>;
  return expanded ? createPortal(<dialog ref={dialog} className="head-stage" aria-label={`${name} — big head view`} onKeyDown={e => e.stopPropagation()} onCancel={e => {e.preventDefault();e.stopPropagation();collapse();}}><ModalHeader title={name} eyebrow="BIG HEAD VIEW" onClose={collapse} closeLabel="Close big head view" />{content}<p>Drag to rotate · Scroll or pinch to zoom · Double-click to reset</p></dialog>, document.body) : content;
}
