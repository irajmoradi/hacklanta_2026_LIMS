import {_roots} from '@react-three/fiber';
import {Mesh, MeshStandardMaterial} from 'three';
export function focusState(exit = false) {
  const root = _roots.get(document.querySelector<HTMLCanvasElement>('.scene canvas')!)!.store.getState();
  const avatar = root.scene.getObjectByName('villager:00000000-0000-4000-8000-000000000001')!;
  const ring = avatar.getObjectByName('walking-highlight')!;
  const glow:number[] = [];
  avatar.traverseVisible(node => {if(node instanceof Mesh) for(const mat of Array.isArray(node.material)?node.material:[node.material]) if(mat instanceof MeshStandardMaterial) glow.push(mat.emissiveIntensity);});
  if(exit) {
    // Exercise the existing control timeout without a minute-long wall-clock wait.
    const now = performance.now.bind(performance);
    performance.now = () => now()+120000;
  }
  return {ring:ring.visible, glow};
}

export function zoomWalking() {
  const {camera} = _roots.get(document.querySelector<HTMLCanvasElement>('.scene canvas')!)!.store.getState();
  camera.zoom = 30; camera.updateProjectionMatrix();
}
