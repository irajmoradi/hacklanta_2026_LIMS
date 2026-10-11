import { expect, test } from 'bun:test';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { cloneModel } from './OptionalModel';
import { staticMaterialLease } from './staticMaterials';

test('houses share immutable palette materials while animated glass stays private', () => {
  const source = new Group(), wall = new MeshStandardMaterial(), glass = new MeshStandardMaterial();
  wall.name = 'wall'; glass.name = 'glass';
  source.add(new Mesh(new BoxGeometry(), wall), new Mesh(new BoxGeometry(), glass));
  const a = staticMaterialLease(), b = staticMaterialLease(), c = staticMaterialLease();
  const models = [cloneModel(source, 1, {wall:'#123456'}, true, {}, a), cloneModel(source, 1, {wall:'#123456'}, true, {}, b), cloneModel(source, 1, {wall:'#abcdef'}, true, {}, c)];
  const materials = models.map(model => {const out: MeshStandardMaterial[] = []; model.traverse(n => {if (n instanceof Mesh) out.push(n.material as MeshStandardMaterial);}); return out;});
  expect(materials[0][0]).toBe(materials[1][0]);
  expect(materials[0][0]).not.toBe(materials[2][0]);
  expect(materials[0][1]).not.toBe(materials[1][1]);
  let disposed = 0; materials[0][0].addEventListener('dispose', () => disposed++);
  a.release(); expect(disposed).toBe(0);
  b.release(); expect(disposed).toBe(1);
  b.release(); expect(disposed).toBe(1);
  c.release();
});
