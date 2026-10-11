import {test,expect} from 'bun:test';
import {Overworld,type AvatarState} from './overworld';
import {predictIntent} from '../scene/predictIntent';
const avatar:AvatarState={user_id:'a',mode:'idle',x:0,z:0,heading:0,since:0,seq:1,until:20};
function setup(){const w=new Overworld();w.ownId='a';w.apply({type:'world_snapshot',world_seq:1,server_time:0,avatars:[avatar]},0);return w;}
function delta(w:Overworld,state:AvatarState,now:number){return w.apply({type:'world_delta',from_seq:w.seq,world_seq:state.seq,server_time:now,avatars:[state]},now);}
test('input frame prediction ignores movement echoes including after release',()=>{
  const w=setup();w.predict({...avatar,mode:'walking',x:1});
  expect(w.sample('a',0)?.x).toBe(1);
  delta(w,{...avatar,mode:'walking',x:.2,seq:2},.1);
  expect(w.sample('a',.1)?.x).toBe(1);
  w.predict({...avatar,x:1});delta(w,{...avatar,mode:'walking',x:.3,seq:3},.2);
  expect(w.sample('a',.2)?.mode).toBe('idle');
});
test('1.5m threshold and 200ms easing preserve input during reconciliation',()=>{
  const w=setup();w.predict({...avatar,x:1.5});delta(w,{...avatar,seq:2},1);
  expect(w.sample('a',1)?.x).toBe(1.5);
  w.predict({...avatar,x:2});delta(w,{...avatar,seq:3},2);
  expect(w.sample('a',2)?.x).toBe(2);
  expect(w.sample('a',2.1)?.x).toBeCloseTo(1);
  w.predict({...w.sample('a',2.1)!,x:1.2});
  expect(w.sample('a',2.2)?.x).toBeCloseTo(.2);
});
test('seat/emote/ride predict immediately; rejection eases even below threshold',()=>{
  const w=setup();
  const targets=[{id:'storefront_cafe',label:'Cafe',center:[0,0] as [number,number],point:[0,0] as [number,number],activity:'cafe' as const},
    {id:'ferris_wheel',label:'Ride',center:[10,0] as [number,number],point:[10,0] as [number,number],activity:'ride' as const}];
  const seated=predictIntent(avatar,'sit',{seat_id:'storefront_cafe:1'},targets,w.avatars.values(),0)!;
  w.predict(seated,'seat');expect(w.sample('a',0)?.seat_id).toBe('storefront_cafe:1');
  w.result('seat',false,undefined,1);expect(w.sample('a',1)?.x).toBe(seated.x);
  expect(w.sample('a',1.1)?.x).toBeCloseTo(seated.x/2);
  expect(w.sample('a',1.2)?.x).toBeCloseTo(0);
  expect(w.sample('a',1.2)?.mode).toBe('idle');
  w.predict({...avatar,x:1},'small');w.result('small',false,undefined,2);
  expect(w.sample('a',2.1)?.x).toBeCloseTo(.5);
  expect(predictIntent(avatar,'emote',{kind:'cheer'},targets,[],0)?.emote).toBe('cheer');
  expect(predictIntent(avatar,'join_attraction',{attraction_id:'ferris_wheel'},targets,[{...avatar,user_id:'b',attraction_id:'ferris_wheel',slot:0}],0)?.slot).toBe(1);
});
test('pending action ignores old echoes and reconciles accepted allocation',()=>{
  const w=setup();w.predict({...avatar,mode:'seated',x:10,slot:0},'seat');
  delta(w,{...avatar,seq:2},1);expect(w.sample('a',1)?.mode).toBe('seated');
  w.result('seat',true,3,1);
  delta(w,{...avatar,mode:'seated',x:12,slot:1,seq:3},2);
  expect(w.sample('a',2)?.slot).toBe(1);expect(w.sample('a',2)?.x).toBe(10);
  expect(w.sample('a',2.2)?.x).toBeCloseTo(12);
});
test('remote buffer is 75ms with at most 100ms extrapolation and gap updates render',()=>{
  const w=setup();w.ownId='other';
  delta(w,{...avatar,mode:'walking',x:0,seq:2},1);
  delta(w,{...avatar,mode:'walking',x:1,seq:3},1.1);
  expect(w.sample('a',1.15)?.x).toBeCloseTo(.75);
  expect(w.sample('a',1.275)?.x).toBeCloseTo(2);
  expect(w.sample('a',5)?.x).toBeCloseTo(2);
  expect(w.apply({type:'world_delta',from_seq:99,world_seq:100,server_time:6,avatars:[{...avatar,x:8,seq:100}]},6)).toBe(false);
  expect(w.sample('a',6)?.x).toBe(8);
});
test('your villager glides between 1 Hz steps when the server routine walks it (R-183)',()=>{
  const w=setup();
  for(let i=1;i<=4;i++)delta(w,{...avatar,mode:'walking',x:i*2.8,seq:i+1,until:0},i);
  const mid=w.sample('a',4.5)!.x;
  expect(mid).toBeGreaterThan(2.8*3); expect(mid).toBeLessThan(2.8*4); // between the last two steps, not snapped to the latest
  expect(w.sample('a',4.25)!.x).toBeLessThan(mid); // and still moving forward
});
