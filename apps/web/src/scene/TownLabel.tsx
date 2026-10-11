import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {useFrame, useThree} from '@react-three/fiber';
import {Group, Vector3, type Camera, type Object3D} from 'three';

const labels = new WeakMap<HTMLElement, Set<HTMLElement>>();
const visibleLabels = new WeakMap<HTMLElement, Set<HTMLElement>>();
const important = (node: HTMLElement) => !!node.querySelector('.selected, [data-player="true"], .house-nameplate.revealed');
/** Town overlays need neither React renders nor DOM layout reads each frame. */
export function TownLabel({children, position, style, zIndexRange = [20, 0], calculatePosition}: {
  children: ReactNode; position: [number, number, number]; center?: boolean;
  style?: CSSProperties; zIndexRange?: number[];
  calculatePosition?: (object: Object3D, camera: Camera, size: {width: number; height: number}) => [number, number];
}) {
  const {gl} = useThree();
  const group = useRef<Group>(null), element = useRef<HTMLDivElement | null>(null);
  const point = useRef(new Vector3()), elapsed = useRef(1);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const root = useRef<Root | null>(null);
  useEffect(() => {setHost(gl.domElement.parentElement);}, [gl]);
  useEffect(() => {
    if (!host) return;
    const node = document.createElement('div');
    element.current = node;
    Object.assign(node.style, {position:'absolute', top:'0', left:'0', display:'none', width:'max-content', pointerEvents:'none'});
    host.appendChild(node); root.current = createRoot(node);
    const members = labels.get(host) ?? new Set<HTMLElement>();
    labels.set(host, members); members.add(node);
    if (!visibleLabels.has(host)) visibleLabels.set(host, new Set());
    return () => {members.delete(node); visibleLabels.get(host)?.delete(node); const mounted = root.current; queueMicrotask(() => mounted?.unmount()); node.remove(); root.current = null;};
  }, [host]);
  useEffect(() => {
    if (element.current) {Object.assign(element.current.style, style); element.current.style.zIndex = String(zIndexRange[0]);}
    root.current?.render(<>{children}</>);
  }, [host, children, style, zIndexRange]);
  useFrame(({camera, size}, dt) => {
    elapsed.current += dt;
    if (elapsed.current < .1 || !group.current || !element.current || !host) return;
    elapsed.current = 0;
    const node = element.current;
    group.current.updateWorldMatrix(true, false);
    point.current.setFromMatrixPosition(group.current.matrixWorld);
    const far = point.current.distanceToSquared(camera.position) > 180 * 180;
    point.current.project(camera);
    const p = point.current;
    const visible = !far && p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= 1.08 && Math.abs(p.y) <= 1.08;
    // Cap simultaneous DOM overlays; profile/dock navigation remains available.
    const shown = visibleLabels.get(host)!;
    const plate = node.querySelector<HTMLElement>('.house-nameplate');
    // Large towns have many transparent hover targets. Keep them interactive,
    // but do not let invisible house plates consume the readable-label budget.
    const ghost = (labels.get(host)?.size ?? 0) > 24 && !!plate
      && !plate.classList.contains('revealed') && !plate.matches(':hover, :focus-visible');
    if (visible && !ghost && !shown.has(node) && shown.size >= 24 && important(node)) {
      const replace = [...shown].find(other => !important(other));
      if (replace) {replace.style.display = 'none';shown.delete(replace);}
    }
    const display = visible && (ghost || shown.has(node) || shown.size < 24);
    if (display && !ghost) shown.add(node); else shown.delete(node);
    node.style.display = display ? '' : 'none';
    if (node.style.display === 'none') return;
    const xy = calculatePosition?.(group.current, camera, size);
    const x = xy?.[0] ?? Math.round((p.x + 1) * size.width / 2);
    const y = xy?.[1] ?? Math.round((1 - p.y) * size.height / 2);
    node.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
  });
  return <group ref={group} position={position}/>;
}
