import { useCallback, useEffect, useRef, useState } from 'react';

export function useCleanView(enabled: boolean, prepare: () => void) {
  const [clean, setClean] = useState(false);
  const active = useRef(false), owned = useRef(false);
  const exitClean = useCallback(() => {
    active.current = false; setClean(false);
    if (owned.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    owned.current = false;
  }, []);
  const enterClean = useCallback(() => {
    if (!enabled) return;
    prepare(); active.current = true; setClean(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      owned.current = true;
      void document.documentElement.requestFullscreen().then(() => {
        // A quick exit must also cancel a fullscreen request that completed late.
        if (!active.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      }).catch(() => { owned.current = false; });
    }
    (document.activeElement as HTMLElement | null)?.blur();
  }, [enabled, prepare]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (active.current) { event.preventDefault(); event.stopImmediatePropagation(); exitClean(); return; }
      const target = event.target as HTMLElement;
      if (event.key.toLowerCase() === 'f' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) { event.preventDefault(); enterClean(); }
    };
    const change = () => { if (!document.fullscreenElement && owned.current) exitClean(); };
    window.addEventListener('keydown', key, true); document.addEventListener('fullscreenchange', change);
    return () => { window.removeEventListener('keydown', key, true); document.removeEventListener('fullscreenchange', change); };
  }, [enterClean, exitClean]);
  return { clean, enterClean, exitClean };
}
