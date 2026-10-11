import { expect, test } from 'bun:test';
import { previewDecor, validDecor, unchangedDecor, type DecorMove } from './decorDraft';
import { starters } from '../scene/interior';
test('drafts do not mutate the saved room and validate against concurrent edits', () => {
  const sofa = starters[0];
  const moves: DecorMove[] = [{item:sofa, action:'stash_item'}, {item:{...sofa,x:0,z:2},action:'place_item'}];
  expect(validDecor(starters,moves)).toBe(true);
  expect(previewDecor(starters,moves).find(i=>i.item_id===sofa.item_id)?.x).toBe(0);
  expect(starters[0].x).toBe(-2);
  const occupied = [...starters,{...sofa,item_id:'neighbor-sofa',x:0,z:2}];
  expect(validDecor(occupied,moves)).toBe(false);
  expect(previewDecor(occupied,[])).toEqual(occupied);
});
test('stash followed by undo restores the original arrangement', () => {
  const moves: DecorMove[] = [{item:starters[0], action:'stash_item'}, {item:starters[0],action:'place_item'}];
  expect(validDecor(starters,moves)).toBe(true);
  expect(previewDecor(starters,moves).find(i=>i.item_id===starters[0].item_id)).toEqual(starters[0]);
});

test('hall drafts retain duplicate identity, creator metadata and independent floors', () => {
  const original = {...starters[0], creator:'owner', creator_name:'Fixture owner', model_url:'/fixture.glb', floor:0};
  const duplicate = {...original, item_id:'duplicate', floor:1};
  const moves: DecorMove[] = [{item:duplicate, action:'place_item'}];
  expect(validDecor([original], moves)).toBe(true);
  const concurrent = {...original, item_id:'neighbor', x:2, z:2};
  expect(previewDecor([original, concurrent], moves)).toEqual([original, concurrent, duplicate]);
  expect(previewDecor([original, concurrent], [])).toEqual([original, concurrent]);
  expect(validDecor([original, {...duplicate, item_id:'occupied'}], moves)).toBe(false);
});

test('a draft never overwrites a newer shared edit of its touched furniture', () => {
  const sofa = starters[0], origins = new Map([[sofa.item_id, sofa]]);
  expect(unchangedDecor(starters, origins)).toBe(true);
  expect(unchangedDecor(starters.map(i => i === sofa ? {...i, x:i.x+.25} : i), origins)).toBe(false);
  expect(unchangedDecor(starters.map(i => i === sofa ? {...i, seq:i.seq+1} : i), origins)).toBe(false);
  expect(unchangedDecor([...starters, {...sofa,item_id:'unrelated'}], origins)).toBe(true);
});
