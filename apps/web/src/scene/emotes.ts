import { Bone, Matrix4, Object3D, Quaternion, Skeleton, SkinnedMesh, Vector3 } from 'three';

export type Emote = 'wave' | 'cheer' | 'spin';
export type EmoteRequest = { kind: Emote; start: number };
export const EMOTE_SECONDS = 1.4;
export const emoteLabels: Record<Emote, string> = { wave: 'Waving', cheer: 'Cheering', spin: 'Dancing' };
export const emoteKey = (code: string): Emote | undefined => ({ Space: 'wave', Digit1: 'wave', Digit2: 'cheer', Digit3: 'spin' } as const)[code as 'Space'];
const ease = (t: number) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, t)))) / 2;
export function emotePose(kind: Emote, seconds: number) {
  const t = Math.max(0, Math.min(EMOTE_SECONDS, seconds));
  const weight = ease(t / .25) * ease((EMOTE_SECONDS - t) / .25);
  // Three complete eased sweeps during the raised hold; zero velocity at either end.
  const sweep = t >= .25 && t <= 1.15 ? Math.sin(6 * Math.PI * ease((t - .25) / .9)) : 0;
  return { weight, right: (kind === 'spin' ? 1 : 5 * Math.PI / 6) * weight,
    left: (kind === 'wave' ? 0 : kind === 'spin' ? 1 : 5 * Math.PI / 6) * weight,
    elbow: (Math.PI / 6 + (kind === 'wave' ? sweep * .32 : 0)) * weight,
    lean: (kind === 'wave' ? -.06 : 0) * weight, tilt: (kind === 'wave' ? .1 : 0) * weight,
    hop: kind === 'cheer' ? .2 * Math.sin(Math.PI * ease(t / EMOTE_SECONDS)) ** 2 : 0,
    spin: kind === 'spin' ? Math.PI * 2 * ease(t / EMOTE_SECONDS) : 0 };
}

/** The shipped rig has downward (+local Y) arms, but no elbows. Add joints in bind space. */
export function prepareEmoteRig(rig: Object3D) {
  for (const side of ['L', 'R']) {
    const arm = rig.getObjectByName(`Arm_${side}`);
    if (!(arm instanceof Bone) || rig.getObjectByName(`Elbow_${side}`)) continue;
    const elbow = new Bone(); elbow.name = `Elbow_${side}`; elbow.position.y = .18;
    const hand = new Bone(); hand.name = `Hand_${side}`; hand.position.y = .22;
    arm.add(elbow); elbow.add(hand);
  }
  rig.traverse(node => { if (node instanceof SkinnedMesh) articulateSleeves(node, rig); });
}

/** Extend each private skeleton and geometry, including equipped tops, without changing cached GLBs. */
export function articulateSleeves(mesh: SkinnedMesh, rig: Object3D) {
  if (mesh.userData.emoteSkin) return;
  const original = mesh.skeleton, bones = [...original.bones], inverses = original.boneInverses.map(m => m.clone());
  const arms = ['L', 'R'].flatMap(side => {
    const index = bones.findIndex(b => b.name === `Arm_${side}`), elbow = rig.getObjectByName(`Elbow_${side}`);
    if (index < 0 || !(elbow instanceof Bone)) return [];
    const target = bones.length; bones.push(elbow);
    inverses.push(new Matrix4().makeTranslation(0, -.18, 0).multiply(inverses[index]));
    return [{ index, target }];
  });
  if (!arms.length) return;
  mesh.geometry = mesh.geometry.clone();
  const positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
  const point = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    for (let j = 0; j < 4; j++) {
      const arm = arms.find(a => a.index === indices.getComponent(i, j));
      if (!arm || weights.getComponent(i, j) === 0) continue;
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.bindMatrix).applyMatrix4(inverses[arm.index]);
      if (point.y > .18) indices.setComponent(i, j, arm.target);
    }
  }
  mesh.bind(new Skeleton(bones, inverses), mesh.bindMatrix.clone());
  mesh.userData.emoteSkin = true;
}

/** Restore last frame before the mixer runs; offsets never accumulate or affect another villager. */
export function emoteAnimator(rig: Object3D) {
  const names = ['Arm_L', 'Arm_R', 'Elbow_L', 'Elbow_R', 'Head', 'Spine', 'Root'];
  const nodes = names.map(name => rig.getObjectByName(name));
  let restore: (() => void) | undefined;
  return {
    reset() { restore?.(); restore = undefined; },
    apply(kind: Emote, seconds: number) {
      const saved = nodes.map(node => node && { node, q: node.quaternion.clone(), p: node.position.clone() });
      restore = () => saved.forEach(s => { if (s) { s.node.quaternion.copy(s.q); s.node.position.copy(s.p); } });
      const p = emotePose(kind, seconds);
      const rotate = (name: string, axis: Vector3, angle: number) => {
        const node = nodes[names.indexOf(name)]; if (node) node.quaternion.multiply(new Quaternion().setFromAxisAngle(axis, angle));
      };
      const z = new Vector3(0, 0, 1);
      rotate('Arm_R', z, p.right); rotate('Arm_L', z, -p.left);
      rotate('Elbow_R', z, p.elbow); rotate('Elbow_L', z, kind === 'wave' ? 0 : -p.elbow);
      rotate('Spine', z, p.lean); rotate('Head', z, p.tilt);
      rotate('Root', new Vector3(0, 1, 0), p.spin);
      const root = nodes[6]; if (root) root.position.y += p.hop;
    },
  };
}
