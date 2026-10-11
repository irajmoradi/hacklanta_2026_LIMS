import { expect, test } from 'bun:test';
import type { Entry } from './registryData';
import catalog from './catalog.fallback.json';
import { createTown, entrance } from './layout/town';
import { sidewalkGraph } from './layout/navigation';
import { acceptsKey, movement, walkable, moveGround, groundRoute, dropTargets, resolveDrop, rideTimeline, RIDE_SECONDS } from './playerControl';
const town=createTown(1337,catalog.entries as Entry[],[0,1,2,3,4]);
const graph=sidewalkGraph(town);
const home=town.homes.get(0)!;

test('movement normalizes diagonals, cancels opposites, supports arrows',()=>{
  expect(movement(new Set(['KeyW','ArrowDown']))).toEqual([0,0]);
  expect(Math.hypot(...movement(new Set(['KeyW','KeyD'])))).toBeCloseTo(1);
  expect(movement(new Set(['ArrowLeft']))).toEqual([-1,0]);
});
test('typing, modals, IME and command shortcuts do not steal keys; F is untouched',()=>{
  const event={code:'KeyW',altKey:false,ctrlKey:false,metaKey:false,isComposing:false};
  expect(acceptsKey(event,false,false)).toBe(true);
  for(const [blocked,editing] of [[true,false],[false,true]])expect(acceptsKey(event,blocked,editing)).toBe(false);
  for(const flag of ['altKey','ctrlKey','metaKey','isComposing'])expect(acceptsKey({...event,[flag]:true},false,false)).toBe(false);
  expect(acceptsKey({...event,code:'KeyF'},false,false)).toBe(false);
});
test('houses block walking and running without tunnelling, walls slide, town edge clamps',()=>{
  expect(walkable(town,home.center)).toBe(false);
  const start=entrance(home), result=moveGround(town,start,[0,-30]);
  expect(result[1]).toBeGreaterThan(home.center[1]);
  expect(Math.abs((result[0]-home.center[0])*Math.sin(home.yaw)+(result[1]-home.center[1])*Math.cos(home.yaw))).toBeGreaterThanOrEqual(5.35);
  expect(walkable(town,result)).toBe(true);
  const slide=moveGround(town,start,[2,-3]);expect(slide[0]).toBeCloseTo(start[0]+2);expect(walkable(town,slide)).toBe(true);
  const edge=moveGround(town,entrance(home),[1000,0]);expect(walkable(town,edge)).toBe(true);expect(walkable(town,[edge[0]+.2,edge[1]])).toBe(false);
});
test('all sidewalk nodes and ground-drop route segments avoid houses',()=>{
  for(const n of graph.values())expect(walkable(town,n.point)).toBe(true);
  const start=entrance(home), end:[number,number]=[home.center[0],home.center[1]-6];
  const path=groundRoute(town,graph,start,end);expect(path.length).toBeGreaterThan(2);
  let previous=start;
  for(const point of path){for(let i=0;i<=100;i++)expect(walkable(town,[previous[0]+(point[0]-previous[0])*i/100,previous[1]+(point[1]-previous[1])*i/100])).toBe(true);previous=point;}
  expect(groundRoute(town,graph,start,home.center)).toEqual([]);
});
test('only own house, open attractions and garden plots resolve; nothing cancels',()=>{
  const closed=dropTargets(town,0,{unlocked:[]});expect(closed.some(t=>t.id==='ferris_wheel')).toBe(false);
  const targets=dropTargets(town,0,{unlocked:['ferris_wheel'],level:99});
  expect(resolveDrop(targets,home.center)?.id).toBe('home');
  expect(resolveDrop(targets,town.homes.get(1)!.center)).toBeNull();
  expect(resolveDrop(targets,null)).toBeNull();expect(resolveDrop(targets,[999,999])).toBeNull();
  const wheel=targets.find(t=>t.id==='ferris_wheel')!;expect(resolveDrop(targets,wheel.center)?.activity).toBe('ride');
  expect(dropTargets(town,0,{unlocked:['ferris_wheel'],disaster:{closed_building:'ferris_wheel'} as any}).some(t=>t.id==='ferris_wheel')).toBe(false);
  expect(targets.some(t=>t.id==='colosseum')).toBe(true);
});
test('ride lasts precisely two loops and clamps after disembarking',()=>{
  expect(rideTimeline(0)).toEqual({angle:0,done:false});
  expect(rideTimeline(RIDE_SECONDS/2).angle).toBeCloseTo(Math.PI*2);
  expect(rideTimeline(RIDE_SECONDS-.001).done).toBe(false);
  expect(rideTimeline(RIDE_SECONDS)).toEqual({angle:Math.PI*4,done:true});
  expect(rideTimeline(RIDE_SECONDS+100).angle).toBeCloseTo(Math.PI*4);
});

test('grid street segments remain walkable across seeds and expanding neighborhoods',()=>{
  for(const seed of [1,42,1337]) {
    const expanded=createTown(seed,catalog.entries as Entry[],Array.from({length:18},(_,i)=>i));
    for(const street of expanded.streets) for(let i=1;i<street.points.length;i++) {
      const a=street.points[i-1],b=street.points[i];
      for(let t=0;t<=1;t+=.25)expect(walkable(expanded,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])).toBe(true);
    }
  }
});
test('study, farm, fitness and colosseum drops are reachable from grid roads',()=>{
  const targets=dropTargets(town,0,{level:99});
  for(const id of ['study_nook','farm_store','fitness_corner','colosseum']) {
    const target=targets.find(t=>t.id===id)!;expect(target).toBeDefined();
    expect(resolveDrop(targets,target.center)?.id).toBe(id);
    expect(groundRoute(town,graph,entrance(home),target.point).at(-1)).toEqual(target.point);
  }
  expect(targets.find(t=>t.id==='fitness_corner')!.activity).toBe('workout');
});

 test('shop entrances are drop targets only while open and unlocked',()=>{
  const world={level:99,unlocked:['pet_shelter','farm_store']};
  const targets=dropTargets(town,0,world);
  for(const id of ['shop','farm_store']) {
    const target=targets.find(t=>t.id===id)!;
    expect(target).toBeDefined();
    expect(resolveDrop(targets,target.center)?.id).toBe(id);
    expect(dropTargets(town,0,{...world,disaster:{closed_building:id} as any}).some(t=>t.id===id)).toBe(false);
  }
  expect(dropTargets(town,0,{level:1,unlocked:[]}).some(t=>t.id==='farm_store')).toBe(false);
});
