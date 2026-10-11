import { expect, test } from 'bun:test';
import { arenaFixtures, arenaPosition, standings, potIntent } from './colosseumData';
import { makeFixtures } from '../api/fixtures';
import { createTown } from '../scene/layout/town';
import fallback from '../scene/catalog.fallback.json';
import type { Entry } from '../scene/registryData';

test('the colosseum never consumes a town lot',()=>{
  const entries=fallback.entries as Entry[];
  const before=createTown(5,entries,[0,1]);
  const after=createTown(5,[...entries,{id:'colosseum',kind:'building',tags:['separate_scene']}],[0,1]);
  expect(after).toEqual(before);
});
test('pot intent supports deployed and legacy participant fields without NaN',()=>{
  const c=arenaFixtures(makeFixtures().village)[0];
  c.participants=[{user_id:'a',entry_lamports:10000000},{user_id:'b',entry_lamports_intent:20000000} as unknown as CompetitionParticipant];
  expect(potIntent(c)).toBe(.03);
  c.participants=[{user_id:'c'} as CompetitionParticipant];
  expect(potIntent(c)).toBe(0);
});
type CompetitionParticipant = ReturnType<typeof arenaFixtures>[number]['participants'][number];

test('confirmed evidence ranks participants; pending/rejected and spectators cannot score',()=>{
  const c=arenaFixtures(makeFixtures().village)[0];
  c.entries.push({...c.entries[0],id:'outsider',user_id:'spectator',points:500});
  c.entries[1].points=500;
  expect(standings(c).map(r=>r.points)).toEqual([30,23,16,9]);
  expect(standings(c).map(r=>r.rank)).toEqual([1,2,3,4]);
  c.entries[3].points=30;
  expect(standings(c).map(r=>r.rank)).toEqual([1,1,3,4]);
});
test('team share uses confirmed points of the same team and handles zero totals',()=>{
  const c=arenaFixtures(makeFixtures().village)[1], rows=standings(c);
  expect(rows[0].percent).toBeCloseTo(30/46*100);
  expect(rows[1].percent).toBeCloseTo(23/32*100);
  c.entries.forEach(e=>e.points=0);
  expect(standings(c).every(r=>r.percent===0)).toBe(true);
});
test('podium slots are unique for ties; open participants stand outside the gate',()=>{
  expect(arenaPosition(0,1,false)).toEqual([0,1.21,0]);
  expect(arenaPosition(1,1,false)).toEqual([-2,.86,0]);
  expect(arenaPosition(2,3,false)).toEqual([2,.56,0]);
  expect(new Set(Array.from({length:30},(_,i)=>arenaPosition(i,i+1,true).join(','))).size).toBe(30);
  expect(arenaPosition(20,21,true)[2]).toBeGreaterThan(9.6);
});


test('scoreboard uses confirmed decimal values and target progress',()=>{
  const c=arenaFixtures(makeFixtures().village)[0]; c.scoring='scoreboard'; c.unit='hours'; c.target=10;
  c.entries.forEach(e=>{e.value=e.decision==='confirmed'?2.5:999;});
  expect(standings(c).map(r=>r.points)).toEqual([2.5,2.5,2.5,2.5]);
  expect(standings(c).every(r=>r.rank===1&&r.percent===25)).toBe(true);
});
test('ordinal ranks by confirmation then submission, not total',()=>{
  const c=arenaFixtures(makeFixtures().village)[0];c.scoring='ordinal';c.target=2;
  const accepted=c.entries.filter(e=>e.decision==='confirmed');
  accepted.forEach((e,i)=>{e.value=i===0?1:2;e.confirmed_at='2026-10-05T12:00:00Z';e.created_at=`2026-10-04T12:00:0${4-i}Z`;});
  const rows=standings(c);
  expect(rows[0].user_id).toBe(accepted[3].user_id);
  expect(rows.at(-1)?.completed_at).toBeUndefined();
  expect(rows.map(r=>r.rank)).toEqual([1,2,3,4]);
});
