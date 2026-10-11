import { expect, test } from 'bun:test';
import catalog from '../catalog.fallback.json';
import type { Entry } from '../registry';
import { createTown, destination, entrance, PITCH } from './town';
import { sidewalkGraph, route } from './navigation';
import {parcel, townDecor, decorBounds, reservedBounds, streetBounds, overlaps, insideIsland} from './variety';
import {seededRandom} from '../worldTypes';
const entries = catalog.entries as Entry[];
test('rectangular town is deterministic, seeded, larger, and retains stable lot addresses', () => {
  const town=createTown(1337,entries,[0,1,2,3,4]);
  expect(town).toEqual(createTown(1337,entries,[0,1,2,3,4]));
  expect(town.homes).not.toEqual(createTown(42,entries,[0,1,2,3,4]).homes);
  expect(town.width).toBe(town.depth);
  expect(town.lots.length).toBe(36);
  expect(new Set(town.lots.map(l=>l.center.join(','))).size).toBe(36);
  expect(town.width*town.depth/(116*116)).toBeCloseTo(1.584,2);
  for (const lot of town.lots) {
    const [row,col]=lot.id.split(':').map(Number);
    expect(parcel(lot)).toEqual([(col-2.5)*PITCH,(row-2.5)*PITCH]);
    expect(Math.abs(lot.center[0]-parcel(lot)[0])).toBeLessThanOrEqual(.4);
    expect(Math.abs(lot.center[1]-parcel(lot)[1])).toBeLessThanOrEqual(.7);
    expect(Math.abs(lot.yaw)).toBeLessThanOrEqual(.035);
    expect(Math.hypot(entrance(lot)[0]-lot.center[0],entrance(lot)[1]-lot.center[1])).toBeCloseTo(lot.memberSlot===undefined?6:7.8,4);
  }
  expect(town.lots.filter(l=>l.memberSlot!==undefined).length).toBe(5);
  expect(town.lots.filter(l=>!l.entry&&l.memberSlot===undefined).length).toBeLessThan(15);
});
test('new registry building automatically occupies an unused lot in the requested district', () => {
  const before=createTown(1,entries,[0,1]);
  const entry:Entry={id:'new_pottery_school',kind:'building',placement:{district:'commercial'},asset:{glb:'/models/pottery.glb'}};
  const after=createTown(1,[...entries,entry],[0,1]);
  const lot=after.lots.find(l=>l.entry?.id===entry.id)!;
  expect(lot.district).toBe('commercial');
  expect(before.lots.find(l=>l.id===lot.id)?.entry).toBeUndefined();
  expect(after.lots.filter(l=>l.entry).length).toBe(before.lots.filter(l=>l.entry).length+1);
  expect(after.homes).toEqual(before.homes);
});
test('growth adds rows and never wraps member home slots', () => {
  const town=createTown(1,entries,Array.from({length:50},(_,i)=>i));
  expect(town.homes.size).toBe(50);
  expect(new Set([...town.homes.values()].map(l=>l.id)).size).toBe(50);
  expect([...town.homes.values()].every(l=>l.memberSlot!==undefined&&!l.entry)).toBe(true);
});

