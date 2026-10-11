import {expect, test} from 'bun:test';
import {crowdBudget} from './crowdBudget';
test('100-person detail budget keeps nearby NPCs and distant interaction targets',()=>{
  const people=Array.from({length:100},(_,id)=>({id,distance:id<60 ? id : Infinity,priority:id===99 || id===98}));
  const chosen=crowdBudget(people);
  expect(chosen.size).toBe(22);
  expect([...chosen].map(p=>p.id)).toEqual([...Array.from({length:20},(_,i)=>i),98,99]);
  expect(people[0].id).toBe(0);
  expect(crowdBudget(people.slice(60,98)).size).toBe(0);
});
