import { test, expect } from 'bun:test';
import { mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

test('catalog CLI validates additions and emits the matching client registry', async () => {
  const cwd=resolve(import.meta.dir,'../../packages/catalog');
  for(const command of [['bun','install','--frozen-lockfile'],['bun','run','validate'],['bun','test']]) {
    const child=Bun.spawn(command,{cwd,stdout:'inherit',stderr:'inherit'});
    expect(await child.exited).toBe(0);
  }
  const raw=JSON.parse(readFileSync(join(cwd,'catalog.json'),'utf8'));
  const {catalogData}=await import(join(cwd,'dist/catalog.ts'));
  expect(catalogData).toEqual(raw);
  expect(catalogData.entries.filter((e:{tags?:string[]})=>e.tags?.includes('asset013'))).toHaveLength(19);
  mkdirSync(join(import.meta.dir,'artifacts'),{recursive:true});
  copyFileSync(join(cwd,'dist/catalog.ts'),join(import.meta.dir,'artifacts/catalog.ts'));
},120000);
