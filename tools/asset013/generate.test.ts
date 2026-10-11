import { test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// This integration test has no HTTP listener or database. It can safely use the
// runner's parallel test lane while browser jobs retain their shared port lock.
test('Blender emits the complete skinned, three-channel, RGBA wearable pack', async () => {
  const child = Bun.spawn(['python', join(import.meta.dir, 'run.py')], {stdout:'inherit',stderr:'inherit'});
  expect(await child.exited).toBe(0);
  const models=join(import.meta.dir,'artifacts/models');
  const names=readdirSync(models).filter(n=>n.endsWith('.glb'));
  expect(names).toHaveLength(19);
  for(const name of names) {
    const bytes=readFileSync(join(models,name));
    expect(bytes.length).toBeLessThan(150*1024);
    expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
    const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    const materials=data.materials.map((m:{name:string})=>m.name);
    for(const channel of ['primary','secondary','accent'])expect(materials).toContain(channel);
    if(!name.startsWith('eyewear'))expect(data.skins.length).toBeGreaterThan(0);
    const png=readFileSync(join(import.meta.dir,'artifacts/thumbs',name.replace('.glb','.png')));
    expect(png.readUInt32BE(16)).toBe(512);expect(png.readUInt32BE(20)).toBe(512);expect(png[25]).toBe(6);
  }
},600000);
