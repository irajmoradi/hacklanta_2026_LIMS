import {expect,test} from 'bun:test';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import * as catalog from '../../../../packages/catalog/dist/catalog';
import fallback from './catalog.fallback.json';
import metadata from '../../../api/app/overworld_layout.json';
import {mergeRegistry,normalizeCatalog,type Entry} from './registryData';
import {createTown,entrance} from './layout/town';

test('server metadata and seeded addresses match the rendered catalog',()=>{
  const entries=mergeRegistry(fallback.entries as Entry[],normalizeCatalog(catalog));
  const civic=entries.filter(e=>!e.tags?.includes('separate_scene')&&(e.placement?.district||e.kind==='building'));
  expect(metadata as unknown).toEqual(civic.map(e=>Object.fromEntries(['id','kind','placement','tags','unlock','requires'].filter(k=>k in e).map(k=>[k,e[k as keyof Entry]]))));
  const executable=resolve('../api/.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const result=Bun.spawnSync([existsSync(executable)?executable:'python','-c',`
import json
from app.overworld import layout
out=[]
for seed in (1337,24109,42):
 h,b,_=layout(seed,list(range(100)))
 out.append(dict(buildings={i:[l['x'],l['z']] for i,l in b.items() if not i.startswith('garden:')},homes={str(i):[l['x'],l['z']] for i,l in h.items()}))
print(json.dumps(out))
`],{cwd:resolve('../api')});
  expect(result.exitCode).toBe(0);
  const layouts=JSON.parse(result.stdout.toString());
  [1337,24109,42].forEach((seed,index)=>{
    const town=createTown(seed,entries,Array.from({length:100},(_,i)=>i));
    for(const lot of town.lots)if(lot.entry)expect(layouts[index].buildings[lot.entry.id]).toEqual(lot.center);
    for(const [slot,lot] of town.homes){
      expect(layouts[index].homes[slot][0]).toBeCloseTo(lot.center[0],9);
      expect(layouts[index].homes[slot][1]).toBeCloseTo(lot.center[1],9);
      expect(entrance(lot).every(Number.isFinite)).toBe(true);
    }
  });
});
