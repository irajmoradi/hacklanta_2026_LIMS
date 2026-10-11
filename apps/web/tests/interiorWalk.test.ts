import { expect, test } from 'bun:test';
import { interiorPath, stairAt, walkable, stairPoint, stairOpening, inStairwell, positionHeight, stairLabel, blocksStairwell } from '../src/scene/interiorWalk';
import { starters } from '../src/scene/interior';

test('A* routes around furniture and never cuts through obstacles',()=>{
  const path=interiorPath({x:-3,z:2},{x:-3,z:-3.5},starters,0);
  expect(path.length).toBeGreaterThan(0);
  for(const p of path) expect(walkable(p,starters,0)).toBe(true);
  expect(path.at(-1)).toEqual({x:-3,z:-3.5});
  expect(interiorPath({x:0,z:3},{x:2,z:-2},starters,0)).toEqual([]);
  expect(interiorPath({x:0,z:3},{x:5,z:0},[],0)).toEqual([]);
});
test('obstacles respect rotation, stashing, floors and vertical layers',()=>{
  const item={...starters[0],x:0,z:0,rot:90};
  expect(walkable({x:0,z:1},[item],0)).toBe(false);
  expect(walkable({x:0,z:0},[{...item,stashed:true}],0)).toBe(true);
  expect(walkable({x:0,z:0},[item],1)).toBe(true);
  expect(walkable({x:0,z:0},[{...item,kind:'rug_round'}],0)).toBe(true);
  expect(walkable({x:0,z:0},[{...item,kind:'custom-object'}],0)).toBe(false);
});
test('stairs connect adjacent floors both ways without top-floor wrapping',()=>{
  expect(stairAt({x:3,z:3},0,3)?.direction).toBe(1);
  expect(stairAt({x:-3,z:3},1,3)?.direction).toBe(-1);
  expect(stairAt({x:3,z:3},1,3)?.direction).toBe(1);
  expect(stairAt({x:3,z:3},2,3)).toBeUndefined();
  expect(stairAt({x:-3,z:3},0,3)).toBeUndefined();
  expect(stairAt({x:0,z:3.25},1,3)).toBeUndefined();
});


test('continuous flight, slab opening and labels agree in both directions',()=>{
  expect(stairPoint(0,0)).toEqual({x:3,z:3,y:0});
  expect(stairPoint(0,1)).toEqual({x:-3,z:3,y:3.4});
  expect(stairLabel(1)).toBe('Upstairs \u2191');
  expect(stairLabel(-1)).toBe('Downstairs \u2193');
  for(let t=.05;t<1;t+=.05) {
    const p=stairPoint(1,t);
    expect(p.y).toBeCloseTo(3.4*(1+t));
    expect(inStairwell(p)).toBe(true);
    expect(positionHeight({...p,y:undefined,floor:1},3)).toBeCloseTo(p.y);
    expect(p.z).toBeGreaterThan(stairOpening.minZ);
    expect(p.z).toBeLessThan(stairOpening.maxZ);
  }
  expect(positionHeight({x:-3,z:3,floor:2},3)).toBe(6.8);
  expect(blocksStairwell({...starters[0],x:0,z:3})).toBe(true);
  const path=interiorPath({x:-3,z:3},{x:3,z:3},[],1,true);
  expect(path.length).toBeGreaterThan(0);
  expect(path.every(p=>!inStairwell(p))).toBe(true);
});
