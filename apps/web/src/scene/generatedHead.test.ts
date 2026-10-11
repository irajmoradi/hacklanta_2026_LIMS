import { expect, test } from 'bun:test';
import { Bone, Group, Mesh, BoxGeometry, Box3, Vector3, MeshStandardMaterial } from 'three';
import { cloneModel } from './OptionalModel';
import { attachHead, headFallback } from './headAssets';
import type { AvatarManifest } from '../api/types';
import { geometryBounds, normalizedHeadFit, headFrame, headNeckAnchor } from './headFit';

test('arbitrary translated and differently sized head boxes center over the neck, not the face', () => {
  const base = new Box3(new Vector3(-.3, 0, .1), new Vector3(.3, .7, .7));
  const socket = new Vector3(.12, -.1, -.2);
  for (const x of [-100, -1, 0, 3]) for (const z of [-20, 0, 7]) for (const height of [.01, 1, 15]) {
    const bounds = new Box3(new Vector3(x, 5, z), new Vector3(x + height * .8, 5 + height, z + height * .6));
    const fit = normalizedHeadFit(bounds, base, socket.y, socket);
    const attached = headNeckAnchor(bounds).multiplyScalar(fit.scale).add(fit.offset);
    expect(attached.distanceTo(socket)).toBeLessThan(1e-9);
  }
});

test('an offset neck region anchors independently of protruding face geometry', () => {
  const bounds = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 3, 2));
  const points = [-.3,.3].flatMap(x => [-.7,-.1].map(z => new Vector3(x, 0, z)));
  const anchor = headNeckAnchor(bounds, points);
  expect(anchor.x).toBeCloseTo(0); expect(anchor.y).toBeCloseTo(0); expect(anchor.z).toBeCloseTo(-.4);
  const fit = normalizedHeadFit(bounds, bounds, .1, new Vector3(.2, 0, -.3), points);
  expect(anchor.multiplyScalar(fit.scale).add(fit.offset).distanceTo(new Vector3(.2,.1,-.3))).toBeLessThan(1e-9);
  // A pointed chin or a broad hair skirt cannot reliably identify a neck.
  expect(headNeckAnchor(bounds, [new Vector3(0,0,1)]).z).toBe(.5);
});

test('frame is +Z with ears at half height and normalization preserves proportions', () => {
  const bounds = new Box3(new Vector3(-2, 3, -1), new Vector3(4, 7, 2));
  const frame = headFrame(bounds);
  expect(frame.forward.toArray()).toEqual([0, 0, 1]);
  expect(frame.ears.map(p => p.toArray())).toEqual([[-2, 5, 0.5], [4, 5, 0.5]]);
  expect(frame.eyeLine).toBeCloseTo(5.2);
  const base = new Box3(new Vector3(-0.3, 0, -0.3), new Vector3(0.3, 0.6, 0.3));
  const fit = normalizedHeadFit(bounds, base, -0.05);
  const result = bounds.clone(); result.min.multiplyScalar(fit.scale).add(fit.offset); result.max.multiplyScalar(fit.scale).add(fit.offset);
  expect(result.min.y).toBeCloseTo(-0.05);
  expect(result.getSize(new Vector3()).y).toBeCloseTo(0.63);
  expect(result.getSize(new Vector3()).x / result.getSize(new Vector3()).y).toBeCloseTo(1.5);
  expect(result.getCenter(new Vector3()).x).toBeCloseTo(0);
});

test('nose landmark excludes side eyewear and derives the eye band width', () => {
  const bounds = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 2, 1));
  const points = [new Vector3(0, 0.7, 1), new Vector3(0.2, 1.2, 1.2),
    new Vector3(-0.8, 0.94, 0.8), new Vector3(0.8, 0.94, 0.8)];
  const frame = headFrame(bounds, points);
  expect(frame.eyeLine).toBeCloseTo(0.94);
  expect(frame.faceWidth).toBeCloseTo(1.6);
});

test('normalizes to base head and snaps to sibling neck under rotated scaled rigs; detach restores transform', () => {
  const rig = new Group(), bone = new Bone(); bone.name = 'Head'; bone.position.y = 1; rig.add(bone);
  const base = new Mesh(new BoxGeometry(0.6, 0.7, 0.5)); base.name = 'head'; base.position.set(.15, 1.4, .3); rig.add(base);
  const neck = new Mesh(new BoxGeometry(0.2, 0.2, 0.2)); neck.name = 'neck'; neck.position.y = 1; rig.add(neck);
  rig.position.set(10, 3, -5); rig.rotation.set(0.1, 1.7, 0); rig.scale.setScalar(0.4);
  const generated = new Mesh(new BoxGeometry(2, 3, 2)); generated.position.set(1, 4, 2); generated.scale.setScalar(2);
  generated.rotation.y = .7;
  const sourceParent = new Group(); sourceParent.position.set(50, -12, 30); sourceParent.scale.setScalar(3); sourceParent.add(generated);
  const before = generated.position.clone(), beforeScale = generated.scale.clone();
  const detach = attachHead(rig, generated)!;
  const bounds = geometryBounds(generated, bone);
  expect(bounds.getSize(new Vector3()).y).toBeCloseTo(0.735);
  expect(bounds.min.y).toBeCloseTo(0.093);
  expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0);
  expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(0);
  detach(); expect(generated.position.equals(before)).toBe(true); expect(generated.scale.equals(beforeScale)).toBe(true);
});

test('head attachment hides only the owning clone and restores original visibility', () => {
  const source = new Group(), bone = new Bone(); bone.name = 'Head'; source.add(bone);
  for (const name of ['head', 'hair_cap', 'eye', 'eye001', 'eye.001', 'nose', 'shirt']) {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial()); mesh.name = name; bone.add(mesh);
  }
  source.getObjectByName('nose')!.visible = false;
  const a = cloneModel(source, 1.8), b = cloneModel(source, 1.8), head = new Group();
  const detach = attachHead(a, head)!;
  expect(head.parent).toBe(a.getObjectByName('Head')!);
  expect(head.position.toArray()).toEqual([0, 0, 0]); expect(head.scale.toArray()).toEqual([1, 1, 1]);
  for (const name of ['head', 'hair_cap', 'eye', 'eye001', 'eye.001']) {
    expect(a.getObjectByName(name)!.visible).toBe(false);
    expect(b.getObjectByName(name)!.visible).toBe(true);
    expect(source.getObjectByName(name)!.visible).toBe(true);
  }
  expect(a.getObjectByName('shirt')!.visible).toBe(true);
  detach(); expect(head.parent).toBeNull(); expect(a.getObjectByName('head')!.visible).toBe(true);
  expect(a.getObjectByName('nose')!.visible).toBe(false);
  expect(attachHead(new Group(), head)).toBeNull();
});

test('fallback prefers GLB, then card, then preset for missing or broken assets', async () => {
  const body = {head_glb_url: 'head.glb', head_card_url: 'head.png'} as AvatarManifest['body'];
  const calls: string[] = [];
  expect(await headFallback(body, async url => { calls.push(url); return url; })).toEqual({kind: 'glb', value: 'head.glb'});
  expect(calls).toEqual(['head.glb']); calls.length = 0;
  expect(await headFallback(body, async url => { calls.push(url); if (url.endsWith('glb')) throw Error(); return url; })).toEqual({kind: 'card', value: 'head.png'});
  expect(calls).toEqual(['head.glb', 'head.png']);
  expect(await headFallback(body, async () => {throw Error();})).toEqual({kind: 'preset'});
  expect(await headFallback({} as AvatarManifest['body'], async () => {throw Error();})).toEqual({kind: 'preset'});
});
