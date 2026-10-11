import { Object3D } from 'three';

/** Clothing GLBs can contain a complete skeleton. Never use their duplicate bones. */
export function rigAnchor(rig: Object3D, name: 'Head' | 'Spine'): Object3D | undefined {
  if (rig.userData.cosmetic || rig.userData.generatedHead) return;
  if (rig.name === name) return rig;
  for (const child of rig.children) {
    const anchor = rigAnchor(child, name);
    if (anchor) return anchor;
  }
}
