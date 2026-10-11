import { expect, test } from 'bun:test';
import { Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial, Box3, Vector3, Skeleton, SkinnedMesh, SphereGeometry, Uint16BufferAttribute, Float32BufferAttribute } from 'three';
import { attachCosmetic, headBounds, headAnchors, fallbackCosmetic } from './cosmeticAssets';
import { attachHead } from './headAssets';
import { cloneModel } from './OptionalModel';
import { equipmentFor } from '../api/equipment';
import { geometryBounds, geometryPoints, headFrame } from './headFit';
import { entriesById } from '../../../../packages/catalog/dist/catalog';
import { outfitLayers } from './outfitLayers';
import { hatOpening } from './hatFit';

test('missing-model clothing honors item palettes without changing the fallback source', () => {
  const rig = new Group(), head = new Group(); head.name = 'Head'; rig.add(head);
  const item = {...equipmentFor('hat_beanie'), colors:{primary:'#689b68'}};
  const source = fallbackCosmetic(item), attachment = attachCosmetic(rig, source, item)!;
  const colors: string[] = [];
  attachment.instance.traverse(node => { if (node instanceof Mesh) colors.push((node.material as MeshStandardMaterial).color.getHexString()); });
  expect(colors).toContain('689b68');
  expect(((source.children[0] as Mesh).material as MeshStandardMaterial).color.getHexString()).toBe('bc6651');
  attachment.dispose();
});

test('crown ellipse ignores long lower hair and is stable under duplicated vertices', () => {
  const mesh = new Mesh(new SphereGeometry(.4,32,24)); mesh.position.y=.4;
  const points=geometryPoints(mesh,new Group()), bounds=new Box3().setFromPoints(points);
  const clean=headFrame(bounds,points).skull;
  const hair=[new Vector3(-.9,.2,-.8),new Vector3(.9,.2,-.8)];
  const hairy=headFrame(new Box3().setFromPoints([...points,...hair]),[...points,...hair]).skull;
  expect(hairy.width).toBeCloseTo(clean.width,4);
  expect(hairy.depth).toBeCloseTo(clean.depth,4);
  expect(hairy.center.distanceTo(clean.center)).toBeLessThan(.00001);
  expect(headFrame(bounds,[...points,...points]).skull.width).toBeCloseTo(clean.width,3);
});

test('hat compression restores owned head geometry and opening fit is identical across display transforms', () => {
  const source=new SphereGeometry(.4,24,16), original=Array.from(source.attributes.position.array);
  const fits: number[][]=[];
  for(const size of [1,1.8,1.7,1.6,.3]) {
    const rig=new Group(), bone=new Bone();bone.name='Head';rig.add(bone);
    rig.scale.setScalar(size);rig.position.set(size*3,-size,size*2);rig.rotation.y=size;
    const head=new Mesh(source);head.position.y=.4;
    const detach=attachHead(rig,head)!;
    const item=equipmentFor('hat_cap');
    const attachment=attachCosmetic(rig,fallbackCosmetic(item),item)!;
    expect(head.geometry).not.toBe(source);
    const before=geometryBounds(attachment.instance,bone);
    fits.push([...before.min.toArray(),...before.max.toArray()]);
    attachment.fit();expect(geometryBounds(attachment.instance,bone).max.distanceTo(before.max)).toBeLessThan(.000001);
    attachment.dispose();expect(head.geometry).toBe(source);
    expect(Array.from(source.attributes.position.array)).toEqual(original);
    detach();
  }
  for(const fit of fits)fit.forEach((v,i)=>expect(v).toBeCloseTo(fits[0][i],5));
});

