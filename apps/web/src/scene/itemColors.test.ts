import { expect, test } from 'bun:test';
import { Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial, SkinnedMesh, Vector3, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachCosmetic, fallbackCosmetic } from './cosmeticAssets';
import { materialColor } from './itemColors';

const firstMesh = (root: Object3D) => { let found: Mesh | undefined; root.traverse(node => { if (!found && node instanceof Mesh) found = node; }); return found!; };

test('tint named materials per instance without touching cache, geometry or another villager', () => {
  const source = new Group(), rig = new Group(), head = new Group(); head.name = 'Head'; rig.add(head);
  const materials = ['primary','secondary','accent','skin'].map(name => { const m = new MeshStandardMaterial({color:'#ffffff'}); m.name = name; return m; });
  source.add(new Mesh(new BoxGeometry(1,1,1), materials));
  const colors = {primary:'#bc6651', secondary:'#123456', accent:'#654321'};
  const a = attachCosmetic(rig, source, {item_id:'a',slot:'head',asset_key:null,colors})!;
  const b = attachCosmetic(rig, source, {item_id:'b',slot:'head',asset_key:null})!;
  const result = firstMesh(a.instance).material as MeshStandardMaterial[];
  expect(result.map(m => m.color.getHexString())).toEqual(['bc6651','123456','654321','ffffff']);
  expect(materials.every(m => m.color.getHexString() === 'ffffff')).toBe(true);
  expect((firstMesh(b.instance).material as MeshStandardMaterial[])[0].color.getHexString()).toBe('ffffff');
  a.dispose(); b.dispose();
});

test('legacy channels, omitted channels and offline geometry', () => {
  expect(materialColor('jacket',{primary:'#123456'})).toBe('#123456');
  expect(materialColor('accent',{primary:'#123456'},false)).toBe('#123456');
  expect(materialColor('secondary',{primary:'#123456'})).toBeUndefined();
  expect(materialColor('primary',{primary:'red'})).toBeUndefined();
  const item = {item_id:'a',slot:'torso' as const,asset_key:null,colors:{primary:'#123456'}};
  const rig = new Group(), spine = new Group(); spine.name = 'Spine'; rig.add(spine);
  const attached = attachCosmetic(rig,fallbackCosmetic(item),item)!;
  expect((firstMesh(attached.instance).material as MeshStandardMaterial).color.getHexString()).toBe('123456');
  attached.dispose();
});

test('all six exported tops rebind to the living avatar and follow its arm pose', async () => {
  const load = async (name: string) => (await new GLTFLoader().parseAsync(await Bun.file(`${import.meta.dir}/../../public/models/${name}.glb`).arrayBuffer(), '')).scene;
  const base = await load('villager_base');
  for (const style of ['hoodie','sweater','tee','flannel','overalls','varsity']) {
    const source = await load(`outfit_${style}`);
    const attached = attachCosmetic(base, source, {item_id:style,asset_key:`outfit_${style}`,slot:'torso',colors:{primary:'#123456'}})!;
    let sleeve: SkinnedMesh | undefined;
    attached.instance.traverse(node => { if (node instanceof SkinnedMesh && node.name.startsWith('sleeve')) sleeve = node; });
    expect(sleeve).toBeDefined();
    const arm = base.getObjectByName('Arm_L') as Bone;
    expect(sleeve!.skeleton.bones).toContain(arm);
    base.updateMatrixWorld(true); sleeve!.skeleton.update();
    const before = sleeve!.getVertexPosition(0,new Vector3());
    // Both sleeves must move, irrespective of exporter object ordering.
    const arms = ['Arm_L','Arm_R'].map(name => base.getObjectByName(name)!);
    arms.forEach(bone => { bone.rotation.x += .5; });
    base.updateMatrixWorld(true); sleeve!.skeleton.update();
    expect(sleeve!.getVertexPosition(0,new Vector3()).distanceTo(before)).toBeGreaterThan(.02);
    arms.forEach(bone => { bone.rotation.x -= .5; });
    attached.dispose();
  }
});
