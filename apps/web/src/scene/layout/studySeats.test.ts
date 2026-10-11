import { expect, test } from 'bun:test';
import catalog from '../catalog.fallback.json';
import type { Entry } from '../registryData';
import { createTown, destination, entrance } from './town';
import { route, sidewalkGraph } from './navigation';
import { activityPhase, assignStudySeats, STUDY_SEATS } from './studySeats';

const entries = catalog.entries as Entry[];
test('study nook fills an existing empty park lot without moving garden or fountain', () => {
  const before = createTown(1337, entries.filter(e => !['study_nook', 'fitness_corner'].includes(e.id)), [0,1,2]);
  const after = createTown(1337, entries, [0,1,2]);
  const nook = after.lots.find(l => l.entry?.id === 'study_nook')!;
  expect(nook.district).toBe('park');
  expect(before.lots.find(l => l.id === nook.id)?.entry).toBeUndefined();
  expect(after.lots.length).toBe(before.lots.length);
  for (const id of ['garden','fountain']) expect(after.lots.find(l => l.entry?.id === id)).toEqual(before.lots.find(l => l.entry?.id === id));
});

test('sparse, duplicate and reordered members receive distinct seats; capacity never wraps', () => {
  const slots = [19,2,84,0,8,2];
  expect(assignStudySeats(slots)).toEqual(assignStudySeats([...slots].reverse()));
  expect([...assignStudySeats(slots).values()]).toEqual([0,1,2,3,4]);
  expect(assignStudySeats(Array.from({length:20},(_,i)=>i)).size).toBe(12);
  expect(assignStudySeats([19,2]).get(19)).toBe(1);
});

test('all seats route into the nook and face tables; full nook and home phase return home', () => {
  const town = createTown(1337, entries, [0]);
  const graph = sidewalkGraph(town), home = entrance(town.homes.get(0)!);
  const world = {level:1, unlocked:[]};
  for (let i=0;i<STUDY_SEATS.length;i++) {
    const d = destination(town,0,[],world,false,0,'studying',false,i);
    expect(d.activity).toBe('study');
    expect(d.yaw).toBe(STUDY_SEATS[i].yaw);
    const path = route(graph,home,d.target);
    expect(path.at(-1)).toEqual(d.target);
    for(let j=1;j<path.length;j++) expect(graph.get(path[j-1].join(','))!.neighbors.has(path[j].join(','))).toBe(true);
  }
  expect(destination(town,0,[],world,false,0,'studying').target).toEqual(home);
  expect(destination(town,0,[],world,false,550,'studying',false,0).target).toEqual(home);
  expect(destination(town,0,[],{level:99,unlocked:entries.map(e=>e.id)},true,0,'studying',false,0).activity).toBe('gather');
  expect(activityPhase(550,0)).toBe(550);
});
