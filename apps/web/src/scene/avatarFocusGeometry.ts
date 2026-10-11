import { Box3, Vector3, type Camera, type Object3D } from 'three';

export type ScreenRect = { left: number; right: number; top: number; bottom: number };
export const intersectsAvatar = (a: ScreenRect, b: ScreenRect) =>
  a.left < b.right + 8 && a.right > b.left - 8 && a.top < b.bottom + 8 && a.bottom > b.top - 8;

/** Measure rendered geometry, including replacement heads, but exclude hidden presets. */
export function avatarScreenBounds(body: Object3D, camera: Camera, size: {width: number; height: number}): ScreenRect | null {
  body.updateWorldMatrix(true, true);
  const bounds = new Box3(), part = new Box3();
  body.traverseVisible(node => {
    const mesh = node as import('three').Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) bounds.union(part.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
  });
  if (bounds.isEmpty()) return null;
  const rect = {left:Infinity, right:-Infinity, top:Infinity, bottom:-Infinity}, point = new Vector3();
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    point.set(x,y,z).project(camera);
    if (point.z < -1 || point.z > 1) return null;
    const sx = (point.x+1)*size.width/2, sy = (1-point.y)*size.height/2;
    rect.left = Math.min(rect.left,sx); rect.right = Math.max(rect.right,sx);
    rect.top = Math.min(rect.top,sy); rect.bottom = Math.max(rect.bottom,sy);
  }
  return rect;
}
