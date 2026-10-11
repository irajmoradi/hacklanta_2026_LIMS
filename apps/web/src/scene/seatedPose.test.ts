import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Vector3} from 'three';
import {cloneModel} from './OptionalModel';
import {prepareEmoteRig} from './emotes';
import {prepareSeatedRig,seatedAnimator} from './seatedPose';
import {CAFE_SEATS,CAFE_OFFSET,assignCafeSeats} from './layout/cafeSeats';
import {STUDY_SEATS,assignStudySeats} from './layout/studySeats';
import {assignBenchSeats} from './layout/benchSeats';
function glb(name:string){const bytes=readFileSync(new URL(`../../public/models/${name}.glb`,import.meta.url));return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());}
test('every cafe and study anchor lies on an actual shipped chair or bench',()=>{
 const cafe=glb('cafe_patio');for(const seat of CAFE_SEATS){const chair=cafe.nodes.find((n:any)=>/^chair_\d_\d$/.test(n.name)&&Math.abs(n.translation[0]-seat.offset[0])<.001&&Math.abs(n.translation[2]+CAFE_OFFSET[2]-seat.offset[1])<.001);expect(chair).toBeDefined();expect(chair.translation[1]+.06).toBeCloseTo(seat.height);}
 const study=glb('study_nook');for(const seat of STUDY_SEATS){const bench=study.nodes.find((n:any)=>/^table_\d_bench(?:\.001)?$/.test(n.name)&&Math.abs(n.translation[0]-seat.offset[0])<1.15&&Math.abs(n.translation[2]-seat.offset[1])<.001);expect(bench).toBeDefined();expect(bench.translation[1]+.08).toBeCloseTo(seat.height);}
});
test('sparse, reordered and overflow memberships never share seats',()=>{
 const slots=[0,60,120,3,63,123,6,66,126,9,69,129,15,75,135];for(const assign of [assignCafeSeats,assignStudySeats,assignBenchSeats]){const a=assign(slots);expect(a).toEqual(assign([...slots].reverse()));expect(new Set(a.values()).size).toBe(a.size);}
});
test('real rig has forward thighs and downward shins, restores walking and keeps source private',async()=>{
 const bytes=readFileSync(new URL('../../public/models/villager_base.glb',import.meta.url));
 const {scene:source}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=cloneModel(source,1.8);prepareEmoteRig(scene);prepareSeatedRig(scene);expect(source.getObjectByName('Knee_L')).toBeUndefined();
 const sitter=seatedAnimator(scene);const original=scene.getObjectByName('Leg_L')!.quaternion.clone();sitter.apply();scene.updateMatrixWorld(true);
 for(const side of ['L','R']){const hip=scene.getObjectByName(`Leg_${side}`)!,knee=scene.getObjectByName(`Knee_${side}`)!;const a=hip.getWorldPosition(new Vector3()),b=knee.getWorldPosition(new Vector3()),c=knee.localToWorld(new Vector3(0,.2,0));expect(b.z-a.z).toBeGreaterThan(.2);expect(Math.abs(b.y-a.y)).toBeLessThan(.001);expect(c.y).toBeLessThan(b.y-.19);}
 sitter.reset();expect(scene.getObjectByName('Leg_L')!.quaternion.equals(original)).toBe(true);
});

test('a manually occupied chair remains reserved when cohorts change',()=>{
 for(const assign of [assignCafeSeats,assignStudySeats,assignBenchSeats]){
  const seats=assign([0,1,2,60,61,62],{slot:62,seat:1});expect(seats.get(62)).toBe(1);expect(new Set(seats.values()).size).toBe(seats.size);expect(seats.get(1)).not.toBe(1);
 }
});
