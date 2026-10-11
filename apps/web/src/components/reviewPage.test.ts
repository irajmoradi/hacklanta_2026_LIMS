import {expect, test} from 'bun:test';
import {makeFixtures} from '../api/fixtures';
import {reviewPage} from './reviewPage';
const fixture=makeFixtures().village.villagers;
test('small review remains intact and every one of 100 people is reachable',()=>{
  expect(reviewPage(fixture,'',0).people).toEqual(fixture);
  const people=Array.from({length:100},(_,i)=>({...fixture[i%5],user_id:String(i),display_name:`Villager ${String(i+1).padStart(3,'0')}`}));
  const pages=Array.from({length:10},(_,i)=>reviewPage(people,'',i).people);
  expect(pages.every(p=>p.length===10)).toBe(true);
  expect(new Set(pages.flat().map(p=>p.user_id)).size).toBe(100);
  expect(reviewPage(people,'  VILLAGER 100 ',9).people.map(p=>p.user_id)).toEqual(['99']);
  expect(reviewPage(people,'missing',9)).toMatchObject({people:[],current:0,pages:1,count:0});
});
