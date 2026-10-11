import { Box3, Matrix4, Mesh, Object3D, SkinnedMesh, Vector3 } from 'three';

/** Exact vertices in the attachment frame, including skinned meshes beside the bones. */
export function geometryBounds(root: Object3D, frame: Object3D, accept = (_node: Mesh) => true) {
  return new Box3().setFromPoints(geometryPoints(root, frame, accept));
}

export function geometryPoints(root: Object3D, frame: Object3D, accept = (_node: Mesh) => true) {
  root.updateWorldMatrix(true, false);
  // updateWorldMatrix bypasses SkinnedMesh.updateMatrixWorld and leaves bind
  // inverses stale for meshes outside `accept` (e.g. torso/legs during head fit).
  // A pointer raycast before the next render then caches their bounding spheres
  // in the wrong frame, permanently culling an otherwise visible body.
  root.updateMatrixWorld(true);
  frame.updateWorldMatrix(true, false);
  const inverse = new Matrix4().copy(frame.matrixWorld).invert(), points: Vector3[] = [];
  const visit = (node: Object3D) => {
    if (!node.visible || (node !== root && node.userData.cosmetic)) return;
    if (node instanceof Mesh && accept(node)) {
      // updateWorldMatrix does not call SkinnedMesh.updateMatrixWorld. Before
      // the first rendered frame its bind inverse still belongs to the cached
      // source, which double-applies a preview/town wrapper's scale and offset.
      if (node instanceof SkinnedMesh) {
        node.skeleton.bones.forEach(bone => bone.updateWorldMatrix(true, false));
        node.updateMatrixWorld(true);
      }
      const position = node.geometry.getAttribute('position');
      for (let i = 0; position && i < position.count; i++) {
        points.push(node.getVertexPosition(i, new Vector3()).applyMatrix4(node.matrixWorld).applyMatrix4(inverse));
      }
    }
    node.children.forEach(visit);
  };
  visit(root);
  return points;
}

export function headFrame(bounds: Box3, points?: Vector3[]) {
  const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
  let eyeLine = bounds.min.y + size.y * 0.55, faceWidth = size.x;
  if (points?.length) {
    // A texture-baked mesh has no named eyes. Estimate the nose from the foremost
    // central face surface, excluding crown/chin, then place the eyes just above it.
    const face = points.filter(p => Math.abs(p.x - center.x) < size.x * 0.04 &&
      p.y > bounds.min.y + size.y * 0.25 && p.y < bounds.min.y + size.y * 0.65);
    if (face.length) {
      const front = face.reduce((z, p) => Math.max(z, p.z), -Infinity);
      const nose = face.filter(p => p.z >= front - size.z * 0.015).map(p => p.y).sort((a, b) => a - b);
      eyeLine = Math.max(bounds.min.y + size.y * 0.43,
        Math.min(bounds.min.y + size.y * 0.58, nose[Math.floor(nose.length / 2)] + size.y * 0.12));
      const eyeBand = points.filter(p => Math.abs(p.y - eyeLine) < size.y * 0.08 && p.z > bounds.max.z - size.z * 0.4);
      if (eyeBand.length) faceWidth = Math.max(size.x * 0.7, new Box3().setFromPoints(eyeBand).getSize(new Vector3()).x);
    }
  }
  const skull = skullEllipse(bounds, points);
  return { center, size, skull, top: bounds.max.y, bottom: bounds.min.y,
    front: bounds.max.z, forward: new Vector3(0, 0, 1),
    eyeLine, faceWidth,
    ears: [new Vector3(bounds.min.x, center.y, center.z), new Vector3(bounds.max.x, center.y, center.z)],
    earWidth: size.x, scale: Math.max(size.x, 0.001) / 0.72 };
}

/** Robust axis-aligned crown ellipse. Long side/back hair never sets its width.
 * Quantile trimming rejects stray hair tips; angular bins avoid tessellation-density bias.
 * This is a geometric skull estimate, not semantic hair segmentation.
 */
export function skullEllipse(bounds: Box3, points: Vector3[] = []) {
  const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
  const quantile = (values: number[], q: number) => {
    values.sort((a, b) => a - b); return values[Math.max(0, Math.ceil(values.length * q) - 1)];
  };
  const upper = points.filter(p => p.y >= bounds.max.y - size.y * .2 - size.y * 1e-7);
  let width = size.x, depth = size.z, top = bounds.max.y;
  if (upper.length >= 16) {
    const range = (axis: 'x' | 'z') => [quantile(upper.map(p => p[axis]), .03), quantile(upper.map(p => p[axis]), .97)];
    const [left, right] = range('x'), [back, front] = range('z');
    center.x = (left + right) / 2; center.z = (back + front) / 2;
    width = Math.max(size.y * .2, right - left); depth = Math.max(size.y * .2, front - back);
    // Fit the ellipse's radius to the outer surface in equally weighted directions.
    const bins: number[][] = Array.from({length: 24}, () => []);
    for (const p of upper) {
      const x = (p.x - center.x) / (width / 2), z = (p.z - center.z) / (depth / 2);
      const index = Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI * 2) * 24 + 1e-7) % 24;
      bins[index].push(Math.hypot(x, z));
    }
    const radii = bins.filter(b => b.length).map(b => quantile(b, .9));
    const radius = Math.max(.85, Math.min(1.08, quantile(radii, .5)));
    width *= radius; depth *= radius;
    top = quantile(upper.map(p => p.y), .97);
  }
  const height = top - bounds.min.y;
  const seat = bounds.min.y + height * .82;
  center.y = seat;
  return { center, width, depth, top, seat, height };
}

/** Prefer a neck-sized lower section; reject pointed chins and wide hair.
 * Unsegmented scans cannot always identify a neck, so retain a bbox fallback.
 */
export function headNeckAnchor(bounds: Box3, points: Vector3[] = []) {
  const size = bounds.getSize(new Vector3()), anchor = bounds.getCenter(new Vector3());
  const lower = points.filter(p => p.y <= bounds.min.y + size.y * .08);
  if (lower.length >= 4) {
    const band = new Box3().setFromPoints(lower), span = band.getSize(new Vector3());
    if (span.x >= size.x * .15 && span.x <= size.x * .65 &&
        span.z >= size.z * .15 && span.z <= size.z * .65) band.getCenter(anchor);
  }
  anchor.y = bounds.min.y;
  return anchor;
}

export function normalizedHeadFit(bounds: Box3, base: Box3, neckTop: number,
  socket = base.getCenter(new Vector3()), points?: Vector3[]) {
  const size = bounds.getSize(new Vector3()), anchor = headNeckAnchor(bounds, points);
  const scale = base.getSize(new Vector3()).y * 1.05 / Math.max(size.y, 0.001);
  return { scale, offset: new Vector3(socket.x - anchor.x * scale, neckTop - anchor.y * scale, socket.z - anchor.z * scale) };
}
