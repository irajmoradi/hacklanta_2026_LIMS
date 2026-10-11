import {expect,test} from 'bun:test';
import {normalizeCatalog,mergeRegistry,available,type Entry} from './registryData';
test('parallel catalog module exports normalize and override fallback placement and offsets',()=>{
  const fallback:Entry={id:'gym',kind:'building',placement:{district:'commercial',size:5},asset:{glb:'/models/gym.glb'}};
  const incoming=normalizeCatalog({catalog:{entries:[{id:'gym',kind:'building',asset:{attach:{offset:[1,2,3]}}}],buildings:[{id:'gym',placement:{district:'park'}}]}});
  const merged=mergeRegistry([fallback],incoming);
  expect(merged).toHaveLength(1);expect(merged[0].placement).toEqual({district:'park',size:5});
  expect(merged[0].asset?.glb).toBe('/models/gym.glb');expect(merged[0].asset?.attach?.offset).toEqual([1,2,3]);
});
test('catalog gates honor both explicit unlock and level plus dependencies',()=>{
  const entry:Entry={id:'wheel',kind:'building',unlock:{id:'wheel',village_level:3},requires:['stage']};
  expect(available(entry,{level:9,unlocked:[]})).toBe(false);
  expect(available(entry,{level:3,unlocked:['wheel','stage']})).toBe(true);
  expect(available(entry,{level:2,unlocked:['wheel','stage']})).toBe(false);
});
