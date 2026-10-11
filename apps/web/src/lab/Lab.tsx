import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { ToastViewport } from '../components/Toast';
import { LAB_SCENES } from './scenes';
import './lab.css';

const screens = new Map(LAB_SCENES.map(scene => [scene.id, lazy(scene.load)]));
class LabBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() { return this.state.failed ? <section className="lab-placeholder"><h2>This scene could not load.</h2><p>Choose another scene or reload to try again.</p></section> : this.props.children; }
}
export default function Lab() {
  const [active, setActive] = useState(() => LAB_SCENES.find(s => s.id === location.hash.slice(1))?.id ?? 'town');
  const Screen = screens.get(active)!;
  return <div className="lab-shell">
    <aside className="lab-rail"><a className="lab-back" href="/">← Back to the village</a>
      <div className="lab-brand"><span className="lab-eyebrow">VILLAGE / PLAYGROUND</span><h1>Demo Lab<span>Possibilities, together.</span></h1></div>
      <nav aria-label="Lab scenes">{LAB_SCENES.map((scene, i) => <button key={scene.id} aria-current={active === scene.id ? 'page' : undefined} onClick={() => {setActive(scene.id); history.replaceState(null, '', `/lab#${scene.id}`);}}><span className="lab-number">0{i + 1}</span><span><strong>{scene.title}</strong><small>{scene.blurb}</small></span></button>)}</nav>
      <p className="lab-note"><span>●</span> Private sandbox<br/>Every change stays here.<br/>Reload to start fresh.</p>
    </aside>
    <main className="lab-main"><LabBoundary key={active}><Suspense fallback={<p className="lab-placeholder" role="status">Preparing your scene…</p>}><Screen /></Suspense></LabBoundary></main>
    <ToastViewport />
  </div>;
}
