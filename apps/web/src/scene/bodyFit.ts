import { Box3, Object3D, Vector3 } from 'three';
import { geometryBounds } from './headFit';

/** Include sleeves and forearms: a shirt's bounding box cannot fit inside just the chest. */
export function torsoBounds(rig: Object3D, spine: Object3D) {
  const bounds = geometryBounds(rig, spine, n => ['torso', 'sleeve_L', 'sleeve_R', 'forearm_L', 'forearm_R'].includes(n.name));
  return bounds.isEmpty() ? new Box3(new Vector3(-0.49, -0.06, -0.3), new Vector3(0.49, 0.42, 0.3)) : bounds;
}

/** Preserve an accessory's authored location, shrinking only dimensions outside the body envelope. */
export function fitTorso(instance: Object3D, rig: Object3D, spine: Object3D, mantle: boolean) {
  const body = torsoBounds(rig, spine), size = body.getSize(new Vector3());
  const envelope = body.clone().expandByVector(size.clone().multiplyScalar(mantle ? 0.12 : 0.10));
  const own = geometryBounds(instance, spine), dimensions = own.getSize(new Vector3());
  if (own.isEmpty()) return;
  const available = envelope.getSize(new Vector3());
  instance.scale.set(Math.min(1, available.x / dimensions.x), Math.min(1, available.y / dimensions.y), Math.min(1, available.z / dimensions.z));
  const fitted = geometryBounds(instance, spine);
  for (const axis of ['x', 'y', 'z'] as const) {
    instance.position[axis] += Math.max(0, envelope.min[axis] - fitted.min[axis]) - Math.max(0, fitted.max[axis] - envelope.max[axis]);
  }
}

/** Scarves wrap the neck with their tails on the outside of the largest shirt. */
export function fitNeck(instance: Object3D, rig: Object3D, head: Object3D) {
  const neck = geometryBounds(rig, head, n => n.name === 'neck');
  const torso = geometryBounds(rig, head, n => n.name === 'torso');
  const own = geometryBounds(instance, head);
  if (own.isEmpty()) return;
  if (neck.isEmpty() || torso.isEmpty()) { instance.position.y = -0.165; return; }
  const size = own.getSize(new Vector3());
  const neckCenter = neck.getCenter(new Vector3());
  instance.scale.z = (torso.max.z * 1.2) / Math.max(own.max.z, 0.001);
  instance.position.y = neck.min.y + (neck.max.y - neck.min.y) * 0.65 - own.max.y;
  instance.position.x = neckCenter.x - own.getCenter(new Vector3()).x;
  // Keep long medals/scarf tails clear of the hips without moving their neckline.
  const height = neck.max.y - torso.min.y;
  if (size.y > height) { instance.scale.y = height / size.y; instance.position.y += own.max.y * (1 - instance.scale.y); }
}
