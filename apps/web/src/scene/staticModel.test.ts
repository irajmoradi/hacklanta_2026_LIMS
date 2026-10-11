import {expect,test} from 'bun:test';
import {AnimationClip,Box3,BoxGeometry,Group,Mesh,MeshStandardMaterial,SkinnedMesh} from 'three';
import {gamingLight} from './gamingLight';
import {staticModel} from './staticModel';
import {cloneModel} from './OptionalModel';

test('static material batching preserves world bounds, triangles, material roles and cached source ownership',()=>{
  const root=new Group(),nested=new Group(),wall=new MeshStandardMaterial({color:'#aabbcc'});
  wall.name='wall';root.add(nested);root.position.set(2,0,-3);nested.rotation.y=.4;
  for(let i=0;i<30;i++){const mesh=new Mesh(new BoxGeometry(1,2,3),wall);mesh.position.set(i%5,Math.floor(i/5),0);nested.add(mesh);}
  const bounds=new Box3().setFromObject(root),merged=staticModel(root);
  expect(merged.children).toHaveLength(1);
  expect(new Box3().setFromObject(merged).min.distanceTo(bounds.min)).toBeLessThan(.00001);
  expect(new Box3().setFromObject(merged).max.distanceTo(bounds.max)).toBeLessThan(.00001);
  expect((merged.children[0] as Mesh).geometry.attributes.position.count).toBe(30*36);
  expect((merged.children[0] as Mesh).material).toBe(wall);
  expect(nested.children).toHaveLength(30);
  expect(staticModel(root)).toBe(merged);
  const colored=cloneModel(merged,1,{wall:'#ff0000'},true);
  const materials:MeshStandardMaterial[]=[];
  colored.traverse(n=>{if(n instanceof Mesh)materials.push(n.material as MeshStandardMaterial);});
  expect(materials[0].color.getHexString()).toBe('ff0000');
  expect(wall.color.getHexString()).toBe('aabbcc');
});
test('animated, skinned, morphing and multi-material models preserve their hierarchy',()=>{
  const animated=new Group();animated.animations=[new AnimationClip('wind',1,[])];
  expect(staticModel(animated)).toBe(animated);
  const skinned=new Group();skinned.add(new SkinnedMesh(new BoxGeometry(),new MeshStandardMaterial()));
  expect(staticModel(skinned)).toBe(skinned);
  const multi=new Group();multi.add(new Mesh(new BoxGeometry(),[new MeshStandardMaterial(),new MeshStandardMaterial()]));
  expect(staticModel(multi)).toBe(multi);
  const morph=new Group(),geo=new BoxGeometry();geo.morphAttributes.position=[geo.attributes.position.clone()];
  morph.add(new Mesh(geo,new MeshStandardMaterial()));expect(staticModel(morph)).toBe(morph);
});

test('batched house windows still animate independently and restore their emission',()=>{
  const source=new Group(),glass=new MeshStandardMaterial({name:'glass',emissive:'#123456',emissiveIntensity:.2});
  for(let i=0;i<4;i++)source.add(new Mesh(new BoxGeometry(),glass));
  const batched=staticModel(source),playing=cloneModel(batched,1,undefined,true),neighbor=cloneModel(batched,1,undefined,true);
  expect(batched.children).toHaveLength(1);
  const windowMaterial=(root:Group)=>((root.children[0].children[0] as Mesh).material as MeshStandardMaterial);
  gamingLight(playing,0,true);expect(windowMaterial(playing).emissiveIntensity).toBeGreaterThan(1);
  expect(windowMaterial(neighbor).emissiveIntensity).toBe(.2);expect(glass.emissiveIntensity).toBe(.2);
  gamingLight(playing,1,false);expect(windowMaterial(playing).emissive.getHexString()).toBe('123456');
  expect(windowMaterial(playing).emissiveIntensity).toBe(.2);
});
