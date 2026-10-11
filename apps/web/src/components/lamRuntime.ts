import type { ExprData, LamHead, MountOptions } from '../../../../packages/lam-renderer/src';
export type { ExprData, LamHead };

// The upstream renderer is a singleton. Hold the queue until disposal, including
// when a profile is closed while its asynchronous mount is still pending.
let queue = Promise.resolve();
let expiry: ReturnType<typeof setTimeout> | undefined;
let cached: {key: string; host: HTMLElement; head: LamHead} | undefined;
async function disposeHead(head: LamHead) {
  const renderer = head._renderer as {viewer?: {dispose?: () => Promise<void>}} | undefined;
  try { await renderer?.viewer?.dispose?.(); } catch { /* Still release the wrapper. */ }
  head.dispose();
}
export function scheduleHead(host: HTMLElement, options: MountOptions, ready: (head: LamHead) => void, failed: () => void, keepAlive = false) {
  let cancelled = false, head: LamHead | undefined, release: (() => void) | undefined;
  const done = new Promise<void>(resolve => { release = resolve; });
  queue = queue.then(async () => {
    if (cancelled) return;
    try {
      const { mountLamHead } = await import('@village/lam-renderer');
      if (cancelled) return;
      const key = options.packageUrl + JSON.stringify(options.headers);
      clearTimeout(expiry);
      if (cached && cached.key !== key) { const old = cached; cached = undefined; await disposeHead(old.head); old.host.remove(); }
      if (cached) { head = cached.head; host.append(cached.host); cached = undefined; }
      else { const container = document.createElement('div'); container.style.cssText = 'position:absolute;inset:0'; host.append(container); head = await mountLamHead(container, options); }
      if (!cancelled) { ready(head); await done; }
    } catch { if (!cancelled) failed(); }
    finally {
      const current = head; head = undefined;
      if (current) {
        if (keepAlive) {
          current.setAudio(null); current.setExpr(null);
          const container = host.firstElementChild as HTMLElement;
          container.remove();
          cached = {key: options.packageUrl + JSON.stringify(options.headers), host: container, head: current};
          const retained = cached;
          expiry = setTimeout(() => {
            queue = queue.then(async () => { if (cached === retained) { cached = undefined; await disposeHead(retained.head); retained.host.remove(); } });
          }, 60000);
        } else await disposeHead(current);
      }
      host.replaceChildren();
    }
  });
  return () => { if (cancelled) return; cancelled = true; release?.(); };
}
