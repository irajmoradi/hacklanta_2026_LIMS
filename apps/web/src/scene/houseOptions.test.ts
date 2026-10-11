import { expect, test } from 'bun:test';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { cleanHouseOptions, HOUSE_VARIANTS } from './houseOptions';
import { selectHouse, HOUSE_STYLES } from './houseStyles';
import { cloneModel } from './OptionalModel';
import { makeFixtures } from '../api/fixtures';

test('all style and level variants select independent shipped models; invalid choices fall back', async () => {
  const person=makeFixtures().village.villagers[0];
  for (const style of HOUSE_STYLES) for (const level of [1,2,3,4,5] as const) for (const variant of HOUSE_VARIANTS[level]) {
    const house=selectHouse({...person,house_style:style,house_level:level,house_variant:{[level]:variant}});
    expect(house.variant).toBe(variant);
    expect(await Bun.file(new URL(`../../public/models/${house.model}.glb`,import.meta.url)).exists()).toBe(true);
  }
  expect(cleanHouseOptions({house_variant:{1:'tower',2:'bay',6:'porch'},house_materials:{wall:'glass',roof:'metal',extra:'wood'}})).toEqual({house_variant:{2:'bay'},house_materials:{roof:'metal'}});
  expect(selectHouse({...person,house_level:3,house_variant:{2:'bay'}}).variant).toBe('classic');
});

test('material changes retain paint and isolate cached models and other owners', () => {
  const source=new Group(), wall=new MeshStandardMaterial({color:'#ffffff'}); wall.name='wall';
  source.add(new Mesh(new BoxGeometry(),wall));
  const a=cloneModel(source,1,{wall:'#aa5533'},true,{wall:'brick'});
  const b=cloneModel(source,1,{wall:'#3355aa'},true,{wall:'stone'});
  const material=(group: Group)=>(group.children[0].children[0] as Mesh).material as MeshStandardMaterial;
  expect(material(a).color.getHexString()).toBe('aa5533');
  expect(material(a).map).not.toBe(material(b).map);
  expect(material(a).map!.image.width).toBe(128);
  expect(wall.map).toBeNull(); expect(wall.color.getHexString()).toBe('ffffff');
});
