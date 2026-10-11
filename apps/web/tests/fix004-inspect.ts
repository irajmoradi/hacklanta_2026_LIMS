import { _roots } from '@react-three/fiber';
import { Box3, Mesh, Vector3 } from 'three';
import { headBounds, headAnchors } from '../src/scene/cosmeticAssets';

export function inspect() {
  return [..._roots.values()].map(root => {
    const state = root.store.getState();
    const heads: { insideCosmetic: boolean; generated: boolean; hiddenPreset: boolean; cosmetics: { name: string; meshes: string[]; eyeError: number; topError: number }[] }[] = [];
    state.scene.traverse(node => {
      if (node.name !== 'Head') return;
      let insideCosmetic = false;
      for (let p = node.parent; p; p = p.parent) insideCosmetic ||= !!p.userData.cosmetic;
      const anchor = headAnchors(headBounds(node));
      const inverse = node.matrixWorld.clone().invert();
      let rig = node;
      while (rig.parent && !rig.getObjectByName('head')) rig = rig.parent;
      heads.push({ insideCosmetic, generated: node.children.some(n => n.userData.generatedHead),
        hiddenPreset: rig.getObjectByName('head')?.visible === false,
        cosmetics: node.children.filter(n => n.userData.cosmetic).map(n => {
          const bounds = new Box3(), meshes: string[] = [];
          n.updateWorldMatrix(true, true);
          n.traverse(m => {
            if (!(m instanceof Mesh)) return;
            meshes.push(m.name);
            const pos = m.geometry.getAttribute('position');
            for (let i = 0; i < pos.count; i++) bounds.expandByPoint(m.getVertexPosition(i, new Vector3()).applyMatrix4(m.matrixWorld).applyMatrix4(inverse));
          });
          return { name: n.name, meshes, eyeError: bounds.getCenter(new Vector3()).y - anchor.eyeLine,
            topError: bounds.max.y - anchor.top };
        }) });
    });
    return heads;
  });
}

export function view(canvas: HTMLCanvasElement, side: boolean) {
  const state = _roots.get(canvas)!.store.getState();
  state.camera.position.set(side ? 3.6 : 0, 0.35, side ? 0 : 3.6);
  state.camera.lookAt(0, 0.2, 0); state.camera.updateMatrixWorld(); state.invalidate();
}
