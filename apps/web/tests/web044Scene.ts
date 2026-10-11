import {_roots} from '@react-three/fiber';
import {Vector3,OrthographicCamera} from 'three';
export function state(){return _roots.get(document.querySelector('.scene canvas') as HTMLCanvasElement)!.store.getState();}
export function cafePoint(){const {scene,camera,size}=state();const cafe=scene.getObjectByName('unlocked:storefront_cafe')!;const p=cafe.localToWorld(new Vector3(4.55,.6,4.6)).project(camera);return {x:(p.x+1)*size.width/2,y:(1-p.y)*size.height/2};}
export function frameCafe(){const {scene,camera,controls}=state();const c=controls as any;const cafe=scene.getObjectByName('unlocked:storefront_cafe')!;const look=cafe.localToWorld(new Vector3(0,1,4.6));c.enableDamping=false;c.target.copy(look);camera.position.copy(look).add(new Vector3(12,10,20));(camera as OrthographicCamera).zoom=65;camera.updateProjectionMatrix();c.update();}
export function snapshot(){const {scene,camera,controls,gl}=state();const people:any[]=[];scene.traverse(n=>{if(n.name.startsWith('villager:'))people.push({name:n.name,position:n.position.toArray(),seated:n.userData.seated,knees:['L','R'].map(s=>n.getObjectByName(`Knee_${s}`)?.rotation.x)});});return {position:camera.position.toArray(),zoom:(camera as OrthographicCamera).zoom,target:(controls as any).target.toArray(),dpr:gl.getPixelRatio(),people};}

/** Advance the actual useFrame subscribers without thousands of GPU renders. */
export function settle(){const s=state();for(let i=0;i<1600;i++)for(const sub of s.internal.subscribers)sub.ref.current(s,.05);}

export function framePlaza(){const {scene,camera,controls}=state();const c=controls as any;const plaza=scene.getObjectByName('unlocked:mayor_podium')!;const look=plaza.localToWorld(new Vector3(0,1,0));c.enableDamping=false;c.target.copy(look);camera.position.copy(look).add(new Vector3(12,10,20));(camera as OrthographicCamera).zoom=35;camera.updateProjectionMatrix();c.update();}

export function crowdDetail(){const {scene}=state();const people:any[]=[];scene.traverse(n=>{if(n.name.startsWith('villager:'))people.push({id:n.name.slice(9),seated:n.userData.seated,detail:!!n.getObjectByName('crowd-detailed'),impostor:!!n.getObjectByName('crowd-impostor')});});return people;}

export function frameLibrary(){const {scene,camera,controls,size}=state();const c=controls as any;const library=scene.getObjectByName('unlocked:library')!;const look=library.localToWorld(new Vector3(0,1,0));c.enableDamping=false;c.target.copy(look);camera.position.copy(look).add(new Vector3(12,10,20));(camera as OrthographicCamera).zoom=55;camera.updateProjectionMatrix();c.update();return {x:size.width/2,y:size.height/2};}
