import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Diamond, X } from 'lucide-react';
import { VillageIcon, toastIcons } from './VillageIcon';
import { CurrencyIcon, CurrencyText } from './Currency';
import { toastStore, toast, dismissToast, type Toast } from './toastStore';
export { toast, dismissToast } from './toastStore';
export function useToast() { return {toast, dismiss: dismissToast}; }

type Rect = {left: number; right: number; top: number; bottom: number};
// Find the highest free strip, then center in its widest usable interval.
export function toastPlacement(width: number, height: number, top: number, obstacles: Rect[], cardHeight: number) {
  const minimum = Math.min(280, width - 24);
  for (const y of [top, ...obstacles.map(r => r.bottom + 12).filter(y => y >= top)].sort((a,b) => a-b)) {
    if (y + cardHeight > height - 12) continue;
    let intervals = [[12, width - 12]];
    for (const r of obstacles.filter(r => r.top < y + cardHeight && r.bottom > y)) {
      intervals = intervals.flatMap(([l,h]) => r.right + 12 <= l || r.left - 12 >= h ? [[l,h]] : [[l, Math.max(l,r.left-12)], [Math.min(h,r.right+12),h]]);
    }
    const room = intervals.filter(([l,h]) => h-l >= minimum).sort((a,b) => (b[1]-b[0])-(a[1]-a[0]))[0];
    if (room) {
      const w = Math.min(380, room[1]-room[0]);
      return {left: (room[0]+room[1]-w)/2, top:y, width:w};
    }
  }
  return null;
}

function MomentArt({icon}: {icon?: string}) {
  return <div className="toast-illustration" aria-hidden="true"><svg viewBox="0 0 180 68"><ellipse cx="90" cy="58" rx="75" ry="8" fill="#dde5c6"/><path d="M33 55V30L51 15 69 30V55M105 55V23L126 7 147 23V55" fill="#edc78c" stroke="#896c45" strokeWidth="2"/><path d="M26 31L51 10 76 31M98 24L126 2 154 24" fill="none" stroke="#70865d" strokeWidth="5" strokeLinecap="round"/><path d="M47 55V39H57V55M120 55V35H132V55" fill="#faf7ea"/><circle cx="89" cy="40" r="12" fill="#93ac79"/><path d="M89 49V59" stroke="#70865d" strokeWidth="3"/></svg><span>{icon ?? '🏆'}</span></div>;
}

export function ToastCard({item}: {item: Toast}) {
  const [closing, setClosing] = useState(false), [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [busy, setBusy] = useState(false);
  const paused = hovered || focused || busy;
  const remaining = useRef(item.duration), started = useRef(0);
  const close = () => setClosing(true);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => dismissToast(item.id), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
    return () => clearTimeout(timer);
  }, [closing, item.id]);
  useEffect(() => {
    if (!item.duration || paused || closing) return;
    started.current = performance.now();
    const timer = setTimeout(close, remaining.current);
    return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (performance.now()-started.current)); };
  }, [item.duration, paused, closing]);
  const icon = item.kind === 'reward' && item.currency ? (item.currency === 'diamonds' ? <Diamond size={20}/> : <CurrencyIcon currency={item.currency}/>) : <VillageIcon name={toastIcons[item.kind]} size={20}/>;
  return <article className={`village-toast ${item.variant === 'moment' ? 'toast-moment' : ''} ${closing ? 'toast-leaving' : ''}`} data-kind={item.kind} data-toast-id={item.id}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={e => {if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);}}
    style={{'--toast-duration':`${item.duration}ms`, '--toast-play':paused ? 'paused' : 'running'} as CSSProperties}>
    {item.variant === 'moment' && <><MomentArt icon={item.icon}/><div className="toast-confetti" aria-hidden="true">{Array.from({length:16},(_,i)=><i key={i} style={{left:`${i*37%100}%`,background:['#cfa651','#85a77c','#b98289','#86a6bc'][i%4],animationDelay:`${i%4*60}ms`}}/>)}</div></>}
    <div className="toast-content"><span className="toast-icon" aria-hidden="true">{item.thumbnail ? <img src={item.thumbnail} alt=""/> : item.icon && item.variant !== 'moment' ? item.icon : icon}</span>
      <div className="toast-copy" role={item.kind === 'error' ? 'alert' : 'status'} aria-live={item.kind === 'error' ? 'assertive' : 'polite'} aria-atomic="true"><strong>{item.amount !== undefined && <span className="toast-amount">+{item.amount} {item.currency ?? 'coins'} · </span>}{<CurrencyText text={item.title}/>}</strong>{item.detail && <p title={item.detail}>{item.detail}</p>}</div>
      {item.action && <button className="toast-action" disabled={busy} onClick={async () => {setBusy(true);try {await item.action!.onClick();close();} catch(e) {toast({kind:'error',title:'Action could not finish',detail:e instanceof Error ? e.message : 'Please try again.'});} finally {setBusy(false);}}}>{item.action.label}</button>}
      <button className="toast-close" aria-label={`Dismiss ${item.title}`} onClick={close}><X size={16}/></button>
    </div>{item.duration > 0 && <div className="toast-progress" aria-hidden="true"><i/></div>}
  </article>;
}

