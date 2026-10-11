import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { AnimationMixer, Bone, Mesh, SphereGeometry, Object3D, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { emoteAnimator, emotePose, prepareEmoteRig, EMOTE_SECONDS } from './emotes';
import { attachHead } from './headAssets';
import { attachCosmetic } from './cosmeticAssets';
import { catalog } from '../../../../packages/catalog/dist/catalog';
import type { EquippedItem } from '../api/types';
async function glb(name: string) {
  const b = readFileSync(new URL(`../../public/models/${name}.glb`, import.meta.url));
  const loader = new GLTFLoader();
  loader.register(parser => { parser.loadTexture = async () => null as never; return {name:'test_geometry_only'}; });
  return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
}
const world = (rig: Object3D, name: string) => rig.getObjectByName(name)!.getWorldPosition(new Vector3());
test('keyframes ease in/out, three forearm sweeps, cheer hop and complete spin', () => {
  for (const kind of ['wave', 'cheer', 'spin'] as const) {
    expect(emotePose(kind, 0).weight).toBe(0);
    expect(emotePose(kind, EMOTE_SECONDS).weight).toBe(0);
    expect(emotePose(kind, .7).right).toBeGreaterThan(.9);
    expect(emotePose(kind, .001).weight).toBeLessThan(.0001);
  }
  let crossings = 0, last = 0;
  for (let i=1;i<900;i++) {
    const value=emotePose('wave', .25+i*.001).elbow-Math.PI/6;
    if (last && value*last<0) crossings++;
    last=value;
  }
  expect(crossings).toBe(5);
  expect(emotePose('cheer', .7).hop).toBeCloseTo(.2);
  expect(emotePose('spin', 1.4).spin).toBeCloseTo(2*Math.PI);
});
test('actual GLB hand rises above Head, bends at elbow, restores mixer pose without touching another clone', async () => {
  const source=await glb('villager_base'), rig=clone(source.scene), other=clone(source.scene);
  prepareEmoteRig(rig);
  const animator=emoteAnimator(rig), mixer=new AnimationMixer(rig);
  mixer.clipAction(source.animations.find(a=>a.name==='idle')!).play();mixer.update(.1);
  const arm=rig.getObjectByName('Arm_R')!, idle=arm.quaternion.clone(), untouched=other.getObjectByName('Arm_R')!.quaternion.clone();
  for (let frame=0;frame<10;frame++) { animator.reset();animator.apply('wave',.7); }
  rig.updateMatrixWorld(true);
  expect(world(rig,'Hand_R').y).toBeGreaterThan(world(rig,'Head').y);
  expect(world(rig,'Hand_R').x).toBeLessThan(world(rig,'Arm_R').x);
  expect(rig.getObjectByName('Elbow_R')!.rotation.z).toBeCloseTo(Math.PI/6);
  expect(other.getObjectByName('Arm_R')!.quaternion.equals(untouched)).toBe(true);
  const hand=rig.getObjectByName('hand_R') as SkinnedMesh;
  hand.skeleton.update();const center=new Vector3();
  for(let i=0;i<hand.geometry.getAttribute('position').count;i++) center.add(hand.getVertexPosition(i,new Vector3()).applyMatrix4(hand.matrixWorld));
  center.divideScalar(hand.geometry.getAttribute('position').count);
  expect(center.distanceTo(world(rig,'Hand_R'))).toBeLessThan(.1);
  animator.reset();expect(arm.quaternion.angleTo(idle)).toBeLessThan(.00001);
  expect(source.scene.getObjectByName('Elbow_R')).toBeUndefined();
});
test('every catalog torso retains fit and uses the animated elbow for distal sleeve vertices', async () => {
  const base=await glb('villager_base');let skinnedTops=0;
  for (const entry of catalog.entries.filter(e=>e.slot==='torso' && e.asset?.glb)) {
    const name=entry.asset!.glb.split('/').pop()!.replace('.glb','');
    const source=await glb(name), rig=clone(base.scene);prepareEmoteRig(rig);
    const item={item_id:entry.id, slot:'torso',asset_key:name} as EquippedItem;
    const attachment=attachCosmetic(rig,source.scene,item)!;
    const animator=emoteAnimator(rig);animator.apply('wave',.7);rig.updateMatrixWorld(true);
    attachment.instance.traverse(node=>{
      if (!(node instanceof SkinnedMesh)) return;
      skinnedTops++;
      expect(node.skeleton.bones).toContain(rig.getObjectByName('Elbow_R') as Bone);
      node.skeleton.update();
      const index=node.skeleton.bones.indexOf(rig.getObjectByName('Elbow_R') as Bone);
      const indices=node.geometry.getAttribute('skinIndex'), weights=node.geometry.getAttribute('skinWeight');
      for(let i=0;i<indices.count;i++) for(let j=0;j<4;j++) if(indices.getComponent(i,j)===index && weights.getComponent(i,j)>0) {
        const p=node.getVertexPosition(i,new Vector3()).applyMatrix4(node.matrixWorld);
        expect(p.toArray().every(Number.isFinite)).toBe(true);
        expect(p.distanceTo(world(rig,'Elbow_R'))).toBeLessThan(.6);
      }
    });
    animator.reset();attachment.dispose();
  }
  expect(skinnedTops).toBeGreaterThan(0);
});

test('generated head stays on the animated head joint; cheer lifts both hands', async () => {
  const {scene:rig}=await glb('villager_base');prepareEmoteRig(rig);
  // Synthetic generated geometry exercises the same normalization/attachment as downloaded heads.
  const head=new Mesh(new SphereGeometry(2,12,8));const detach=attachHead(rig,head)!;
  const local=head.position.clone(), animator=emoteAnimator(rig);
  animator.apply('wave',.7);rig.updateMatrixWorld(true);
  expect(head.parent).toBe(rig.getObjectByName('Head')!);
  expect(head.position.equals(local)).toBe(true);
  expect(rig.getObjectByName('Head')!.rotation.z).toBeCloseTo(.1);
  animator.reset();animator.apply('cheer',.7);rig.updateMatrixWorld(true);
  for(const side of ['L','R']) expect(world(rig,`Hand_${side}`).y).toBeGreaterThan(world(rig,'Head').y);
  animator.reset();detach();head.geometry.dispose();
});