test('100 homes preserve all earlier addresses and remain reachable from the original square', () => {
  const towns=[5,25,100].map(size=>createTown(24109,entries,Array.from({length:size},(_,i)=>i)));
  const largest=towns[2], graph=sidewalkGraph(largest), start=entrance(largest.homes.get(0)!);
  expect(new Set([...largest.homes.values()].map(l=>l.id)).size).toBe(100);
  for(const smaller of towns.slice(0,2)) for(const [slot,lot] of smaller.homes) {
    expect(largest.homes.get(slot)?.id).toBe(lot.id);
    expect(largest.homes.get(slot)?.center).toEqual(lot.center);
  }
  for(const lot of largest.homes.values()) {
    expect(lot.entry).toBeUndefined();
    const path=route(graph,start,entrance(lot));
    expect(path.at(-1)).toEqual(entrance(lot));
    for(let i=1;i<path.length;i++) expect(graph.get(path[i-1].join(','))!.neighbors.has(path[i].join(','))).toBe(true);
  }
});
test('A* connects every lot through the axis-aligned streets and footpaths', () => {
  const town=createTown(7,entries,[0,1]), graph=sidewalkGraph(town),start=entrance(town.homes.get(0)!);
  for(const lot of town.lots){const end=entrance(lot),path=route(graph,start,end);expect(path[0]).toEqual(start);expect(path.at(-1)).toEqual(end);
    for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];expect(graph.get(a.join(','))!.neighbors.has(b.join(','))).toBe(true);}
  }
});
test('home and chosen activities preserve their schedule outside the cafe visit', () => {
  const town=createTown(3,entries,[0,1,17]);
  const world={time_of_day:15,level:99,unlocked:entries.map(e=>e.id)};
  for (const slot of [0,1,17]) {
    const home=entrance(town.homes.get(slot)!);
    let cafe=0;
    for(let second=0;second<600;second++) {
      const resting=destination(town,slot,[],world,false,second);
      const reading=destination(town,slot,[],world,false,second,'reading');
      if(resting.activity==='cafe') { cafe++; expect(reading.activity).toBe('cafe'); }
      else {
        expect(resting.target).toEqual(home);
        expect(reading.activity).toBe(((second+slot*137)%600)<510 ? 'sit' : 'wander');
      }
    }
    expect(cafe).toBe(60);
  }
});

test('all activities use reachable sidewalk destinations and preserve event priority', () => {
  const town=createTown(3,entries,[0]);
  const graph=sidewalkGraph(town), home=entrance(town.homes.get(0)!);
  const world={time_of_day:15,level:99,unlocked:entries.map(e=>e.id)};
  for(const [idle,pose] of [['gardening','kneel'],['dancing','dance'],['reading','sit'],['food','eat'],['walk_pet','walk_pet']] as const) {
    const target=destination(town,0,[],world,false,0,idle,true);
    expect(target.activity).toBe(pose);
    const path=route(graph,home,target.target);
    expect(path.at(-1)).toEqual(target.target);
    for(let i=1;i<path.length;i++) {
      expect(graph.get(path[i-1].join(','))!.neighbors.has(path[i].join(','))).toBe(true);

    }
    expect(destination(town,0,[],world,false,550,idle,true).target).toEqual(home);
    expect(destination(town,0,[],world,true,0,idle,true).activity).toBe('gather');
    expect(destination(town,0,[],{...world,weather:'festival_night'},true,0,idle,true).activity).toBe('dance');
  }
  expect(destination(town,0,[],world,false,0,'walk_pet',false).target).toEqual(home);
  const loop=[0,120,240,360].map(t=>destination(town,0,[],world,false,t,'walk_pet',true).target);
  expect(new Set(loop.map(p=>p.join(','))).size).toBe(4);
  for(let i=0;i<4;i++) expect(route(graph,loop[i],loop[(i+1)%4]).at(-1)).toEqual(loop[(i+1)%4]);
});

test('active Mayor events gather at the plaza; festival weather takes priority and ending events sends villagers home', () => {
  const town=createTown(3,entries,[0]);
  const world={time_of_day:9,level:99,unlocked:entries.map(e=>e.id)};
  const plaza=town.lots.find(l=>l.entry?.placement?.action==='mayor')!;
  const stage=town.lots.find(l=>l.district==='festival' && l.entry?.placement?.shape==='stage')!;
  expect(destination(town,0,[],world,true,0)).toEqual({target:entrance(plaza),activity:'gather'});
  expect(destination(town,0,[],{...world,weather:'festival_night'},true,0)).toEqual({target:entrance(stage),activity:'dance'});
  expect(destination(town,0,[],world,false,0).target).toEqual(entrance(town.homes.get(0)!));
  const empty=createTown(3,[],[0]);
  expect(destination(empty,0,[],{...world,weather:'festival_night'},true,550).target).toEqual(entrance(empty.homes.get(0)!));
});

test('catalog capacity expands for new district content without dropping buildings', () => {
  const additions: Entry[] = Array.from({length:30},(_,i)=>({id:`new_${i}`,kind:'building',placement:{district:'commercial'}}));
  const town=createTown(5,[...entries,...additions],[0,1]);
  expect(town.unplaced).toEqual([]);
  expect(town.lots.length).toBeLessThanOrEqual(72);
  expect(town.lots.filter(l=>l.entry?.id.startsWith('new_')).length).toBe(30);
  expect(town.roadsZ.at(-1)).toBeGreaterThan(Math.max(...town.lots.map(l=>l.center[1])));
});


