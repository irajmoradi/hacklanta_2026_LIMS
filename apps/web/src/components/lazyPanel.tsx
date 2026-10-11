import {Component, lazy, Suspense, type ComponentType, type ComponentProps, type ReactNode} from 'react';

class PanelBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() {return {failed:true};}
  // Browsers can cache rejected module imports; reload creates a fresh module map.
  render() {return this.state.failed ? <div role="alert">This panel could not load. <button onClick={() => location.reload()}>Reload page</button></div> : this.props.children;}
}

/** A local boundary keeps the village mounted while an optional panel downloads. */
export function lazyPanel<T extends ComponentType<any>>(load: () => Promise<{default: T}>) {
  let pending: ReturnType<typeof load> | undefined;
  const preload = () => pending ??= load().catch(error => {pending = undefined; throw error;});
  const Panel = lazy(preload);
  const Deferred = (props: ComponentProps<T>) => <PanelBoundary><Suspense fallback={<span role="status">Loading…</span>}><Panel {...props}/></Suspense></PanelBoundary>;
  return Object.assign(Deferred, {preload});
}

/** Queue module downloads without mounting canvases, polling, or paid adapters. */
export function prefetchWhenIdle(load: () => Promise<unknown>) {
  const run = () => { void load().catch(() => {}); };
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, {timeout: 5000});
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, 3000);
  return () => clearTimeout(id);
}
