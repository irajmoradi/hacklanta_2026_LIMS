import {expect,test} from 'bun:test';
import {Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {HOUSE_STYLES} from './houseStyles';
import {HOUSE_VARIANTS} from './houseOptions';
import {cloneModel} from './OptionalModel';
import {animalPose,paddockLayout} from './paddock';

test('all styles and tiers fit beside the paddock, inside lot pavement and neighbors',async()=>{
  for(const style of HOUSE_STYLES)for(const level of [1,2,3,4,5] as const)for(const variant of HOUSE_VARIANTS[level]){
    const model=variant !== 'classic' ? `house_${style}_lv${level}_${variant}` : level>3?`house_lv${level}`:`house_${style}_lv${level}`;
    const file=await Bun.file(`${import.meta.dir}/../../public/models/${model}.glb`).arrayBuffer();
    const loader=new GLTFLoader();
    // Geometry bounds do not need browser image decoding.
    loader.register(parser => { parser.loadTexture = async () => null as never; return {name:'geometry-only'}; });
    const gltf=await loader.parseAsync(file,'');
    const p=paddockLayout(style);
    const house=cloneModel(gltf.scene,level>3?10:1,undefined,level<=3);
    house.scale.multiplyScalar((level>3?1:2.2)*p.houseScale);house.position.x=p.houseX;
    const box=new Box3().setFromObject(house), yard=new Box3(new Vector3(p.center[0]-p.width/2-.06,0,p.center[1]-p.depth/2-.06),new Vector3(p.center[0]+p.width/2+.06,1,p.center[1]+p.depth/2+.06));
    expect(box.intersectsBox(yard)).toBe(false);
    for(const bounds of [box,yard])for(const axis of ['x','z'] as const){expect(bounds.min[axis]).toBeGreaterThan(-5.2);expect(bounds.max[axis]).toBeLessThan(5.2);}
    // Adjacent lots start 16m away; both envelopes are strictly inside their own lot.
    expect(box.intersectsBox(yard.clone().translate(new Vector3(16,0,0)))).toBe(false);
  }
});
test('six animals stay inside fence through a complete wander cycle',()=>{
  for(let t=0;t<120;t+=.3)for(let i=0;i<6;i++){
    const p=animalPose(i,t,2.2,7.6);expect(Math.abs(p.x)+.35).toBeLessThan(1.1);expect(Math.abs(p.z)+.35).toBeLessThan(3.8);
  }
});