test('starter town groups four lots per block and grows without moving existing homes', () => {
  const starter=createTown(19,entries,[0,1,2,3,4]);
  expect(starter.roadsX).toEqual([-3*PITCH,-PITCH,PITCH,3*PITCH]);
  expect(starter.roadsZ).toEqual([-3*PITCH,-PITCH,PITCH,3*PITCH]);
  expect((starter.roadsX.length-1)*(starter.roadsZ.length-1)).toBe(9);
  const grown=createTown(19,entries,Array.from({length:20},(_,i)=>i));
  for(let slot=0;slot<5;slot++)expect(grown.homes.get(slot)?.center).toEqual(starter.homes.get(slot)?.center);
  expect(grown.depth).toBeGreaterThan(starter.depth);
  expect(grown.lots.length % 12).toBe(0);
});

test('sparse house slots reserve addresses and lake/shelter content stays in the park', () => {
  const town=createTown(19,[...entries,{id:'lake',kind:'building',placement:{district:'lake' as any}}],[0,17]);
  expect(town.homes.get(17)?.memberSlot).toBe(17);
  expect([...town.homes.values()].every(l=>!l.entry)).toBe(true);
  expect(town.lots.find(l=>l.entry?.id==='lake')?.district).toBe('park');
});

// Exact segment vs oriented house envelope, not axis-aligned assumptions or sparse samples.
function hitsHouse(a:number[], b:number[], center:number[], yaw:number, half=5.5) {
  const local=(p:number[])=>{const x=p[0]-center[0],z=p[1]-center[1];return [x*Math.cos(yaw)-z*Math.sin(yaw),x*Math.sin(yaw)+z*Math.cos(yaw)];};
  const start=local(a),end=local(b);let lo=0,hi=1;
  for(let axis=0;axis<2;axis++) {
    const delta=end[axis]-start[axis];
    if(Math.abs(delta)<1e-10){if(Math.abs(start[axis])>=half)return false;continue;}
    const t1=(-half-start[axis])/delta,t2=(half-start[axis])/delta;
    lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));
    if(lo>=hi)return false;
  }
  return hi>0&&lo<1;
}
test('many seeds: street surfaces and routes clear homes, paddocks and reserved addresses',()=>{
  for(const seed of [0,1,7,19,42,1337,999999]) {
    const town=createTown(seed,entries,[0,1,2,3,4,5,17]);
    for(const street of town.streets) for(let i=1;i<street.points.length;i++) {
      for(const home of town.homes.values()) {
        // Sparse reserved lots must remain usable when occupied.
        const yaw=home.memberSlot===undefined?0:home.yaw;
        expect(hitsHouse(street.points[i-1],street.points[i],home.center,yaw,5.35+street.width/2)).toBe(false);
      }
    }
    for(let i=0;i<town.lots.length;i++) for(let j=i+1;j<town.lots.length;j++) {
      const [a,b]=[town.lots[i].center,town.lots[j].center];
      // Conservative 14m house envelopes include top-tier houses and paddocks.
      // Their old 16m pitch left a 2m guaranteed gap.
      expect(Math.hypot(a[0]-b[0],a[1]-b[1])-14).toBeGreaterThanOrEqual(1.5*(16-14));
    }
  }
});
test('all graph edges are rendered and grid roads form a single connected network',()=>{
  const town=createTown(1337,entries,[0,1,2,3,4]),graph=sidewalkGraph(town);
  const visited=new Set<string>(),queue=[graph.keys().next().value!];
  for(let i=0;i<queue.length;i++) {const id=queue[i];if(visited.has(id))continue;visited.add(id);queue.push(...graph.get(id)!.neighbors);}
  expect(visited.size).toBe(graph.size);
  expect(town.streets.filter(s=>s.id.startsWith('greenway:'))).toHaveLength(0);
  expect(town.streets.filter(s=>s.id.startsWith('cul-de-sac:'))).toHaveLength(0);
  expect(town.streets.some(s=>s.points.some((p,i)=>i>0&&p[0]!==s.points[i-1][0]&&p[1]!==s.points[i-1][1]))).toBe(false);
  for(const street of town.streets) for(let i=1;i<street.points.length;i++)
    expect(graph.get(street.points[i-1].join(','))?.neighbors.has(street.points[i].join(','))).toBe(true);
});
test('seeded geometry, sparse assignments and approaches survive membership growth and order changes',()=>{
  const small=createTown(1337,entries,[0,3,17]);
  const large=createTown(1337,entries,Array.from({length:50},(_,i)=>i));
  expect(small).toEqual(createTown(1337,entries,[17,0,3]));
  for(const slot of [0,3,17]) {
    expect(large.homes.get(slot)).toEqual(small.homes.get(slot));
    expect(entrance(large.homes.get(slot)!)).toEqual(entrance(small.homes.get(slot)!));
  }
  // Roads in the original town are unchanged when more rows are appended.
  for(const street of small.streets.filter(s=>s.id.startsWith('east-west:')))
    expect(large.streets.find(s=>s.id===street.id)).toEqual(street);
  expect(large.lots.every(l=>Math.abs(l.center[0])+8<large.width/2)).toBe(true);
  const centerZ=(large.roadsZ[0]+large.roadsZ.at(-1)!)/2;
  expect(large.lots.every(l=>Math.abs(l.center[1]-centerZ)+8<large.depth/2)).toBe(true);
});

 test('grid geometry and all entrances remain connected across seeds and growth',()=>{
  for(const seed of [0,42,1337]) for(const slots of [[],[0,3,17],Array.from({length:50},(_,i)=>i)]) {
    const town=createTown(seed,entries,slots),graph=sidewalkGraph(town);
    const visited=new Set<string>(),queue=[graph.keys().next().value!];
    for(let i=0;i<queue.length;i++) {
      const id=queue[i];if(visited.has(id))continue;
      visited.add(id);queue.push(...graph.get(id)!.neighbors);
    }
    expect(visited.size).toBe(graph.size);
    for(const lot of town.lots) expect(visited.has(entrance(lot).join(','))).toBe(true);
    for(const street of town.streets) for(let i=1;i<street.points.length;i++) {
      const a=street.points[i-1],b=street.points[i];
      expect(a[0]===b[0] || a[1]===b[1]).toBe(true);
      expect(a).not.toEqual(b);
    }
  }
 });

