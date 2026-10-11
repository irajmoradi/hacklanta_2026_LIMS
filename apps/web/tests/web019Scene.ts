import { _roots } from '@react-three/fiber';
import { Vector3 } from 'three';
function state() {
  const canvas=document.querySelector<HTMLCanvasElement>('.scene canvas')!;
  const root=_roots.get(canvas)!.store.getState();
  return {canvas,...root};
}
export function inspectPlayer(id:string) {
  const {scene,camera,canvas}=state(), person=scene.getObjectByName(`villager:${id}`)!;
  const world=person.getWorldPosition(new Vector3());
  const screen=world.clone().add(new Vector3(0,.8,0)).project(camera), rect=canvas.getBoundingClientRect();
  return {parent:person.parent?.name,world:world.toArray(),screen:{x:rect.left+(screen.x+1)*rect.width/2,y:rect.top+(1-screen.y)*rect.height/2}};
}
export function advanceRide(seconds:number) { state().clock.elapsedTime+=seconds; }

export function viewPlayerFromAbove(id:string) {
  const {scene,camera,controls}=state();
  const world=scene.getObjectByName(`villager:${id}`)!.getWorldPosition(new Vector3());
  const orbit=controls as import('three-stdlib').OrbitControls;
  orbit.target.copy(world);camera.position.copy(world).add(new Vector3(0,40,18));orbit.update();
}
export function projectGround(x:number,z:number) {
  const {camera,canvas}=state(), rect=canvas.getBoundingClientRect();
  const p=new Vector3(x*.55,0,z*.55).project(camera);
  return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
}

export function cameraState() {
  const {camera,controls}=state();
  return {zoom:camera.zoom,target:(controls as import('three-stdlib').OrbitControls).target.toArray()};
}

export function projectBuildingGround(id:string) {
  const {scene,camera,canvas}=state(), rect=canvas.getBoundingClientRect();
  const p=scene.getObjectByName(`unlocked:${id}`)!.getWorldPosition(new Vector3());
  p.y=0;p.project(camera);
  return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
}

export function fittedMannequins() {
  const scene=_roots.get(document.querySelector<HTMLCanvasElement>('.shop-room canvas')!)!.store.getState().scene;
  let count=0;
  scene.traverseVisible(node=>{if(node.name.startsWith('mannequin:') && node.getObjectByName(`cosmetic:${node.name.slice(10)}`)) count++;});
  return count;
}
