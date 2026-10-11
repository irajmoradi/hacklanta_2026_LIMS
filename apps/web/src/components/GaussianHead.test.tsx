import { afterEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const window = new Window({ url: 'http://localhost:5174' });
Object.assign(window, { SyntaxError });
Object.assign(globalThis, {requestAnimationFrame: (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 0), cancelAnimationFrame: clearTimeout});
Object.assign(globalThis, { window, document: window.document, location: window.location, navigator: window.navigator, HTMLElement: window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
let inView = true;
let intersection: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
Object.assign(globalThis, { IntersectionObserver: class {
  constructor(callback: typeof intersection) { intersection = callback; }
  observe() { intersection?.([{ isIntersecting: inView }]); }
  disconnect() {}
} });
let rejectMount = false, disposed = 0, mounts = 0;
const mountedUrls: string[] = [];
let pending: Promise<void> | undefined;
let cleanup: Promise<void> | undefined;
mock.module('@village/lam-renderer', () => ({ mountLamHead: async (_host: HTMLElement, options: { headers: Record<string, string>; packageUrl: string }) => {
  mounts++; expect(options.headers['X-Demo-User']).toBeTruthy();
  mountedUrls.push(options.packageUrl);
  await pending;
  if (rejectMount) throw new Error('WebGL unavailable');
  return { setExpr() {}, setAudio() {}, _renderer: { viewer: { dispose: () => cleanup } }, dispose() { disposed++; } };
} }));
const { GaussianHead } = await import('./GaussianHead');
let root: Root | undefined;
afterEach(async () => { await act(async () => root?.unmount()); document.body.replaceChildren(); root = undefined; });
test('offscreen portraits never mount; entering and leaving the viewport starts and releases the renderer', async () => {
  inView = false;
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  const before = mounts;
  await act(async () => { root!.render(<GaussianHead name="Lazy" photo="/photo.png" packageUrl="/api/assets/lazy.zip?rev=42" />); });
  expect(mounts).toBe(before);
  expect(host.querySelector('img')).not.toBeNull();
  await act(async () => { intersection?.([{ isIntersecting: true }]); await new Promise(r => setTimeout(r, 20)); });
  expect(mounts).toBe(before + 1);
  expect(mountedUrls.at(-1)).toBe('/api/assets/lazy.zip?rev=42');
  await act(async () => { intersection?.([{ isIntersecting: false }]); });
  expect(host.querySelector('[data-head-state="hidden"]')).not.toBeNull();
  inView = true;
});
test('failed renderer retains photo and reports fallback; successful mount disposes on close', async () => {
  const before = mounts, disposedBefore = disposed;
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  rejectMount = true;
  await act(async () => { root!.render(<GaussianHead name="Dev" photo="/photo.png" packageUrl="/api/assets/avatars/dev/head/avatar.zip" />); await new Promise(r => setTimeout(r, 20)); });
  expect(host.querySelector('[data-head-state="failed"]')).not.toBeNull();
  expect(host.querySelector('img')?.getAttribute('src')).toBe('/photo.png');
  expect(host.textContent).toContain('Photo preview');
  rejectMount = false;
  await act(async () => { root!.render(<GaussianHead name="Dev" photo="/photo.png" packageUrl="/api/assets/avatars/dev/head/next.zip" />); await new Promise(r => setTimeout(r, 20)); });
  for (let i = 0; i < 50 && !host.querySelector('[data-head-state="ready"]'); i++) await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  expect(host.querySelector('[data-head-state="ready"]')).not.toBeNull();
  expect(host.querySelector('.lam-canvas')?.getAttribute('role')).toBe('img');
  expect(host.querySelector('.lam-canvas')?.getAttribute('aria-label')).toBe("Dev's animated head");
  await act(async () => root!.unmount()); root = undefined;
  expect(disposed).toBe(disposedBefore + 1); expect(mounts).toBe(before + 2);
});

test('cancel is idempotent, skips queued mounts, and awaits viewer disposal', async () => {
  const { scheduleHead } = await import('./lamRuntime');
  const options = { packageUrl: '/api/assets/test.zip', headers: {'X-Demo-User':'test'} };
  let finish!: () => void;
  cleanup = new Promise<void>(resolve => { finish = resolve; });
  const before = mounts, disposedBefore = disposed;
  let ready = 0;
  const host = document.createElement('div');
  const stop = scheduleHead(host, options, () => ready++, () => { throw new Error('Unexpected failure'); });
  await new Promise(r => setTimeout(r, 20));
  expect(ready).toBe(1);
  stop(); stop();
  const skip = scheduleHead(host, options, () => ready++, () => {}); skip(); skip();
  const next = scheduleHead(host, options, () => ready++, () => {});
  await new Promise(r => setTimeout(r, 20));
  expect(mounts).toBe(before + 1);
  cleanup = undefined; finish();
  await new Promise(r => setTimeout(r, 20));
  expect(mounts).toBe(before + 2);
  expect(disposed).toBe(disposedBefore + 1);
  expect(ready).toBe(2);
  next();
  await new Promise(r => setTimeout(r, 20));
});

test('pending mount is disposed before the next profile mounts; hidden tabs do not mount', async () => {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  let resolve!: () => void;
  pending = new Promise<void>(r => { resolve = r; });
  const before = mounts, disposedBefore = disposed;
  await act(async () => { root!.render(<GaussianHead name="First" photo={null} packageUrl="/api/assets/first.zip" />); await new Promise(r => setTimeout(r, 20)); });
  await act(async () => { root!.render(<GaussianHead name="Second" photo={null} packageUrl="/api/assets/second.zip" />); await new Promise(r => setTimeout(r, 20)); });
  expect(mounts).toBe(before + 1);
  await act(async () => { pending = undefined; resolve(); await new Promise(r => setTimeout(r, 20)); });
  expect(disposed).toBe(disposedBefore + 1); expect(mounts).toBe(before + 2);
  await act(async () => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event); });
  expect(disposed).toBe(disposedBefore + 2);
  expect(host.querySelector('[data-head-state="hidden"]')).not.toBeNull();
  await act(async () => { root!.render(<GaussianHead name="Third" photo={null} packageUrl="/api/assets/third.zip" />); });
  expect(mounts).toBe(before + 2);
  await act(async () => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event); await new Promise(r => setTimeout(r, 20)); });
  expect(mounts).toBe(before + 3);
});