export function ToastViewport() {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.snapshot);
  // A manual popover escapes a scrolled dialog's clipping while remaining its focusable descendant.
  // QA13-01: never let a popover call throw (detached node or already open) and blank the app during an outage.
  const layer = useCallback((node: HTMLElement | null) => { if (!node?.showPopover || !node.isConnected || node.matches(':popover-open')) return; try { node.showPopover(); } catch { /* keep rendering */ } }, []);
  const [layout, setLayout] = useState<{left:number;top:number;width:number;count:number;host:HTMLElement} | null>(null);
  const moment = items[0]?.variant === 'moment';
  useLayoutEffect(() => {
    if (!items.length) {setLayout(null); return;}
    let frame = 0;
    // Reserve a single-card lane for full-screen panels/dialogs; additional cards queue if space is tight.
    document.body.classList.add('has-notifications');
    const measure = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
      const host = dialogs.at(-1) ?? document.body;
      const bar = document.querySelector('.topbar')?.getBoundingClientRect();
      const top = Math.max(12, (bar?.bottom ?? 64) + 12);
      document.body.style.setProperty('--toast-reserve', `${top + (moment ? 164 : 76) + 12}px`);
      const selectors = '.profile-panel, .dashboard:not(.is-collapsed), .widget-popout, .action-dock, dialog[open], .disaster-banner, .alerts-dropdown' + (innerWidth > 1050 ? ',.welcome' : '');
      const obstacles = Array.from(document.querySelectorAll<HTMLElement>(selectors)).filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map(el => el.getBoundingClientRect());
      let next = null;
      for (let count = Math.min(3,items.length); count > 0; count--) {
        const h = items.slice(0,count).reduce((sum,item) => sum + (item.variant === 'moment' ? 164 : 76) + 8, -8);
        const placement = toastPlacement(innerWidth,innerHeight,top,obstacles,h);
        if (placement) {next = {...placement,count,host};break;}
      }
      setLayout(old => JSON.stringify(old && {...old,host:undefined}) === JSON.stringify(next && {...next,host:undefined}) && old?.host === next?.host ? old : next);
    };
    const schedule = () => {if (!frame) frame=requestAnimationFrame(() => {frame=0;measure();});};
    const watched = '.app,.topbar,.profile-panel,.dashboard,.widget-popout,.action-dock,dialog,.disaster-banner,.alerts-dropdown';
    // Scene labels update their inline transforms every frame. Only panel geometry matters here.
    const observer = new MutationObserver(changes => {
      if (changes.some(change => change.type === 'attributes'
        ? change.target instanceof Element && change.target.matches(watched)
        : [...change.addedNodes,...change.removedNodes].some(node => node instanceof Element && (node.matches(watched) || node.querySelector(watched))))) schedule();
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','class','style']});
    const resize = new ResizeObserver(schedule);resize.observe(document.documentElement);
    window.addEventListener('resize',schedule);window.addEventListener('pointermove',schedule);window.addEventListener('transitionend',schedule);
    measure();
    return () => {observer.disconnect();resize.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.removeEventListener('pointermove',schedule);window.removeEventListener('transitionend',schedule);document.body.classList.remove('has-notifications');document.body.style.removeProperty('--toast-reserve');};
  }, [items, moment]);
  if (!layout || !items.length) return null;
  return createPortal(<section ref={layer} popover="manual" className="toast-viewport" aria-label="Notifications" style={{left:layout.left,top:layout.top,width:layout.width}}>{items.slice(0,layout.count).map(item => <ToastCard key={item.id} item={item}/>)}</section>,layout.host);
}

/** Bridge existing state-based feedback into the same queue, without changing form validation. */
export function ToastNotice({message, kind = 'success'}: {message: string; kind?: Toast['kind']}) {
  useEffect(() => {if(message) toast({title:message,kind});},[message,kind]);
  return null;
}