test('100 seeds: full decor footprints clear roads, parcels, patios and paddocks deterministically',()=>{
  const signatures=new Set<string>();
  const roles=new Set<string>();
  for(let seed=0;seed<100;seed++) {
    const town=createTown(seed,entries,[0,1,3,5,17]),decor=townDecor(town);
    expect(townDecor(createTown(seed,entries,[0,1,2,3,4])).filter(d=>d.role.startsWith('tree_')).length).toBeGreaterThanOrEqual(101);
    expect(decor).toEqual(townDecor(createTown(seed,entries,[17,5,3,1,0])));
    expect(decor.length).toBeGreaterThan(100);
    const reserved=[...reservedBounds(town),...streetBounds(town)];
    for(const d of decor) {
      roles.add(d.role);
      const bounds=decorBounds(d);
      expect(insideIsland(town,bounds)).toBe(true);
      expect(reserved.some(r=>overlaps(bounds,r))).toBe(false);
      expect(Math.abs(bounds.x)+bounds.hx).toBeLessThanOrEqual(town.width/2-2);
      const centerZ=(town.roadsZ[0]+town.roadsZ.at(-1)!)/2;
      expect(Math.abs(bounds.z-centerZ)+bounds.hz).toBeLessThanOrEqual(town.depth/2-2);
    }
    const trees=decor.filter(d=>d.role.startsWith('tree_'));
    // Pre-WEB-043 had at most 77 trees in the four reference starter seeds.
    expect(trees.length).toBeGreaterThanOrEqual(101);
    for(let i=0;i<trees.length;i++)for(let j=i+1;j<trees.length;j++)
      expect(overlaps(decorBounds(trees[i]),decorBounds(trees[j]))).toBe(false);
    signatures.add(JSON.stringify(decor));
  }
  expect(signatures.size).toBe(100);
  expect([...roles].sort()).toEqual(['detail','hedge','streetlight','tree_a','tree_b','tree_c']);
});

