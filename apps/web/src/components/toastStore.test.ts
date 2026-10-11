import {test,expect} from 'bun:test';
import {createToastStore} from './toastStore';
import {toastPlacement} from './Toast';

test('newest first; overflow waits in queue and dismiss promotes the next card', () => {
  const store=createToastStore();
  const ids=Array.from({length:5},(_,i)=>store.push({title:`Notice ${i}`}));
  expect(store.snapshot().slice(0,3).map(t=>t.id)).toEqual(ids.slice(2).reverse());
  store.dismiss(ids[4]);
  expect(store.snapshot().slice(0,3).map(t=>t.id)).toEqual(ids.slice(1,4).reverse());
  expect(store.snapshot()).toHaveLength(4);
});
test('errors persist, moments last 2.5s, normal notifications last 4s',()=>{
  const s=createToastStore();s.push('Saved');s.push({title:'Level up',variant:'moment'});s.push({kind:'error',title:'Offline',duration:10});
  expect(s.snapshot().map(t=>t.duration)).toEqual([0,2500,4000]);
});
test('stable IDs deduplicate reconnects; dismissal callback runs exactly once',()=>{
  const s=createToastStore();let done=0,updates=0;const stop=s.subscribe(()=>updates++);
  s.push({id:'connection',title:'Reconnecting',onDismiss:()=>done++});s.push({id:'connection',title:'Reconnecting'});
  expect(s.snapshot()).toHaveLength(1);expect(updates).toBe(1);
  s.dismiss('connection');s.dismiss('connection');expect(done).toBe(1);
  stop();s.clear();expect(s.snapshot()).toHaveLength(0);
});
test('placement centers left of a profile and avoids dashboard and dock',()=>{
  const obstacles=[{left:900,right:1280,top:76,bottom:720},{left:20,right:300,top:200,bottom:630},{left:300,right:900,top:640,bottom:710}];
  const p=toastPlacement(1280,720,88,obstacles,244)!;
  expect(p.top).toBe(88);expect(p.left).toBeGreaterThan(300);expect(p.left+p.width).toBeLessThan(900);
});
test('fully occupied viewport queues instead of covering a panel',()=>{
  expect(toastPlacement(390,844,76,[{left:0,right:390,top:0,bottom:844}],76)).toBeNull();
  expect(toastPlacement(390,844,76,[{left:0,right:390,top:174,bottom:844}],76)?.top).toBe(76);
});
test('cancelling a replaced celebration does not finish its successor',()=>{
  const s=createToastStore();let completed=0;
  const old=s.push({title:'Old moment',onDismiss:()=>completed++});
  s.push({title:'New moment',onDismiss:()=>completed++});s.dismiss(old,false);
  expect(completed).toBe(0);expect(s.snapshot()[0].title).toBe('New moment');
  s.clear();expect(completed).toBe(1);
});
