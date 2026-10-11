import type { LamHead } from './lamRuntime';
import type { Camera, Vector3 } from 'three';

type Viewer = { camera?: Camera; controls?: {
  enabled: boolean; enableZoom: boolean; enableRotate: boolean; enablePan: boolean;
  minDistance: number; maxDistance: number; target: Vector3; update: () => void;
} };
export function configureHeadControls(head: LamHead) {
  const viewer = (head._renderer as { viewer?: Viewer } | undefined)?.viewer;
  const controls = viewer?.controls;
  if (controls) {
    Object.assign(controls, {enabled: true, enableZoom: true, enableRotate: true, enablePan: false, minDistance: .22, maxDistance: 1.5});
    controls.update();
  }
  return () => {
    viewer?.camera?.position.set(0, 1.66, .62);
    viewer?.camera?.lookAt(0, 1.66, 0);
    controls?.target.set(0, 1.66, 0);
    controls?.update();
  };
}