test('woodland covers all four banks, open lawns and home yards across starter seeds and growth',()=>{
  for(const seed of [0,19,42,1337,24109,999999]) for(const size of [5,25,100]) {
    const town=createTown(seed,entries,Array.from({length:size},(_,i)=>i));
    const trees=townDecor(town).filter(d=>d.role.startsWith('tree_'));
    expect(trees.length).toBeGreaterThanOrEqual(101);
    for(const onBank of [
      (d:typeof trees[number])=>d.p[0]<town.roadsX[0],
      (d:typeof trees[number])=>d.p[0]>town.roadsX.at(-1)!,
      (d:typeof trees[number])=>d.p[2]<town.roadsZ[0],
      (d:typeof trees[number])=>d.p[2]>town.roadsZ.at(-1)!,
    ]) expect(trees.filter(onBank).length).toBeGreaterThanOrEqual(12);
    for(const home of town.homes.values()) {
      const [x,z]=parcel(home);
      expect(trees.filter(d=>Math.abs(d.p[0]-x)<7 && Math.abs(d.p[2]-z)<9.5).length,`seed ${seed}, ${size} homes, yard ${home.id}`).toBeGreaterThanOrEqual(2);
    }
    expect(trees.some(d=>town.lots.some(l=>!l.entry && l.district!=='residential' &&
      Math.abs(d.p[0]-l.center[0])<7 && Math.abs(d.p[2]-l.center[1])<7))).toBe(true);
    for(const d of trees.filter(d=>d.p[0]>town.roadsX.at(-1)! && d.p[2]>town.roadsZ[0]+5 && d.p[2]<town.roadsZ.at(-1)!-5)) {
      const b=decorBounds(d);
      expect(b.x+b.hx).toBeLessThan(town.roadsX.at(-1)!+7.5-1.1-1.6);
    }
  }
});

test('legacy home address ownership survives variety, growth, sparse slots and catalog additions',()=>{
  for(const seed of [0,19,42,1337,24109,999999]) {
    const original=createTown(seed,entries,[0,3,17]);
    const grown=createTown(seed,[...entries,{id:'extra_shop',kind:'building',placement:{district:'commercial'}}],Array.from({length:50},(_,i)=>i));
    const offset=Math.floor(seededRandom(seed)()*6);
    for(let slot=0;slot<50;slot++) {
      const row=slot<6?0:6+Math.floor((slot-6)/6),col=(slot%6+offset)%6;
      expect(grown.homes.get(slot)?.id).toBe(`${row}:${col}`);
      expect(grown.homes.get(slot)?.memberSlot).toBe(slot);
    }
    for(const slot of [0,3,17])expect(grown.homes.get(slot)).toEqual(original.homes.get(slot));
    if(seed===1337 || seed===24109)for(const home of grown.homes.values()) {
      expect(home.center).toEqual(parcel(home));expect(home.yaw).toBe(0);
    }
  }
});

test('seed changes civic placement but retains districts, avenues, rectangular alleys and access',()=>{
  const arrangements=new Set<string>();
  for(const seed of [0,19,42,1337,24109]) {
    const town=createTown(seed,entries,[0,1,2,3,4]);
    arrangements.add(JSON.stringify(town.lots.filter(l=>l.entry).map(l=>[l.id,l.entry!.id])));
    expect(town.streets.filter(s=>s.kind==='road').some(s=>s.width===5.2)).toBe(true);
    expect(town.streets.filter(s=>s.kind==='road').some(s=>s.width<3.8)).toBe(true);
    const alley=town.streets.find(s=>s.id==='edge-alley')!;
    const graph=sidewalkGraph(town);
    expect(graph.get(alley.points.at(-1)!.join(','))?.neighbors.size).toBe(1);
    for(const lot of town.lots.filter(l=>l.entry?.placement?.district==='commercial'))expect(lot.district).toBe('commercial');
  }
  expect(arrangements.size).toBe(5);
});

