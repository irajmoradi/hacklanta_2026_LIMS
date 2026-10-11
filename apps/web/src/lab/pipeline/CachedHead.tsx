import { useEffect, useRef, useState } from 'react';
import { scheduleHead } from '../../components/lamRuntime';
import { DemoPhoto, PLACEHOLDER } from './runtimeMedia';
import { configureHeadControls } from '../../components/headControls';

type Viewer = {
  splatMesh?: { getSplatCount?: () => number; visible?: boolean };
  render?: () => void;
  renderer?: { getContext: () => WebGLRenderingContext; domElement: HTMLCanvasElement };
};
// Some software WebGL drivers load and draw splats but produce a uniform frame.
// Check the actual framebuffer once, so readiness never hides the useful reference.
function hasRenderedPortrait(viewer: Viewer) {
  if (!viewer.renderer || !viewer.render) return false;
  viewer.render();
  const gl = viewer.renderer.getContext();
  const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
  if (!width || !height || gl.isContextLost()) return false;
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let different = 0;
  for (let i = 0; i < pixels.length; i += 16) {
    if (Math.abs(pixels[i] - pixels[0]) + Math.abs(pixels[i + 1] - pixels[1]) + Math.abs(pixels[i + 2] - pixels[2]) > 30) different++;
  }
  return different > 100;
}

/** Production renderer queue and controls, using only a static cached package. */
export function CachedHead({ packageUrl, headers, photo = PLACEHOLDER }: { headers?: Record<string, string>; packageUrl?: string; photo?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState('loading'), [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!packageUrl) { setState('unavailable'); return; }
    let active = true;
    setState('loading'); setLoaded(false);
    const stop = scheduleHead(host.current!, { packageUrl, headers, backgroundColor: '0xe9e7dc' }, head => {
      if (!active) return;
      const viewer = (head._renderer as { viewer?: Viewer }).viewer;
      const check = () => {
        if (!active) return;
        if ((viewer?.splatMesh?.getSplatCount?.() ?? 0) > 0 && viewer?.splatMesh?.visible) {
          setLoaded(true);
          configureHeadControls(head)();
          // Allow the skeleton and sort buffers to settle before checking pixels.
          settle = setTimeout(() => {
            if (!active) return;
            clearTimeout(timeout);
            let visible = false;
            try { visible = !!viewer && hasRenderedPortrait(viewer); } catch { /* Retain the reference. */ }
            setState(visible ? 'ready' : 'failed');
            if (!visible) { active = false; stop(); }
          }, 1500);
        } else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }, () => { if (active) { clearTimeout(timeout); setState('failed'); } });
    let settle: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => { if (active) { active = false; setState('failed'); stop(); } }, 30000);
    return () => { active = false; clearTimeout(timeout); clearTimeout(settle); stop(); };
  }, [attempt, packageUrl, headers]);
  return <div className="lab-head" data-head-state={state} data-head-loaded={loaded}><div ref={host} className="lab-head-host" />{state === 'ready' && <p className="lab-head-controls">Drag to rotate the cached 3D head.</p>}{state !== 'ready' && <div className="lab-head-fallback"><DemoPhoto src={photo} alt="Gaussian head reference or illustrated sample" /><p role="status">{state === 'unavailable' ? 'Illustrated Gaussian head: no cached package available.' : state === 'loading' ? 'Loading cached Gaussian head...' : '3D unavailable in this browser — cached LAM reference'}</p>{state === 'failed' && <button onClick={() => setAttempt(n => n + 1)}>Retry 3D view</button>}</div>}</div>;
}
