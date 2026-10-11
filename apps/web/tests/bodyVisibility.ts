import { Box3, Mesh, Object3D, SkinnedMesh, Vector3 } from 'three';

/** Measure the base body, never a hat, head, pet or replacement outfit. */
export function bodyVisibility(rig: Object3D) {
  rig.updateWorldMatrix(true, true);
  const bounds = new Box3(), parts: string[] = [];
  const visit = (node: Object3D) => {
    if (!node.visible || node.userData.cosmetic || node.userData.generatedHead) return;
    if (node instanceof Mesh && ['torso', 'leg_L', 'leg_R'].includes(node.name)) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (!materials.some(m => m.visible && m.opacity > 0)) return;
      if (node instanceof SkinnedMesh) node.updateMatrixWorld(true);
      const box = new Box3();
      for (let i = 0; i < node.geometry.attributes.position.count; i++) {
        box.expandByPoint(node.getVertexPosition(i, new Vector3()).applyMatrix4(node.matrixWorld));
      }
      if (box.getSize(new Vector3()).y > .001) { parts.push(node.name); bounds.union(box); }
    }
    node.children.forEach(visit);
  };
  let visible = true;
  rig.traverseAncestors(node => { if (!node.visible) visible = false; });
  if (visible) visit(rig);
  return { parts, height: bounds.getSize(new Vector3()).y, min: bounds.min.toArray(), max: bounds.max.toArray() };
}
