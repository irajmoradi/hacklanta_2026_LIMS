import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh, Skeleton, Matrix4, Uint16BufferAttribute, Float32BufferAttribute } from 'three';

/** Model-free fixture fallback. Each side follows its owning leg when available. */
export function lowerBodyFallback(slot: string, rig?: Object3D) {
  const root = new Group(); root.userData.ownedGeometry = true;
  let base: SkinnedMesh | undefined;
  rig?.traverse(node => { if (!base && node instanceof SkinnedMesh) base = node; });
  for (const side of slot === 'bottoms' ? [-1, 0, 1] : [-1, 1]) {
    const material = new MeshStandardMaterial({color: slot === 'shoes' ? '#3b9790' : '#557ca7'});
    material.name = 'primary';
    const geometry = new BoxGeometry(...(side === 0 ? [.416,.19,.306] : slot === 'shoes' ? [.245,.19,.39] : [.21,.45,.25]) as [number,number,number]);
    geometry.translate(side*.14,side === 0 ? .59 : slot === 'shoes' ? .095 : .345,slot === 'shoes' ? .065 : 0);
    const index = base?.skeleton.bones.findIndex(b => b.name === (side === 0 ? 'Root' : side === 1 ? 'Leg_L' : 'Leg_R')) ?? -1;
    let mesh: Mesh;
    if (base && index >= 0) {
      geometry.setAttribute('skinIndex', new Uint16BufferAttribute(Array.from({length:geometry.attributes.position.count}, () => [index,0,0,0]).flat(),4));
      geometry.setAttribute('skinWeight', new Float32BufferAttribute(Array.from({length:geometry.attributes.position.count}, () => [1,0,0,0]).flat(),4));
      const skinned = new SkinnedMesh(geometry,material);
      skinned.bind(new Skeleton(base.skeleton.bones,base.skeleton.boneInverses.map(m => m.clone())),new Matrix4());
      mesh = skinned;
    } else mesh = new Mesh(geometry, material);
    root.add(mesh);
  }
  return root;
}

/** Ref-count base coverage so concurrent async attachments restore visibility safely. */
export function coverLowerBody(rig: Object3D, slot: string) {
  const covered: Object3D[] = [];
  const names = slot === 'bottoms' ? ['hips','leg_L','leg_R'] : ['shoe_L','shoe_R'];
  function visit(node: Object3D) {
    if (node.userData.cosmetic || node.userData.generatedHead) return;
    if (names.includes(node.name)) {
      if (!node.userData.lowerCoverage) node.userData.lowerVisible = node.visible;
      node.userData.lowerCoverage = (node.userData.lowerCoverage ?? 0) + 1;
      node.visible = false; covered.push(node);
    }
    node.children.forEach(visit);
  }
  visit(rig);
  return () => covered.forEach(node => {
    if (--node.userData.lowerCoverage === 0) {
      node.visible = node.userData.lowerVisible;
      delete node.userData.lowerCoverage; delete node.userData.lowerVisible;
    }
  });
}
