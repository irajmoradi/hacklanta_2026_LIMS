import {useEffect, useRef, useState, type RefObject} from 'react';
import {createPortal} from 'react-dom';

const leaveEvent = 'village-house-leave';
function requestLeave(action: () => void) {
  const event = new CustomEvent(leaveEvent, {cancelable:true, detail:action});
  window.dispatchEvent(event);
  if (!event.defaultPrevented) action();
}

/** Intercept navigation before its click handler can unmount a dirty editor. */
export function useHouseLeaveGuard({scope, dirty, busy = false, save, discard, escape, cancelOnEscape = false}: {
  scope: RefObject<HTMLElement>; dirty: boolean; busy?: boolean;
  save: () => boolean | Promise<boolean>; discard: () => boolean | Promise<boolean>; escape: () => void; cancelOnEscape?: boolean;
}) {
  const selectValues = useRef(new WeakMap<HTMLSelectElement, string>());
  const [next, setNext] = useState<(() => void) | null>(null);
  const [failure, setFailure] = useState('');
  const [working, setWorking] = useState(false);
  const prompt = useRef<HTMLDialogElement>(null), bypass = useRef(false), returnFocus = useRef<HTMLElement | null>(null);
  function leave(action: () => void) { if (dirty || busy) {returnFocus.current = document.activeElement as HTMLElement; setFailure(''); setNext(() => action);} else action(); }
  useEffect(() => {
    if (!next) return;
    const opener = returnFocus.current;
    const element = prompt.current;
    element?.showModal();
    return () => {element?.close(); if (opener?.isConnected) opener.focus();};
  }, [next]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (bypass.current || (!dirty && !busy) || (e.target as Element).closest('.house-leave-dialog')) return;
      const target = (e.target as Element).closest<HTMLElement>('button,a,[role="tab"],canvas');
      if (!target || scope.current?.contains(target)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      leave(() => {
        bypass.current = true;
        try {target.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, clientX:e.clientX, clientY:e.clientY, ctrlKey:e.ctrlKey, metaKey:e.metaKey, shiftKey:e.shiftKey, button:e.button, detail:e.detail}));}
        finally {bypass.current = false;}
      });
    };
    const key = (e: KeyboardEvent) => {
      if (bypass.current) return;
      if (dirty && !next && ['ArrowLeft','ArrowRight','Home','End'].includes(e.key) && (e.target as Element).closest('[role="tablist"]') && !scope.current?.contains(e.target as Node)) {
        e.preventDefault(); e.stopImmediatePropagation();
        const target = e.target;
        leave(() => {bypass.current = true; target?.dispatchEvent(new KeyboardEvent('keydown', {key:e.key, bubbles:true})); bypass.current = false;});
        return;
      }
      if (e.key !== 'Escape' || document.querySelector('.house-leave-dialog') || next || (!dirty && !busy)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (cancelOnEscape) {if (!busy) escape();}
      else leave(() => requestLeave(escape));
    };
    const unload = (e: BeforeUnloadEvent) => { if (dirty || busy) {e.preventDefault(); e.returnValue = ''; } };
    const rememberSelect = (e: Event) => {
      const select = e.target as HTMLSelectElement;
      if (select.tagName === 'SELECT' && !scope.current?.contains(select)) selectValues.current.set(select, select.value);
    };
    const changeSelect = (e: Event) => {
      const select = e.target as HTMLSelectElement;
      if (bypass.current || (!dirty && !busy) || select.tagName !== 'SELECT' || scope.current?.contains(select)) return;
      const wanted = select.value, previous = selectValues.current.get(select);
      e.preventDefault(); e.stopImmediatePropagation();
      if (previous !== undefined) select.value = previous;
      leave(() => {
        bypass.current = true;
        try {select.value = wanted; select.dispatchEvent(new Event('change', {bubbles:true}));}
        finally {bypass.current = false;}
      });
    };
    document.addEventListener('focusin', rememberSelect, true);
    document.addEventListener('pointerdown', rememberSelect, true);
    document.addEventListener('change', changeSelect, true);
    const external = (e: Event) => {
      if (bypass.current || (!dirty && !busy)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      leave(() => requestLeave((e as CustomEvent<() => void>).detail));
    };
    window.addEventListener(leaveEvent, external);
    document.addEventListener('click', click, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('beforeunload', unload);
    return () => {document.removeEventListener('focusin', rememberSelect, true); document.removeEventListener('pointerdown', rememberSelect, true); document.removeEventListener('change', changeSelect, true); window.removeEventListener(leaveEvent, external); document.removeEventListener('click', click, true); window.removeEventListener('keydown', key, true); window.removeEventListener('beforeunload', unload);};
  });
  async function resolve(action: typeof save) {
    setWorking(true); setFailure('');
    try { if (await action()) {const go = next; setNext(null); bypass.current = true; try {go?.();} finally {bypass.current = false;}} else setFailure('Changes could not be saved or discarded. Keep editing to review the error and try again.'); }
    catch {setFailure('Changes could not be saved or discarded. Keep editing and try again.');}
    finally {setWorking(false);}
  }
  return {leave, prompt: next && createPortal(<dialog ref={prompt} className="house-leave-dialog" aria-label="Unsaved house changes" onKeyDown={e => e.stopPropagation()} onCancel={e => {e.preventDefault(); e.stopPropagation(); if (!working && !busy) setNext(null);}}>
    <h2>Unsaved changes</h2><p>Save your changes before leaving?</p>
    {failure && <p role="alert">{failure}</p>}
    <div className="house-history-actions">
      <button disabled={working || busy} onClick={() => void resolve(save)}>Save</button>
      <button disabled={working || busy} onClick={() => void resolve(discard)}>Discard</button>
      <button autoFocus disabled={working || busy} onClick={() => setNext(null)}>Keep editing</button>
    </div>
  </dialog>, document.body)};
}
