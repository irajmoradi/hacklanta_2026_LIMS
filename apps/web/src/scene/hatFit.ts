import { Box3, Matrix4, Mesh, Object3D, Vector3 } from 'three';
import { geometryBounds, geometryPoints, type headFrame } from './headFit';

// The opening, not the brim/decorations, defines the hat's head contact frame.
const openings: Record<string, string> = {
  hat_cap: 'cap', hat_beanie: 'cuff', outfit_beanie: 'cuff', hat_cowboy: 'crown',
  hat_crown: 'band', hat_festival: 'bucket', festival_vip: 'bucket',
  hat_beret: 'band', outfit_beret: 'band', hat_party: 'party_hat',
  outfit_bucket: 'crown', outfit_sunhat: 'crown', outfit_bow: 'band',
  outfit_flower_crown: 'vine', competition_laurels: 'stem',
  perfect_week_halo: 'halo', outfit_earmuffs: 'headband',
};

/** Actual lower opening vertices, also used by the matrix after world transforms. */
export function hatOpening(instance: Object3D, id: string) {
  const mesh = instance.getObjectByName(openings[id]);
  const points = geometryPoints(mesh ?? instance, instance);
  const box = new Box3().setFromPoints(points), height = box.max.y - box.min.y;
  return points.filter(p => p.y <= box.min.y + Math.max(height * .08, .00001));
}

export function fitHat(instance: Object3D, bone: Object3D, id: string,
  frame: ReturnType<typeof headFrame>, factor: readonly number[] = [1, 1, 1], offset?: readonly number[]) {
  const opening = hatOpening(instance, id);
  if (!opening.length) return;
  const box = new Box3().setFromPoints(opening), size = box.getSize(new Vector3());
  const skull = frame.skull;
  // A small intersection compresses hair visually without modifying shared head geometry.
  instance.scale.set(skull.width * 1.01 / Math.max(size.x, .001), 1,
    skull.depth * 1.01 / Math.max(size.z, .001)).multiply(new Vector3(...factor as [number, number, number]));
  instance.scale.y = Math.min(instance.scale.x, instance.scale.z) * factor[1];
  // Compress overly tall authored shells to the requested 6% crown clearance.
  const own = geometryBounds(instance, bone);
  const available = skull.top + skull.height * .05 - skull.seat;
  instance.scale.y *= Math.min(1, available / Math.max(own.max.y - own.min.y, .001));
  instance.rotation.x = id === 'hat_cap' ? -.055 : 0;
  instance.updateMatrix();
  const fittedOpening = new Box3().setFromPoints(opening.map(p => p.clone().applyMatrix4(instance.matrix)));
  const origin = fittedOpening.getCenter(new Vector3());
  instance.position.copy(skull.center).sub(origin);
  if (offset) instance.position.add(new Vector3(...offset as [number, number, number]).multiply(frame.size));
}

/** Compress only the owned clone's crown; leave face, source cache and other avatars alone. */
export function compressCrown(head: Object3D, bone: Object3D, frame: ReturnType<typeof headFrame>, conical = false) {
  const restore: (() => void)[] = [], skull = frame.skull;
  head.updateWorldMatrix(true, true);
  const inverseBone = bone.matrixWorld.clone().invert();
  head.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const original = node.geometry, geometry = original.clone();
    const toBone = new Matrix4().multiplyMatrices(inverseBone, node.matrixWorld), fromBone = toBone.clone().invert();
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(toBone);
      if (p.y <= skull.seat) continue;
      const t = Math.min(1, (p.y - skull.seat) / Math.max(skull.top - skull.seat, .001));
      const x = p.x-skull.center.x, z = p.z-skull.center.z;
      const radius = Math.hypot(x/(skull.width/2),z/(skull.depth/2));
      const compression = Math.min(1, (.99-.7*t)/Math.max(radius,.001));
      p.x = skull.center.x + x*compression;
      p.z = skull.center.z + z*compression;
      p.y = skull.seat + (p.y - skull.seat) * (conical ? .1 : .8);
      p.applyMatrix4(fromBone); positions.setXYZ(i, p.x, p.y, p.z);
    }
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    node.geometry = geometry;
    restore.push(() => { node.geometry = original; geometry.dispose(); });
  });
  return () => restore.forEach(fn => fn());
}
