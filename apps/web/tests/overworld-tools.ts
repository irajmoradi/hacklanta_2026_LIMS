import {_roots} from '@react-three/fiber';
import {Vector3,OrthographicCamera} from 'three';
import {townLive} from '../src/api/townLive';
export function state(){return _roots.get(document.querySelector('.scene canvas') as HTMLCanvasElement)!.store.getState();}
export function frameAvatar(id:string){
  const {scene,camera,controls}=state();const c=controls as any;
  const look=scene.getObjectByName(`villager:${id}`)!.getWorldPosition(new Vector3());
  c.enableDamping=false;c.target.copy(look);camera.position.copy(look).add(new Vector3(12,12,20));
  (camera as OrthographicCamera).zoom=30;camera.updateProjectionMatrix();c.update();
}
export function frame(id:string){
  const {scene,camera,controls}=state(); const c=controls as any;
  const building=scene.getObjectByName(`unlocked:${id}`)!;
  const look=building.localToWorld(new Vector3(0,1,2));
  c.enableDamping=false;c.target.copy(look);camera.position.copy(look).add(new Vector3(12,12,20));
  c.maxZoom=65;(camera as OrthographicCamera).zoom=55;camera.updateProjectionMatrix();c.update();
}
export function ground(id:string){
  const {scene,camera,size,gl}=state();const building=scene.getObjectByName(`unlocked:${id}`)!;
  const v=building.getWorldPosition(new Vector3());v.y=0;v.project(camera);
  const rect=gl.domElement.getBoundingClientRect();
  return {x:rect.left+(v.x+1)*size.width/2,y:rect.top+(1-v.y)*size.height/2};
}
export function intent(action:string,fields:Record<string,unknown>){return townLive.intent(action,fields);}
export function snapshot(){return [...townLive.world.avatars.values()];}
export function resyncGap(){townLive.world.seq=-99;}
