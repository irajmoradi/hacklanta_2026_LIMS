import {expect,test} from 'bun:test';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {disasterParts,effectCenter,lightningIntensity,primitiveAtlas,repairProgress} from './disasterVisuals';
import {createTown} from './layout/town';
import {gamingLight} from './gamingLight';
import type {Disaster} from '../api/types';
const town=createTown(42,[{id:'pet_shelter',kind:'building',placement:{district:'park'}}],[0,1]);
const disaster=(kind:Disaster['kind']):Disaster=>({kind,title:kind,body:'',started_at:'',deadline:'',repair_event_id:kind,target_checkins:6,target_people:3,checkins:0,people:0,closed_building:kind==='scorch'?'pet_shelter':null,pets_away:false});
test('all effects have bounded, finite instances and smaller low tiers',()=>{
  for(const kind of ['scorch','outbreak','blackout','blight'] as const){const d=disaster(kind),full=disasterParts(d,town,false),low=disasterParts(d,town,true);expect(full.length).toBeGreaterThan(0);expect(full.length).toBeLessThan(500);expect(low.length).toBeLessThanOrEqual(full.length);for(const p of full){expect([...p.p,...p.s,p.alpha??1].every(Number.isFinite)).toBe(true);expect(p.s.every(v=>v>0)).toBe(true);}}
  expect(disasterParts(null,town,false)).toEqual([]);
  const atlas=primitiveAtlas();expect(atlas.groups).toHaveLength(0);expect(new Set(atlas.attributes.shapeId.array).size).toBe(7);expect(atlas.attributes.position.count).toBeLessThan(700);atlas.dispose();
});
test('repair scaffolding requires both quotas and anchors on the closed lot',()=>{
  const d=disaster('scorch');expect(effectCenter(d,town)).toEqual(town.lots.find(l=>l.entry?.id==='pet_shelter')!.center);
  expect(repairProgress({...d,checkins:6,people:0})).toBe(0);expect(repairProgress({...d,checkins:3,people:3})).toBe(.5);expect(repairProgress({...d,checkins:30,people:20})).toBe(1);
  expect(disasterParts({...d,checkins:3,people:3},town,false).filter(p=>p.fx===11)).toHaveLength(6);
});
test('lightning has one soft pulse per twelve seconds, none in reduced motion',()=>{
  let pulses=0,on=false;for(let i=0;i<3600;i++){const t=i/100,intensity=lightningIntensity(t,false);if(intensity>0&&!on)pulses++;on=intensity>0;expect(intensity).toBeLessThanOrEqual(.65);expect(lightningIntensity(t,true)).toBe(0);}expect(pulses).toBe(3);
});
test('candle windows restore original emissions after blackout',()=>{
  const model=new Group(),material=new MeshStandardMaterial({emissive:'#123456',emissiveIntensity:.2});material.name='glass';model.add(new Mesh(new BoxGeometry(),material));
  gamingLight(model,0,false,true,true);expect(material.emissive.getHexString()).toBe('ffd59a');expect(material.emissiveIntensity).toBe(.8);
  gamingLight(model,3,false,false);expect(material.emissive.getHexString()).toBe('123456');expect(material.emissiveIntensity).toBe(.2);
});
