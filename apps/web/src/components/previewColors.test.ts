import {expect, test} from 'bun:test';
import {BoxGeometry, Group, Mesh, MeshStandardMaterial} from 'three';
import {paintOutfitPreview, paintHousePreview} from './previewColors';
test('preview palettes update existing materials without replacing geometry or unrelated items',()=>{
  const root=new Group(), item=new Group(); item.name='cosmetic:hoodie'; root.add(item);
  const materials=['primary','secondary','accent'].map(name=>new MeshStandardMaterial({name,color:'#ffffff'}));
  const mesh=new Mesh(new BoxGeometry(),materials); item.add(mesh);
  const other=new Mesh(new BoxGeometry(),new MeshStandardMaterial({name:'primary',color:'#ffffff'})); root.add(other);
  const geometry=mesh.geometry;
  paintOutfitPreview(root,[{item_id:'hoodie',slot:'torso',asset_key:null,colors:{primary:'#557ca7',secondary:'#b89bb8',accent:'#ffe4a1'}}]);
  expect(materials.map(m=>m.color.getHexString())).toEqual(['557ca7','b89bb8','ffe4a1']);
  expect(mesh.geometry).toBe(geometry); expect(mesh.material).toBe(materials);
  expect(other.material.color.getHexString()).toBe('ffffff');
});
test('legacy wearable channels and named house parts keep their existing materials',()=>{
  const root=new Group(), item=new Group(); item.name='cosmetic:hat';root.add(item);
  const legacy=new MeshStandardMaterial({name:'accent'});item.add(new Mesh(new BoxGeometry(),legacy));
  paintOutfitPreview(root,[{item_id:'hat',slot:'head',asset_key:null,colors:{primary:'#689b68'}}]);
  expect(legacy.color.getHexString()).toBe('689b68');
  const wall=new MeshStandardMaterial({name:'wall'});root.add(new Mesh(new BoxGeometry(),wall));
  paintHousePreview(root,{wall:'#487d6b',roof:'#69566b',trim:'#ffffff',door:'#123456',accent:'#abcdef'});
  expect(wall.color.getHexString()).toBe('487d6b');
});
