import { expect, test } from 'bun:test';
import { Group, Mesh, MeshStandardMaterial, BoxGeometry } from 'three';
import { cafeLights } from '../CafePatio';
import catalog from '../catalog.fallback.json';
import { createTown, destination, entrance } from './town';
import { cafeSeat, cafeTime, cafeObstacle, CAFE_SEATS } from './cafeSeats';
import { clearOfStreets, type Street } from './streets';
import { dropTargets, groundRoute, resolveDrop, walkable } from '../playerControl';
import { sidewalkGraph } from './navigation';
import type { Entry } from '../registryData';

const entries = catalog.entries as Entry[];
const world = {level:99, unlocked:entries.map(e=>e.id)};
test('patio stays in cafe yard, clear of roads across seeds and rectangular grids', () => {
  for (const seed of [0,1,42,1337,997,9999]) {
    const town=createTown(seed,entries,[0,1,2,3,4,5,6]);
    const lot=town.lots.find(l=>l.entry?.id==='storefront_cafe')!;
    expect(town.lots.some(l=>l.entry?.id==='cafe_patio')).toBe(false);
    const roads=town.streets.filter(s=>s.kind==='road');
    const rectangular: Street[]=[-10.5,10.5].flatMap(v=>[
      {id:'x',kind:'road' as const,width:4,points:[[lot.center[0]+v,lot.center[1]-20],[lot.center[0]+v,lot.center[1]+20]]},
      {id:'z',kind:'road' as const,width:4,points:[[lot.center[0]-20,lot.center[1]+v],[lot.center[0]+20,lot.center[1]+v]]},
    ]);
    for(let x=-4.8;x<=4.8;x+=.3) for(let z=2.7;z<=6.5;z+=.3)
      expect(clearOfStreets([...roads,...rectangular],[lot.center[0]+x,lot.center[1]+z],.05)).toBe(true);
    for(let slot=0;slot<6;slot++) {
      const {target}=cafeSeat(lot.center,slot);
      expect(walkable(town,target)).toBe(true);
      const path=groundRoute(town,sidewalkGraph(town),entrance(lot),target);
      expect(path.at(-1)).toEqual(target);
      for(let i=1;i<path.length;i++) for(let t=0;t<=1;t+=.05) {
        const x=path[i-1][0]+(path[i][0]-path[i-1][0])*t-lot.center[0];
        const z=path[i-1][1]+(path[i][1]-path[i-1][1])*t-lot.center[1];
        expect(cafeObstacle([x,z])).toBe(false);
      }
      expect(groundRoute(town,sidewalkGraph(town),entrance(town.homes.get(0)!),target).at(-1)).toEqual(target);
    }
  }
});
test('cafe is a seated drop target, rejects closures and schedules exactly 10%', () => {
  const town=createTown(1337,entries,[0,1,2,3,4,5]);
  const lot=town.lots.find(l=>l.entry?.id==='storefront_cafe')!;
  const points=new Set<string>();
  for(let slot=0;slot<6;slot++) {
    const target=dropTargets(town,slot,world).find(t=>t.id==='storefront_cafe')!;
    expect(resolveDrop([target],target.point)).toEqual(target);
    expect(target.activity).toBe('cafe');
    expect(target.point).toEqual(cafeSeat(lot.center,slot).target);
    points.add(target.point.join(','));
    expect(Array.from({length:600},(_,s)=>cafeTime(s,slot)).filter(Boolean)).toHaveLength(60);
    expect(destination(town,slot,[],world,false,430,'home').activity).toBe('cafe');
    expect(destination(town,slot,[],world,false,500,'home').activity).toBe('wander');
  }
  expect(points.size).toBe(CAFE_SEATS.length);
  const closed={...world,disaster:{closed_building:'storefront_cafe'}} as typeof world;
  expect(dropTargets(town,0,closed).some(t=>t.id==='storefront_cafe')).toBe(false);
  expect(destination(town,0,[],closed,false,430,'home').activity).toBe('wander');
  const missing={...town,lots:town.lots.filter(l=>l!==lot)};
  expect(destination(missing,0,[],world,false,430,'home').activity).toBe('wander');
});
test('night changes only patio bulbs and restores daylight emission', () => {
  const model=new Group();
  const bulb=new MeshStandardMaterial({name:'patio_bulb',emissive:'#ffd08a'});
  const table=new MeshStandardMaterial({name:'cream'});
  model.add(new Mesh(new BoxGeometry(),bulb),new Mesh(new BoxGeometry(),table));
  cafeLights(model,true);expect(bulb.emissiveIntensity).toBe(3);expect(table.emissiveIntensity).toBe(1);
  cafeLights(model,false);expect(bulb.emissiveIntensity).toBe(.05);
});