test('generated headphone cups reach both ear points and the band clears the crown', () => {
  const rig = new Group(), bone = new Bone(); bone.name = 'Head'; rig.add(bone);
  rig.position.set(4, 2, -8); rig.rotation.y = 1.3; rig.scale.setScalar(0.3);
  const head = new Mesh(new BoxGeometry(0.6, 0.8, 0.5)); head.position.y = 0.4;
  const detach = attachHead(rig, head)!;
  const source = new Group();
  for (const [name, x] of [['ear_cushion', -2], ['ear_cushion.001', 2]] as const) {
    const cup = new Mesh(new BoxGeometry(0.5, 1, 0.7)); cup.name = name; cup.position.set(x, 1, 0); source.add(cup);
  }
  const band = new Mesh(new BoxGeometry(4, 0.2, 0.2)); band.name = 'headband'; band.position.y = 3; source.add(band);
  source.position.set(0.3, 2, -0.2); source.scale.setScalar(0.4);
  const attachment = attachCosmetic(rig, source, equipmentFor('hat_headphones'))!;
  const frame = head.userData.fitFrame;
  for (const [name, ear] of [['ear_cushion', frame.ears[0]], ['ear_cushion.001', frame.ears[1]]] as const) {
    const actual = geometryBounds(attachment.instance.getObjectByName(name)!, bone).getCenter(new Vector3());
    expect(actual.distanceTo(ear)).toBeLessThan(0.00001);
  }
  expect(geometryBounds(attachment.instance, bone).max.y).toBeCloseTo(frame.top + frame.size.y * 0.04);
  const before = geometryBounds(attachment.instance, bone); attachment.fit();
  expect(geometryBounds(attachment.instance, bone).min.distanceTo(before.min)).toBeLessThan(0.00001);
  expect(source.position.toArray()).toEqual([0.3, 2, -0.2]);
  attachment.dispose(); detach();
});

test('generated-only catalog overrides apply after slot fitting and repeated fits do not accumulate', () => {
  const entry = entriesById.get('hat_cap')!, previous = entry.fit;
  entry.fit = {generated: {offset: [0.1, -0.1, 0.05], scale: [0.9, 0.8, 1.1]}};
  try {
    const rig = new Group(), bone = new Bone(); bone.name = 'Head'; rig.add(bone);
    const head = new Mesh(new BoxGeometry(0.6, 0.8, 0.5)); head.position.y = 0.4;
    const detach = attachHead(rig, head)!;
    const attachment = attachCosmetic(rig, new Mesh(new BoxGeometry(1, 0.3, 0.8)), equipmentFor('hat_cap'))!;
    const frame = head.userData.fitFrame, bounds = geometryBounds(attachment.instance, bone);
    attachment.instance.updateMatrix();
    const opening = new Box3().setFromPoints(hatOpening(attachment.instance,'hat_cap').map(p=>p.applyMatrix4(attachment.instance.matrix))).getCenter(new Vector3());
    expect(opening.y).toBeCloseTo(frame.skull.seat - frame.size.y * .1);
    expect(opening.x).toBeCloseTo(frame.skull.center.x + frame.size.x * 0.1);
    expect(opening.z).toBeCloseTo(frame.skull.center.z + frame.size.z * 0.05);
    attachment.fit(); expect(geometryBounds(attachment.instance, bone).max.distanceTo(bounds.max)).toBeLessThan(0.00001);
    detach(); attachment.fit(); expect(attachment.instance.rotation.x).toBe(-.055);
    attachment.dispose();
  } finally { entry.fit = previous; }
});

