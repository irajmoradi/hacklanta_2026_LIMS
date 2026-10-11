import { expect, test } from 'bun:test';
import catalog from '../catalog.fallback.json';
import type { Entry } from '../registryData';
import { createTown, destination, entrance } from './town';
import { Mesh, MeshStandardMaterial, BoxGeometry, Group } from 'three';
import { fitnessAsset } from '../fitnessAsset';
import { gamingLight } from '../gamingLight';
import { workoutPose } from '../workout';
import { route, sidewalkGraph } from './navigation';

const town = createTown(1337, catalog.entries as Entry[], [0,1]);
const world = {level:1, unlocked:[]};
test('new activities keep home, study and schedule semantics; events override gaming', () => {
  const home = entrance(town.homes.get(0)!);
  expect(destination(town,0,[],world,false,0,'home')).toEqual({target:home,activity:'wander'});
  expect(destination(town,0,[],world,false,0,'gaming')).toEqual({target:home,activity:'gaming'});
  expect(destination(town,0,[],world,false,550,'gaming').activity).toBe('wander');
  expect(destination(town,0,[],world,false,0,'working_out').activity).toBe('workout');
  const target = destination(town,0,[],world,false,0,'working_out').target;
  expect(route(sidewalkGraph(town),home,target).at(-1)).toEqual(target);
  expect(destination(town,0,[],world,false,550,'working_out').target).toEqual(home);
  const open = {level:99,unlocked:catalog.entries.map(e=>e.id)};
  expect(destination(town,0,[],open,true,0,'gaming').activity).toBe('gather');
  expect(destination(town,0,[],world,false,0,'studying',false,0).activity).toBe('study');
  const missing = {...town,lots:town.lots.filter(l=>l.entry?.id!=='fitness_corner')};
  expect(destination(missing,0,[],world,false,0,'working_out').target).toEqual(home);
});
test('fitness stays in budget and exercises cycle through all three poses', () => {
  let triangles = 0;
  fitnessAsset().traverse(n => {if(n instanceof Mesh) triangles += (n.geometry.index?.count ?? n.geometry.attributes.position.count)/3;});
  expect(triangles).toBeLessThanOrEqual(4000);
  expect([0,8,16].map(t=>workoutPose(t,0).name)).toEqual(['push-ups','squats','jumping-jacks']);
});
test('screen light flickers only glass and restores original emission when gaming ends', () => {
  const model = new Group(), glass = new MeshStandardMaterial({name:'glass',emissive:'#123456',emissiveIntensity:.2});
  const wall = new MeshStandardMaterial({name:'wall'});
  model.add(new Mesh(new BoxGeometry(),glass),new Mesh(new BoxGeometry(),wall));
  gamingLight(model,0,true); const first = glass.emissiveIntensity;
  gamingLight(model,.2,true); expect(glass.emissiveIntensity).not.toBe(first);
  expect(wall.emissive.getHexString()).toBe('000000');
  gamingLight(model,1,false); expect(glass.emissive.getHexString()).toBe('123456'); expect(glass.emissiveIntensity).toBe(.2);
});
