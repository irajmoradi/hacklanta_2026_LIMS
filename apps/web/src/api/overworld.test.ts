import { describe,it,expect } from 'bun:test';
import { Overworld, type AvatarState } from './overworld';
const avatar:AvatarState={user_id:'a',mode:'idle',x:0,z:0,heading:0,since:1,seq:1};
describe('authoritative snapshots and coalesced deltas',()=>{
  it('uses midpoint clock synchronization and ignores slower clock samples',()=>{
    const w=new Overworld();w.syncClock(105,100,100.2);
    expect(w.offset).toBeCloseTo(4.9);
    w.syncClock(110,100,105);expect(w.offset).toBeCloseTo(4.9);
    w.apply({type:'world_snapshot',world_seq:1,server_time:120,avatars:[]},119);
    expect(w.offset).toBeCloseTo(4.9);
  });
  it('accepts covered coalescing, requests recovery on a gap, replaces stale members',()=>{
    const w=new Overworld();
    expect(w.apply({type:'world_snapshot',world_seq:1,server_time:50,avatars:[avatar]},45)).toBe(true);
    expect(w.offset).toBe(5);
    expect(w.apply({type:'world_delta',from_seq:1,world_seq:12,server_time:51,avatars:[{...avatar,seq:12,x:10}]})).toBe(true);
    expect(w.apply({type:'world_delta',from_seq:13,world_seq:14,server_time:52,avatars:[]})).toBe(false);
    expect(w.seq).toBe(14);
    expect(w.apply({type:'world_snapshot',world_seq:14,server_time:52,avatars:[]})).toBe(true);
    expect(w.avatars.size).toBe(0);
  });
});
