import { afterEach, expect, test } from 'bun:test';
import { BarkPlayer, actionBark } from './barks';

const players: BarkPlayer[]=[];
afterEach(()=>players.splice(0).forEach(p=>p.stop()));
function setup() {
  let now=0, allowed=true, fetches=0;
  const clips: {volume:number; pauses:number; onended?:()=>void}[]=[];
  Object.assign(globalThis,{Audio:class {
    volume=0; pauses=0; onended?:()=>void;
    constructor(){clips.push(this);}
    play(){return Promise.resolve();} pause(){this.pauses++;}
  }});
  const player=new BarkPlayer(()=>allowed,()=>.6,async()=>{fetches++;return new Blob(['synthetic']);},()=>now);
  players.push(player);
  player.manifest={a:{walk:['a1','a2'],cafe:['a3']},b:{walk:['b']}};
  const locate=()=>{player.locate('a',25,true);player.locate('b',0,true);};locate();
  return {player,clips,fetches:()=>fetches,advance:(ms:number)=>{now+=ms;locate();},mute:()=>{allowed=false;player.sync();}};
}
test('global 4s and avatar 20s limits, with no overlapping clips',async()=>{
  const s=setup();await s.player.trigger('a','walk');expect(s.clips).toHaveLength(1);expect(s.clips[0].volume).toBeCloseTo(.45);
  s.advance(4000);await s.player.trigger('b','walk');expect(s.clips).toHaveLength(1);
  s.clips[0].onended?.();await s.player.trigger('b','walk');expect(s.clips).toHaveLength(2);
  s.clips[1].onended?.();s.advance(15999);await s.player.trigger('a','walk');expect(s.clips).toHaveLength(2);
  s.advance(1);await s.player.trigger('a','walk');expect(s.clips).toHaveLength(3);
});
test('four seconds applies even after a short clip ends',async()=>{
  const s=setup();await s.player.trigger('a','walk');s.clips[0].onended?.();s.advance(3999);
  await s.player.trigger('b','walk');expect(s.clips).toHaveLength(1);
  s.advance(1);await s.player.trigger('b','walk');expect(s.clips).toHaveLength(2);
});
test('switching scenes preserves cooldowns and unmount stops current audio',async()=>{
  const s=setup();await s.player.trigger('a','walk');s.player.forget('a');expect(s.clips[0].pauses).toBe(1);
  s.player.reset();s.player.manifest={a:{walk:['a']},b:{walk:['b']}};
  s.advance(3999);await s.player.trigger('b','walk');expect(s.clips).toHaveLength(1);
  s.advance(1);await s.player.trigger('a','walk');expect(s.clips).toHaveLength(1);
  await s.player.trigger('b','walk');expect(s.clips).toHaveLength(2);
});
test('mute stops playing and prevents network work; toggle and missing clips stay silent',async()=>{
  const s=setup();s.player.enabled=false;await s.player.trigger('a','walk');expect(s.fetches()).toBe(0);
  s.player.enabled=true;await s.player.trigger('missing','walk');await s.player.trigger('a','house');expect(s.fetches()).toBe(0);
  await s.player.trigger('a','walk');s.mute();expect(s.clips[0].pauses).toBe(1);
  s.advance(30000);await s.player.trigger('b','walk');expect(s.fetches()).toBe(1);
});
test('offscreen, far away and leaving the screen stay silent or stop immediately',async()=>{
  const s=setup();s.player.locate('a',0,false);await s.player.trigger('a','walk');
  s.player.locate('a',100,true);await s.player.trigger('a','walk');expect(s.fetches()).toBe(0);
  s.player.locate('a',10,true);await s.player.trigger('a','walk');s.player.locate('a',10,false);
  expect(s.clips[0].pauses).toBe(1);
});
test('mute during fetch cancels late playback',async()=>{
  const s=setup();let resolve!:(b:Blob)=>void;
  const player=new BarkPlayer(()=>true,()=>1,()=>new Promise(r=>{resolve=r;}));players.push(player);
  player.manifest={a:{walk:['a']}};player.locate('a',0,true);
  const pending=player.trigger('a','walk');player.enabled=false;player.sync();resolve(new Blob(['fake']));await pending;
  expect(s.clips).toHaveLength(0);
});
test('actions map to nine supported bark triggers without a runtime synthesis path',()=>{
  expect(actionBark(true,null,'cafe',false)).toBe('walk');
  expect(actionBark(false,'spin','',false)).toBe('spin');
  expect(actionBark(false,'wave','',false)).toBe('wave');
  expect(actionBark(false,'cheer','',false)).toBe('cheer');
  expect(actionBark(false,null,'cafe',false)).toBe('cafe');
  expect(actionBark(false,null,'dance',false)).toBe('attraction');
  expect(actionBark(false,null,'',true)).toBe('attraction');
  expect(actionBark(false,null,'',false)).toBeNull();
});