test('cosmetics attach to own bones, fit generated bounds, and never tint shared sources', () => {
  const source = new Group(), head = new Bone(), spine = new Bone(); head.name = 'Head'; spine.name = 'Spine'; source.add(head, spine);
  const preset = new Mesh(new BoxGeometry(0.72, 0.72, 0.6), new MeshStandardMaterial()); preset.name = 'head'; preset.position.y = 0.36; head.add(preset);
  const a = cloneModel(source, 1.8), b = cloneModel(source, 1.8);
  const jacketMaterial = new MeshStandardMaterial({color:'#ffffff'}); jacketMaterial.name = 'jacket';
  const clothing = new Mesh(new BoxGeometry(0.7, 0.2, 0.6), jacketMaterial);
  const hat = attachCosmetic(a, clothing, equipmentFor('hat_cap'))!;
  const jacket = attachCosmetic(a, clothing, equipmentFor('jacket_denim'))!;
  expect(hat.instance.parent).toBe(a.getObjectByName('Head')!);
  expect(jacket.instance.parent).toBe(a.getObjectByName('Spine')!);
  expect(b.getObjectByName('cosmetic:hat_cap')).toBeUndefined(); expect(source.getObjectByName('cosmetic:hat_cap')).toBeUndefined();
  expect(jacketMaterial.color.getHexString()).toBe('ffffff');
  expect(Array.isArray((jacket.instance.children[0] as Mesh).material)).toBe(false);
  expect(((jacket.instance.children[0] as Mesh).material as MeshStandardMaterial).color.getHexString()).toBe('557ca7');
  const y = hat.instance.position.y;
  const generated = new Mesh(new BoxGeometry(1.2, 1.5, 0.8), new MeshStandardMaterial()); generated.position.y = 0.75;
  const detach = attachHead(a, generated)!; hat.fit();
  expect(hat.instance.position.y).not.toBe(y);
  expect(headBounds(a.getObjectByName('Head')!).max.y).toBeLessThan(0.756);
  const glasses = attachCosmetic(a, clothing, equipmentFor('glasses_round'))!;
  const frame = headAnchors(headBounds(a.getObjectByName('Head')!));
  expect(glasses.instance.position.z + 0.3 * glasses.instance.scale.z).toBeCloseTo(frame.front - frame.size.z * 0.1);
  expect(0.7 * glasses.instance.scale.x).toBeCloseTo(frame.earWidth * 0.9);
  const before = headBounds(a.getObjectByName('Head')!); hat.fit();
  expect(headBounds(a.getObjectByName('Head')!).equals(before)).toBe(true);
  detach(); hat.fit(); expect(hat.instance.position.y).toBeCloseTo(y);
  hat.dispose(); jacket.dispose(); glasses.dispose();
  expect(a.getObjectByName('cosmetic:hat_cap')).toBeUndefined();
  expect(new Box3().setFromObject(clothing).isEmpty()).toBe(false);
});

test('anchors use loaded head top, 55% eye line and width, including small heads', () => {
  const anchor = headAnchors(new Box3(new Vector3(-0.1, 0.2, -0.2), new Vector3(0.26, 1, 0.4)));
  expect(anchor.top).toBe(1);
  expect(anchor.eyeLine).toBeCloseTo(0.64);
  expect(anchor.earWidth).toBeCloseTo(0.36);
  expect(anchor.scale).toBeCloseTo(0.5);
  expect(anchor.center.toArray()).toEqual([0.08, 0.6, 0.1]);
});

