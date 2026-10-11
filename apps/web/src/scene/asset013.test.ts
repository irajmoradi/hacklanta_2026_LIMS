import { expect, test } from 'bun:test';
import { readFileSync, statSync } from 'node:fs';
import { AnimationMixer, Bone, Box3, Mesh, MeshStandardMaterial, SkinnedMesh, SphereGeometry, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { catalogData, entriesById } from '../../../../packages/catalog/dist/catalog';
import { attachCosmetic, fallbackCosmetic } from './cosmeticAssets';
import { equipmentFor, replaceSlot } from '../api/equipment';
import { outfitLayers } from './outfitLayers';
import { cloneModel } from './OptionalModel';
import { attachHead } from './headAssets';
import { geometryBounds } from './headFit';

const items = catalogData.entries.filter(e => e.tags?.includes('asset013'));
async function load(name: string) {
  const data=readFileSync(new URL(`../../public/models/${name}.glb`,import.meta.url));
  return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
}

test('catalog counts, independent slots, level locks and 512 RGBA thumbnail guard', () => {
  expect(items).toHaveLength(19);
  expect(items.filter(e=>e.slot==='bottoms')).toHaveLength(6);
  expect(items.filter(e=>e.slot==='shoes')).toHaveLength(6);
  expect(items.filter(e=>e.slot==='face')).toHaveLength(7);
  expect(entriesById.get('shoes_sneakers')?.slot).toBe('decoration');
  expect(entriesById.get('shoes_boots')?.slot).toBe('decoration');
  expect(items.filter(e=>e.unlock?.village_level===2).length).toBeGreaterThanOrEqual(2);
  for (const entry of items) {
    expect(entry.price_coins).toBeGreaterThan(0);
    expect(entry.asset?.tint_materials).toEqual(['primary','secondary','accent']);
    expect(statSync(new URL(`../../public${entry.asset!.glb}`,import.meta.url)).size).toBeLessThan(150*1024);
    const png=readFileSync(new URL(`../../public/thumbs/${entry.id}.png`,import.meta.url));
    expect(png.subarray(1,4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(512); expect(png.readUInt32BE(20)).toBe(512); expect(png[25]).toBe(6);
  }
  let equipped=['outfit_tee','bottoms_jeans','footwear_sneakers','eyewear_heart'].map(equipmentFor);
  equipped=replaceSlot(equipped,equipmentFor('bottoms_chinos'));
  expect(outfitLayers(equipped).map(e=>e.item_id).sort()).toEqual(['outfit_tee','bottoms_chinos','footwear_sneakers','eyewear_heart'].sort());
});

test('every lower wearable shares living legs, tracks idle/walk/sit and restores coverage', async () => {
  const base=await load('villager_base');
  for (const entry of items.filter(e=>e.slot!=='face')) {
    const source=await load(entry.id), rig=cloneModel(base.scene,1.8);
    const item={...equipmentFor(entry.id),colors:{primary:'#8876a8',secondary:'#ffe4a1',accent:'#689b68'}};
    const attached=attachCosmetic(rig,source.scene,item)!;
    const meshes: SkinnedMesh[]=[];
    attached.instance.traverse(n=>{if(n instanceof SkinnedMesh)meshes.push(n);});
    expect(meshes.length).toBeGreaterThan(0);
    // GLTFLoader splits the one authored mesh into one primitive per material.
    expect(meshes.length).toBeLessThanOrEqual(4);
    const palette=new Map<string,string>();
    for (const m of meshes) {
      for(const side of ['L','R']) expect(m.skeleton.bones.find(b=>b.name===`Leg_${side}`)).toBe(rig.getObjectByName(`Leg_${side}`) as Bone);
      const colors=(Array.isArray(m.material)?m.material:[m.material]) as MeshStandardMaterial[];
      colors.forEach(m=>palette.set(m.name,m.color.getHexString()));
    }
    expect(palette.get('primary')).toBe('8876a8');
    expect(palette.get('secondary')).toBe('ffe4a1');
    expect(palette.get('accent')).toBe('689b68');
    const mixer=new AnimationMixer(rig);
    const bounds: Box3[]=[];
    for (const pose of ['idle','walk','sit']) {
      mixer.stopAllAction(); mixer.clipAction(base.animations.find(a=>a.name===(pose==='walk'?'walk':'idle'))!).play(); mixer.update(.16);
      if(pose==='sit') for(const side of ['L','R']) rig.getObjectByName(`Leg_${side}`)!.rotation.x=-Math.PI/2;
      rig.updateMatrixWorld(true); meshes.forEach(m=>m.skeleton.update());
      const box=new Box3().setFromObject(attached.instance,true);
      bounds.push(box);
      expect(box.isEmpty()).toBe(false); expect(box.getSize(new Vector3()).length()).toBeLessThan(2);
      // The garment encloses both base feet/legs even when those base meshes are hidden.
      for(const side of ['L','R']) {
        const body=rig.getObjectByName(`${entry.slot==='shoes'?'shoe':'leg'}_${side}`)!;
        expect(body.visible).toBe(false);
        const actual=new Box3().setFromObject(body,true);
        if(!['bottoms_shorts','bottoms_skirt','footwear_sandals'].includes(entry.id)) {
          expect(box.clone().expandByScalar(.025).containsBox(actual),`${entry.id} ${pose} ${side}`).toBe(true);
        } else {
          // Open garments replace the chunky base pants/shoes with smaller skin
          // geometry; their bounds must follow the same limb, not enclose a boot.
          expect(box.containsPoint(actual.getCenter(new Vector3())),`${entry.id} ${pose} ${side}`).toBe(true);
        }
      }
    }
    expect(bounds[0].getCenter(new Vector3()).distanceTo(bounds[2].getCenter(new Vector3()))).toBeGreaterThan(.05);
    attached.dispose();
    for(const side of ['L','R']) expect(rig.getObjectByName(`${entry.slot==='shoes'?'shoe':'leg'}_${side}`)!.visible).toBe(true);
  }
});

test('missing lower assets retain colored, articulated fixture clothing', async () => {
  const rig=(await load('villager_base')).scene;
  for(const id of ['bottoms_jeans','footwear_sneakers']) {
    const item=equipmentFor(id), source=fallbackCosmetic(item,rig), attached=attachCosmetic(rig,source,item)!;
    let count=0; attached.instance.traverse(n=>{if(n instanceof SkinnedMesh)count++;});
    expect(count).toBe(id.startsWith('bottoms') ? 3 : 2); attached.dispose();
  }
});

test('seven glasses fit measured head frames and expose all three tint channels', async () => {
  const base=await load('villager_base');
  for(const entry of items.filter(e=>e.slot==='face')) {
    expect(entriesById.get(entry.id)?.slot).toBe('face');
    const rig=cloneModel(base.scene,1.8), source=(await load(entry.id)).scene;
    const attached=attachCosmetic(rig,source,equipmentFor(entry.id))!;
    const box=new Box3().setFromObject(attached.instance,true);
    expect(box.getSize(new Vector3()).x).toBeGreaterThan(.3);
    expect(box.getSize(new Vector3()).x).toBeLessThan(.8);
    const names=new Set<string>(); source.traverse(n=>{if(n instanceof Mesh)for(const m of Array.isArray(n.material)?n.material:[n.material])names.add(m.name);});
    for(const name of ['primary','secondary','accent'])expect(names.has(name)).toBe(true);
    if(['eyewear_aviator','eyewear_sunglasses','eyewear_oversized'].includes(entry.id)) {
      const head=rig.getObjectByName('Head')!;
      const eyes=geometryBounds(rig,head,n=>/^eye/.test(n.name));
      expect(geometryBounds(attached.instance,head).max.z-eyes.max.z).toBeGreaterThan(.035);
    }
    const synthetic=new Mesh(new SphereGeometry(.4,24,16),new MeshStandardMaterial());
    synthetic.scale.set(.8,1.3,.9);
    const detach=attachHead(rig,synthetic)!;
    attached.fit();
    const head=rig.getObjectByName('Head')!;
    const frame=head.children.find(n=>n.userData.generatedHead)!.userData.fitFrame;
    const fitted=geometryBounds(attached.instance,head);
    expect(fitted.getSize(new Vector3()).x).toBeCloseTo(frame.faceWidth*.9,4);
    expect(fitted.max.z).toBeCloseTo(frame.front,4);
    attached.dispose();detach();
  }
});
