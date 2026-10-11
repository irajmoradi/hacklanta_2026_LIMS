import { BoxGeometry, BufferAttribute, Bone, Matrix4, Object3D, Skeleton, SkinnedMesh, Vector3, Quaternion } from 'three';

/** Extend the shipped straight-leg rig in bind space, without mutating cached assets. */
export function prepareSeatedRig(rig: Object3D) {
  for (const side of ['L', 'R']) {
    const leg = rig.getObjectByName(`Leg_${side}`);
    if (!(leg instanceof Bone) || rig.getObjectByName(`Knee_${side}`)) continue;
    const knee = new Bone(); knee.name = `Knee_${side}`; knee.position.y = .21; leg.add(knee);
  }
  rig.traverse(node => {
    if (!(node instanceof SkinnedMesh) || node.userData.seatedSkin) return;
    const original = node.skeleton, bones = [...original.bones], inverses = original.boneInverses.map(m => m.clone());
    const legs = ['L', 'R'].flatMap(side => {
      const index = bones.findIndex(b => b.name === `Leg_${side}`), knee = rig.getObjectByName(`Knee_${side}`);
      if (index < 0 || !(knee instanceof Bone)) return [];
      const target = bones.length; bones.push(knee);
      inverses.push(new Matrix4().makeTranslation(0, -.21, 0).multiply(inverses[index]));
      return [{index, target}];
    });
    if (!legs.length) return;
    const previous = node.geometry;
    // The original legs are single boxes with no vertices at the knee. Add a
    // middle ring so skinning makes an L, rather than stretching one diagonal.
    if (/^leg_[LR]$/.test(node.name)) {
      previous.computeBoundingBox();
      const box=previous.boundingBox!, size=box.getSize(new Vector3()), center=box.getCenter(new Vector3());
      const geometry=new BoxGeometry(size.x,size.y,size.z,1,2,1);geometry.translate(center.x,center.y,center.z);
      const count=geometry.getAttribute('position').count, indices=new Uint16Array(count*4), weights=new Float32Array(count*4);
      const index=previous.getAttribute('skinIndex').getX(0);
      for(let i=0;i<count;i++){indices[i*4]=index;weights[i*4]=1;}
      geometry.setAttribute('skinIndex',new BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new BufferAttribute(weights,4));node.geometry=geometry;
    } else node.geometry = previous.clone();
    if (node.userData.emoteSkin) { previous.dispose(); original.dispose(); }
    const positions = node.geometry.getAttribute('position'), indices = node.geometry.getAttribute('skinIndex'), weights = node.geometry.getAttribute('skinWeight');
    const point = new Vector3();
    for (let i = 0; i < positions.count; i++) for (let j = 0; j < 4; j++) {
      const leg = legs.find(l => l.index === indices.getComponent(i,j));
      if (!leg || !weights.getComponent(i,j)) continue;
      point.fromBufferAttribute(positions,i).applyMatrix4(node.bindMatrix).applyMatrix4(inverses[leg.index]);
      if (point.y > .21) indices.setComponent(i,j,leg.target);
    }
    node.bind(new Skeleton(bones,inverses),node.bindMatrix.clone()); node.userData.seatedSkin = true;
  });
}
export function seatedAnimator(rig: Object3D) {
  // Capture the base bones before cosmetic GLBs attach duplicate skeleton names.
  const joints=['L','R'].map(side=>({leg:rig.getObjectByName(`Leg_${side}`),knee:rig.getObjectByName(`Knee_${side}`)}));
  const saved=joints.flatMap(({leg,knee})=>[leg,knee]).filter((node):node is Object3D=>!!node).map(node=>({node,q:new Quaternion()}));
  let active=false;
  return {
    reset() { if(active) saved.forEach(({node,q})=>node.quaternion.copy(q)); active=false; },
    apply() {
      saved.forEach(({node,q})=>q.copy(node.quaternion));
      for (const {leg,knee} of joints) {
        // Bind legs point down (+local Y). Thigh forward, shin down.
        if (leg) leg.rotation.set(Math.PI/2,0,0);
        if (knee) knee.rotation.set(Math.PI/2,0,0);
      }
      active=true;
    },
  };
}
