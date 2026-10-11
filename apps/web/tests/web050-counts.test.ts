import {townDecor,decorBounds,reservedBounds,streetBounds,overlaps,insideIsland} from '../src/scene/layout/variety';
import {createTown} from '../src/scene/layout/town';
import {test,expect} from 'bun:test';
import catalog from '../src/scene/catalog.fallback.json';
import {mkdirSync,writeFileSync} from 'node:fs';
import type {WorldState} from '../src/scene/worldTypes';
import type {Entry} from '../src/scene/registryData';
import {mergeRegistry,normalizeCatalog} from '../src/scene/registryData';
import {catalog as compiled} from '../../../packages/catalog/dist/catalog';

// Generate the historical modules with python tests/web050-baseline.py first.
// Dynamic paths keep ordinary typechecks independent of these disposable fixtures.
const history=(name:string)=>import(`./web050-history/${name}.ts`);
test('historical and restored starter tree counts',async()=>{
  const {createTown:legacyTown}=await history('legacy-town') as {createTown:typeof createTown};
  const {createTown:mainTown}=await history('main-town') as {createTown:typeof createTown};
  const {townDecor:mainDecor,audit}=await history('main-variety') as {
    townDecor:typeof townDecor; audit:Record<string,number>;
  };
  const {legacyDecor}=await history('legacy-decor') as {
    legacyDecor:(town:ReturnType<typeof createTown>,world:WorldState)=>[string,unknown[]][];
  };
  const entries=mergeRegistry(catalog.entries as Entry[],normalizeCatalog(compiled)),slots=[0,1,2,3,4];
  const legacyCount=(seed:number,world:WorldState)=>legacyDecor(legacyTown(seed,entries,slots),world)
    .filter(([role])=>['tree','evergreen'].includes(role)).reduce((n,[,trees])=>n+trees.length,0);
  const results=[1337,42,19,24109].map(seed=>({seed,
    legacyLocked:legacyCount(seed,{level:1,unlocked:[]}),
    legacyUnlocked:legacyCount(seed,{level:99,unlocked:entries.map(e=>e.id)}),
    main:mainDecor(mainTown(seed,entries,slots)).filter(d=>d.role.startsWith('tree_')).length,
    mainRejections:{...audit},
    restored:townDecor(createTown(seed,entries,slots)).filter(d=>d.role.startsWith('tree_')).length,
  }));
  mkdirSync('artifacts/web050',{recursive:true});
  writeFileSync('artifacts/web050/tree-counts.json',JSON.stringify(results,null,2));
  console.log(results);
  for(const row of results)expect(row.restored).toBeGreaterThanOrEqual(Math.ceil(row.legacyLocked*1.3));
  for(const {seed} of results) {
    const town=createTown(seed,entries,slots);
    expect(townDecor(town).filter(d=>!d.role.startsWith('tree_')))
      .toEqual(mainDecor(town).filter(d=>!d.role.startsWith('tree_')));
  }
});

test('merged production registry: 100 starter seeds retain dense, disjoint woodland',()=>{
  const entries=mergeRegistry(catalog.entries as Entry[],normalizeCatalog(compiled));
  for(let seed=0;seed<100;seed++) {
    const town=createTown(seed,entries,[0,1,2,3,4]);
    const trees=townDecor(town).filter(d=>d.role.startsWith('tree_')).map(decorBounds);
    expect(trees.length).toBeGreaterThanOrEqual(101);
    const reserved=[...reservedBounds(town),...streetBounds(town)];
    for(const tree of trees) {
      expect(insideIsland(town,tree)).toBe(true);
      expect(reserved.some(b=>overlaps(tree,b))).toBe(false);
    }
    for(let i=0;i<trees.length;i++)for(let j=i+1;j<trees.length;j++)expect(overlaps(trees[i],trees[j])).toBe(false);
  }
});
