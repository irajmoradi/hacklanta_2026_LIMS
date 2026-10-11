import {expect, test} from 'bun:test';
import {MockApi} from './mock';
import {DEMO_USER_ID, DEMO_VILLAGE_ID, makeFixtures} from './fixtures';
import {HOUSE_PARTS, HOUSE_STYLES, selectHouse, validHouseColors} from '../scene/houseStyles';
import {Group, Mesh, MeshStandardMaterial, BoxGeometry} from 'three';
import {cloneModel} from '../scene/OptionalModel';
import type {Village, Profile} from './types';

const colors = {wall:'#f1d9ad', roof:'#69566b', trim:'#eee3c8', door:'#487d6b', accent:'#ca795d'};
test('all house parts tint isolated named materials and explicit styles preserve progression', () => {
  const source = new Group();
  for (const part of [...HOUSE_PARTS, 'window']) { const material = new MeshStandardMaterial({color:'#ffffff'}); material.name = part; source.add(new Mesh(new BoxGeometry(),material)); }
  const clone = cloneModel(source,1,colors,true);
  clone.children[0].children.forEach((node,i) => expect(((node as Mesh).material as MeshStandardMaterial).color.getHexString()).toBe(i < 5 ? colors[HOUSE_PARTS[i]].slice(1) : 'ffffff'));
  source.children.forEach(node => expect(((node as Mesh).material as MeshStandardMaterial).color.getHexString()).toBe('ffffff'));
  const person = makeFixtures().village.villagers[0];
  for (const style of HOUSE_STYLES) {
    const house = selectHouse({...person,house_style:style,house_colors:colors,house_level:2});
    expect(house.model).toBe(`house_${style}_lv2`); expect(house.colors).toEqual(colors);
  }
  expect(validHouseColors(colors)).toBe(true);
  for (const value of [null, {}, {...colors,wall:'#FFF'}, {...colors,wall:'#ABCDEF'}, {...colors,extra:'#ffffff'}]) expect(validHouseColors(value)).toBe(false);
});
test('mock settings round trip, membership scope, validation, omitted fields and reset', async () => {
  const api = new MockApi(), path = `/villages/${DEMO_VILLAGE_ID}`;
  const payload = {village_id:DEMO_VILLAGE_ID,house_style:'beach',house_colors:colors};
  await api.request('PATCH','/me',DEMO_USER_ID,payload);
  const profile = await api.request<Profile>('GET',`${path}/users/${DEMO_USER_ID}`,DEMO_USER_ID);
  expect(profile.villager.house_colors).toEqual(colors);
  await api.request('PATCH','/me',DEMO_USER_ID,{display_name:'Updated'});
  const village = await api.request<Village>('GET',path,DEMO_USER_ID);
  expect(village.villagers.find(p=>p.user_id===DEMO_USER_ID)?.house_style).toBe('beach');
  expect(village.villagers.filter(p=>p.user_id!==DEMO_USER_ID).every(p=>!p.house_colors)).toBe(true);
  const created = await api.request<{village:{id:string}}>('POST','/villages',DEMO_USER_ID,{name:'Another village'});
  const other = await api.request<Profile>('GET',`/villages/${created.village.id}/users/${DEMO_USER_ID}`,DEMO_USER_ID);
  expect(other.villager.house_colors).toBeNull();
  await api.request('PATCH','/me',DEMO_USER_ID,{village_id:created.village.id,house_style:'modern'});
  expect((await api.request<Profile>('GET',`${path}/users/${DEMO_USER_ID}`,DEMO_USER_ID)).villager.house_style).toBe('beach');
  for (const input of [{house_style:'beach'}, {...payload,village_id:crypto.randomUUID()}, {...payload,house_style:'castle'}, {...payload,house_colors:{wall:'#ffffff'}}]) await expect(api.request('PATCH','/me',DEMO_USER_ID,input)).rejects.toThrow();
  await api.request('PATCH','/me',DEMO_USER_ID,{...payload,house_style:null,house_colors:null});
  expect((await api.request<Profile>('GET',`${path}/users/${DEMO_USER_ID}`,DEMO_USER_ID)).villager.house_colors).toBeNull();
});

test('house options are membership-scoped API state, with strict validation and independent resets', async () => {
  const api = new MockApi(), path = `/villages/${DEMO_VILLAGE_ID}/users/${DEMO_USER_ID}`;
  const options = {village_id:DEMO_VILLAGE_ID,house_variant:{2:'bay'},house_materials:{wall:'brick',roof:'metal'}} as const;
  await api.request('PATCH','/me',DEMO_USER_ID,options);
  const person = (await api.request<Profile>('GET',path,DEMO_USER_ID)).villager;
  expect(person.house_variant).toEqual({2:'bay'}); expect(person.house_materials).toEqual(options.house_materials);
  for (const bad of [{house_variant:{1:'tower'}},{house_variant:{6:'classic'}},{house_materials:{wall:'metal'}},{house_materials:[]}]) {
    await expect(api.request('PATCH','/me',DEMO_USER_ID,{village_id:DEMO_VILLAGE_ID,...bad})).rejects.toThrow();
  }
  const other = await api.request<{village:{id:string}}>('POST','/villages',DEMO_USER_ID,{name:'Other home'});
  const second = (await api.request<Profile>('GET',`/villages/${other.village.id}/users/${DEMO_USER_ID}`,DEMO_USER_ID)).villager;
  expect(second.house_variant).toBeNull(); expect(second.house_materials).toBeNull();
  await api.request('PATCH','/me',DEMO_USER_ID,{village_id:DEMO_VILLAGE_ID,house_variant:null});
  const reset = (await api.request<Profile>('GET',path,DEMO_USER_ID)).villager;
  expect(reset.house_variant).toBeNull(); expect(reset.house_materials).toEqual(options.house_materials);
});
