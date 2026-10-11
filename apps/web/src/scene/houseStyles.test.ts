import {expect, test} from 'bun:test';
import {makeFixtures} from '../api/fixtures';
import {HOUSE_STYLES, houseHash, selectHouse, houseAttachment} from './houseStyles';
import {BoxGeometry, Group, Mesh, MeshStandardMaterial, Box3, Vector3} from 'three';
import {cloneModel} from './OptionalModel';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Euler, Raycaster, DoubleSide} from 'three';
import type { HouseVariant } from './houseOptions';

test('UTF-8 FNV-1a is stable; both seeded cohorts have five distinct homes', () => {
  expect(houseHash('hello')).toBe(0x4f9f2cab);
  for (const prefix of ['00000000','13370000']) {
    const people = makeFixtures().village.villagers.map(p=>({...p,user_id:p.user_id.replace('00000000',prefix)}));
    const homes = people.map(selectHouse);
    expect(new Set(homes.map(h=>h.style)).size).toBe(5);
    expect([...people].reverse().map(selectHouse).reverse()).toEqual(homes);
    expect(people.map(p=>selectHouse({...p, house_slot:99} as typeof p))).toEqual(homes);
    homes.forEach(h=>expect(Object.keys(h.colors).sort()).toEqual(['accent','door','roof','trim','wall']));
  }
  expect(selectHouse({...makeFixtures().village.villagers[0],user_id:'朋友 🏡'})).toEqual(selectHouse({...makeFixtures().village.villagers[0],user_id:'朋友 🏡'}));
});
test('explicit style wins; progression remains authoritative with legacy upper tiers', () => {
  const person = makeFixtures().village.villagers[0];
  for (const style of HOUSE_STYLES) {
    const equipped = [{item_id:`house_${style}_lv1`,asset_key:null,slot:'house' as const}];
    expect(selectHouse({...person,equipped,house_level:3}).model).toBe(`house_${style}_lv3`);
    expect(selectHouse({...person,equipped,house_level:4}).model).toBe('house_lv4');
  }
  for (const [input,level] of [[-1,1],[NaN,1],[2.9,2],[99,5]]) expect(selectHouse({...person,house_level:input}).level).toBe(level);
});
test('authored clones preserve origins, tint only named materials and isolate owners', () => {
  const source = new Group(), wall = new MeshStandardMaterial({color:'#ffffff'}); wall.name='wall';
  const mesh = new Mesh(new BoxGeometry(1,2,1),wall); mesh.position.set(1,1,2); source.add(mesh);
  const a = cloneModel(source,1,{wall:'#ff0000'},true), b = cloneModel(source,1,{wall:'#0000ff'},true);
  const material = (g: Group) => ((g.children[0].children[0] as Mesh).material as MeshStandardMaterial);
  expect(material(a).color.getHexString()).toBe('ff0000'); expect(material(b).color.getHexString()).toBe('0000ff'); expect(wall.color.getHexString()).toBe('ffffff');
  expect(new Box3().setFromObject(a).getCenter(new Vector3()).toArray()).toEqual([1,1,2]);
});
test('roof panels follow each style slope; backyard clears the covered rear deck', () => {
  for (const style of HOUSE_STYLES) for (const level of [1,2,3]) {
    const house = selectHouse({...makeFixtures().village.villagers[0],house_level:level,equipped_ids:[`house_${style}_lv1`],equipped:[]});
    const roof = houseAttachment(house,{id:'upgrade_solar_roof',kind:'house'});
    expect(roof.offset[1]).toBeGreaterThan(1.4);
    expect(roof.rotation[2] === 0).toBe(style === 'modern');
    expect(houseAttachment(house,{id:'house_backyard',kind:'house'}).offset[2]).toBeLessThan(-1.65);
  }
});

test('shipped roof geometry supports all styles and legacy upper tiers without intersecting chimneys', async () => {
  const loader = new GLTFLoader();
  // This Node test measures geometry. Texture decoding is covered by browser QA.
  loader.register(parser => { parser.loadTexture = async () => null as never; return {name:'geometry-only'}; });
  const cases = HOUSE_STYLES.flatMap(style=>[1,2,3].map(level=>({style,level,variant:'classic' as HouseVariant})));
  cases.push({style:'tudor',level:4,variant:'classic'},{style:'beach',level:5,variant:'classic'});
  for (const style of HOUSE_STYLES) for (const level of [3,4,5]) for (const variant of ['tower','greenhouse'] as const) cases.push({style,level,variant});
  for (const {style,level,variant} of cases) {
    const house=selectHouse({...makeFixtures().village.villagers[0],house_level:level,house_variant:{[level]:variant},equipped:[],equipped_ids:[`house_${style}_lv1`]});
    const bytes=await Bun.file(new URL(`../../public/models/${house.model}.glb`,import.meta.url)).arrayBuffer();
    const source=(await loader.parseAsync(bytes,'')).scene;
    const model=house.level>3 ? cloneModel(source,5.5) : source;
    model.updateMatrixWorld(true);
    const roof: Mesh[]=[];
    model.traverse(n=>{if(n instanceof Mesh) {
      const materials=Array.isArray(n.material)?n.material:[n.material];
      if(materials.some(m=>m.name==='roof')) {materials.forEach(m=>m.side=DoubleSide);roof.push(n);}
    }});
    const attach=houseAttachment(house,{id:'upgrade_solar_roof',kind:'house'});
    const panelBounds=new Box3().setFromPoints([-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>
      new Vector3(x*.475,(y+1)*.035,z*.3).applyEuler(new Euler(...attach.rotation)).add(new Vector3(...attach.offset))))));
    model.traverse(n=>{if(n instanceof Mesh && /chimney|vent/.test(n.name))
      expect(panelBounds.intersectsBox(new Box3().setFromObject(n)),`${house.model} clears ${n.name}`).toBe(false);
    });
    // Panel corners in its normalized footprint; sample the plane at its base.
    for(const x of [-.4,0,.4]) for(const z of [-.25,.25]) {
      const point=new Vector3(x,0,z).applyEuler(new Euler(...attach.rotation)).add(new Vector3(...attach.offset));
      const hit=new Raycaster(new Vector3(point.x,20,point.z),new Vector3(0,-1,0)).intersectObjects(roof,false)[0];
      expect(hit,`${house.model} has roof under panel`).toBeDefined();
      const gap=point.y-hit.point.y;
      expect(gap,`${house.model} panel above roof`).toBeGreaterThanOrEqual(-.01);
      expect(gap,`${house.model} panel near roof`).toBeLessThan(.2);
    }
  }
}, 30000);
