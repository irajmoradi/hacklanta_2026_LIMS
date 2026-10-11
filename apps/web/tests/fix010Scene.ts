import { _roots } from '@react-three/fiber';
import { Mesh, Vector3 } from 'three';
const id='00000000-0000-4000-8000-000000000001';
function state() { return _roots.get(document.querySelector<HTMLCanvasElement>('.scene canvas')!)!.store.getState(); }
export function inspect() {
 const {scene}=state(), rig=scene.getObjectByName(`villager:${id}`)!;rig.updateWorldMatrix(true,true);
 const pos=(name:string)=>rig.getObjectByName(name)?.getWorldPosition(new Vector3()).toArray();
 return {hand:pos('Hand_R'),head:pos('Head'),left:pos('Hand_L'),elbow:rig.getObjectByName('Elbow_R')?.rotation.z,
 arm:rig.getObjectByName('Arm_R')?.quaternion.toArray(),root:rig.getObjectByName('Root')?.rotation.y};
}
export function closeup() {
 const {scene,camera,controls}=state(), rig=scene.getObjectByName(`villager:${id}`)!;
 // Studio framing for QA: hide occluding town meshes, retaining the actual live avatar.
 scene.traverse(node=>{if(node instanceof Mesh){let ancestor: typeof node.parent=node;while(ancestor && ancestor!==rig)ancestor=ancestor.parent;if(!ancestor)node.visible=false;}});
 const target=rig.getWorldPosition(new Vector3()).add(new Vector3(0,1,0));
 const orbit=controls as import('three-stdlib').OrbitControls;
 orbit.target.copy(target);camera.position.copy(target).add(new Vector3(0,2,12));camera.zoom=125;camera.updateProjectionMatrix();orbit.update();
}