test('hoodie skeleton cannot steal the generated head; load and detach refit cosmetics', () => {
  const rig = new Group(), head = new Bone(), spine = new Bone();
  head.name = 'Head'; spine.name = 'Spine'; spine.add(head); rig.add(spine);
  rig.position.set(12, -3, 9); rig.rotation.y = 1.2; rig.scale.setScalar(0.4);
  // Real villager_base has skinned head meshes alongside the skeleton, not below Head.
  const preset = new Mesh(new BoxGeometry(0.72, 0.72, 0.6), new MeshStandardMaterial());
  preset.name = 'head'; rig.add(preset);
  const hoodie = new Group(), duplicate = new Bone(); duplicate.name = 'Head';
  duplicate.position.y = 3; hoodie.add(duplicate);
  const jacket = attachCosmetic(rig, hoodie, equipmentFor('shirt_hoodie'))!;
  const glasses = attachCosmetic(rig, fallbackCosmetic(equipmentFor('glasses_round')), equipmentFor('glasses_round'))!;
  const initialY = glasses.instance.position.y;
  const refit = () => glasses.fit(); rig.addEventListener('headchange' as never, refit);
  const generated = new Mesh(new BoxGeometry(1.2, 1.5, 0.8), new MeshStandardMaterial());
  generated.position.set(0.1, 0.75, 0.05);
  const detach = attachHead(rig, generated)!;
  expect(generated.parent).toBe(head);
  expect(glasses.instance.parent).toBe(head);
  expect(preset.visible).toBe(false);
  expect(head.visible).toBe(true);
  expect(jacket.instance.getObjectByName('Head')!.children).toHaveLength(0);
  expect(headBounds(head).min.y).toBeCloseTo(-0.36);
  expect(headBounds(head).max.y).toBeCloseTo(0.396);
  expect(glasses.instance.position.y).toBeCloseTo(-0.36 + 0.756 * 0.55);
  const glassesWidth = new Box3().setFromObject(glasses.instance.children[0]).getSize(new Vector3()).x;
  expect(glassesWidth).toBeGreaterThan(0);
  detach();
  expect(preset.visible).toBe(true);
  expect(glasses.instance.position.y).toBeCloseTo(initialY);
  rig.removeEventListener('headchange' as never, refit);
  jacket.dispose(); glasses.dispose();
});

test('headphones preserve authored model transforms and fit without a box fallback', () => {
  const rig = new Group(), head = new Bone(); head.name = 'Head'; rig.add(head);
  const source = fallbackCosmetic(equipmentFor('hat_headphones'));
  source.scale.setScalar(0.5); source.position.set(0.2, 0.3, 0.1);
  const headphones = attachCosmetic(rig, source, equipmentFor('hat_headphones'))!;
  const fitted = new Box3().setFromObject(headphones.instance);
  expect(headphones.instance.children[0].scale.x).toBe(0.5);
  const frame = headAnchors(headBounds(head));
  for (const [name, ear] of [['ear_cushion', frame.ears[0]], ['ear_cushion.001', frame.ears[1]]] as const) {
    expect(geometryBounds(headphones.instance.getObjectByName(name)!, head).getCenter(new Vector3()).distanceTo(ear)).toBeLessThan(0.00001);
  }
  expect(fitted.getCenter(new Vector3()).x).toBeCloseTo(0);
  expect(fitted.max.y).toBeCloseTo(frame.top + frame.size.y * 0.04);
  expect(source.children).toHaveLength(3);
  headphones.dispose();
});

test('glasses and headphones follow the corrected socket, including a forward-offset preset face', () => {
  const rig = new Group(), bone = new Bone(); bone.name = 'Head'; rig.add(bone);
  const preset = new Mesh(new BoxGeometry(.72,.72,.6)); preset.name = 'head'; preset.position.set(.2,.4,.3);rig.add(preset);
  const neck = new Mesh(new BoxGeometry(.2,.2,.2));neck.name='neck';neck.position.set(-.1,0,-.15);rig.add(neck);
  const items = ['glasses_round','hat_headphones'].map(id => attachCosmetic(rig,fallbackCosmetic(equipmentFor(id)),equipmentFor(id))!);
  const refit = () => items.forEach(item=>item.fit());rig.addEventListener('headchange' as never,refit);
  const head = new Mesh(new BoxGeometry(1,2,1));head.position.set(3,-2,7);
  const detach = attachHead(rig,head)!;
  const frame = head.userData.fitFrame;
  expect(frame.center.x).toBeCloseTo(-.1);expect(frame.center.z).toBeCloseTo(-.15);
  const glasses = geometryBounds(items[0].instance,bone);
  expect(glasses.getCenter(new Vector3()).x).toBeCloseTo(frame.center.x);
  expect(Math.abs(glasses.max.z - frame.front)).toBeLessThan(frame.size.z * .15);
  for (const [name,ear] of [['ear_cushion',frame.ears[0]],['ear_cushion.001',frame.ears[1]]] as const) {
    expect(geometryBounds(items[1].instance.getObjectByName(name)!,bone).getCenter(new Vector3()).distanceTo(ear)).toBeLessThan(1e-5);
  }
  detach();rig.removeEventListener('headchange' as never,refit);items.forEach(item=>item.dispose());
});

