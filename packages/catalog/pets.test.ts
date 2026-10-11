import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { catalog } from './dist/catalog';

for (const id of ['pet_cat_tabby','pet_cat_black','pet_cat_calico','pet_pug','pet_husky','pet_bunny','pet_hamster']) {
  test(`${id} ships a coin-priced pet, thumbnail, and low-poly idle model`, async () => {
    const entry = catalog.entries.find(e => e.id === id)!;
    expect(entry.kind).toBe('pet'); expect(entry.slot).toBe('pet');
    expect(entry.price_coins).toBeGreaterThan(0);
    expect(entry.tags).toContain('shop');
    expect(entry.tags?.includes('followable')).toBe(!['pet_bunny','pet_hamster'].includes(id));
    const root = join(import.meta.dir, '../../apps/web/public');
    const bytes = await Bun.file(join(root, entry.asset!.glb.slice(1))).arrayBuffer();
    const header = new DataView(bytes);
    expect(header.getUint32(0,true)).toBe(0x46546c67);
    expect(header.getUint32(4,true)).toBe(2);
    expect(header.getUint32(8,true)).toBe(bytes.byteLength);
    expect(header.getUint32(16,true)).toBe(0x4e4f534a);
    const gltf = JSON.parse(new TextDecoder().decode(bytes.slice(20,20+header.getUint32(12,true))));
    const triangles = gltf.meshes.reduce((n:number,mesh:any) => n + mesh.primitives.reduce((sum:number,p:any) => sum + gltf.accessors[p.indices].count/3,0),0);
    expect(triangles).toBeGreaterThan(0); expect(triangles).toBeLessThanOrEqual(1500);
    expect(gltf.nodes.some((node:any) => node.name === 'idle_bob')).toBe(true);
    const thumbnail = new Uint8Array(await Bun.file(join(root, `thumbs/${id}.png`)).arrayBuffer());
    expect([...thumbnail.slice(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  });
}