test('hats and headphones are exclusive; mantle overlays the top and scarf', () => {
  const items = ['hat_headphones', 'shirt_hoodie', 'scarf', 'champion_mantle', 'glasses_round', 'hat_cap'].map(equipmentFor);
  expect(outfitLayers(items).map(i => i.item_id)).toEqual(['shirt_hoodie', 'scarf', 'champion_mantle', 'glasses_round', 'hat_cap']);
  expect(outfitLayers(items, true).filter(i => i.slot === 'head').map(i => i.asset_key)).toEqual(['hat_crown']);
  expect(items).toHaveLength(6);
});

test('base glasses use actual skinned sibling eye positions under a transformed rig', () => {
  const rig = new Group(), head = new Bone(); head.name = 'Head'; rig.add(head);
  rig.scale.setScalar(0.31); rig.rotation.y = 1.2; rig.position.set(12, -3, 9);
  const preset = new Mesh(new BoxGeometry(.6, .8, .5)); preset.name = 'head'; preset.position.y = .5; rig.add(preset);
  for (const x of [-.12, .12]) { const eye = new Mesh(new BoxGeometry(.04, .04, .04)); eye.name = x < 0 ? 'eye' : 'eye001'; eye.position.set(x, .67, .28); rig.add(eye); }
  const item = equipmentFor('glasses_round');
  const a = attachCosmetic(rig, fallbackCosmetic(item), item)!;
  const center = geometryBounds(a.instance, head).getCenter(new Vector3());
  expect(center.x).toBeCloseTo(0); expect(center.y).toBeCloseTo(.67);
  a.fit(); expect(geometryBounds(a.instance, head).getCenter(new Vector3()).distanceTo(center)).toBeLessThan(.00001);
  a.dispose();
});

test('skinned tops cover base sleeve corners and restore visibility on unequip', () => {
  const rig = new Group(), spine = new Bone(); spine.name = 'Spine'; rig.add(spine);
  const left = new Mesh(new BoxGeometry(.24, .24, .24)), right = left.clone();
  left.name = 'sleeve_L'; right.name = 'sleeve_R'; right.visible = false; rig.add(left, right);
  const source = new Group(), sourceBone = new Bone(); sourceBone.name = 'Spine'; source.add(sourceBone);
  const geometry = new BoxGeometry(.6, .5, .6), count = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(Array.from({length: count * 4}, (_, i) => i % 4 ? 0 : 1), 4));
  const top = new SkinnedMesh(geometry, new MeshStandardMaterial()); top.name = 'torso'; source.add(top);
  top.bind(new Skeleton([sourceBone]));
  const authored = geometryBounds(top, sourceBone);
  source.scale.setScalar(.37); source.position.set(3, -2, 7); source.rotation.y = 1.2;
  // No renderer tick: fitting must already see the same bone-local dimensions.
  expect(geometryBounds(top, sourceBone).getSize(new Vector3()).distanceTo(authored.getSize(new Vector3()))).toBeLessThan(.00001);
  source.scale.setScalar(1); source.position.set(0, 0, 0); source.rotation.set(0, 0, 0);
  const first = attachCosmetic(rig, source, equipmentFor('shirt_hoodie'))!;
  const second = attachCosmetic(rig, source, equipmentFor('jacket_denim'))!;
  expect(left.visible).toBe(false); expect(right.visible).toBe(false);
  first.dispose(); expect(left.visible).toBe(false);
  second.dispose(); expect(left.visible).toBe(true); expect(right.visible).toBe(false);
  expect(source.getObjectByName('torso')!.visible).toBe(true);
});
