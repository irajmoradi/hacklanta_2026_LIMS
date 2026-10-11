import {useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import type {Group} from 'three';
import type {Villager} from '../api/types';
import {OptionalModel} from './OptionalModel';
import {animalPose,paddockLayout} from './paddock';
import type {HouseStyle} from './houseStyles';

function Animal({model,index,width,depth}:{model:string;index:number;width:number;depth:number}) {
  const root=useRef<Group>(null);
  const [reduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  useFrame(({clock})=>{if(!root.current)return;const t=reduced?0:clock.elapsedTime;
    const p=animalPose(index,t,width,depth);root.current.position.set(p.x,p.bob,p.z);root.current.rotation.set(0,p.yaw,0);});
  return <group ref={root} name={`farm-animal:${model}`}><OptionalModel name={model} size={.7} hero={false} animate={(mesh,time)=>{const head=mesh.getObjectByName('head_peck');if(head)head.rotation.x=reduced?0:Math.max(0,Math.sin(time*1.3+index))*.4;}}>
    <mesh position={[0,.25,0]}><boxGeometry args={[.3,.35,.5]}/><meshStandardMaterial color={model==='duckling'?'#eec95c':'#fff1d2'}/></mesh>
    <mesh position={[0,.45,.25]}><icosahedronGeometry args={[.18,0]}/><meshStandardMaterial color="#fff1d2"/></mesh>
  </OptionalModel></group>;
}
export function Fence({x,z,rotation=0,length}:{x:number;z:number;rotation?:number;length:number}) {
  return <group position={[x,0,z]} rotation={[0,rotation,0]} scale={[length/2,1,1]}><OptionalModel batchStatic name="paddock_fence" size={1} authored hero={false}>
    {[-1,1].map(x=><mesh key={x} position={[x,.4,0]}><boxGeometry args={[.12,.8,.12]}/><meshStandardMaterial color="#fff1d2"/></mesh>)}
    {[.25,.6].map(y=><mesh key={y} position={[0,y,0]}><boxGeometry args={[2,.09,.08]}/><meshStandardMaterial color="#fff1d2"/></mesh>)}
  </OptionalModel></group>;
}
export function FarmDisplay(){return <group name="farm-store-paddock" position={[0,0,3.7]}>{[-1,1].map(side=><Fence key={`end${side}`} x={0} z={side*1.15} length={5.8}/>)}{[-1,1].map(side=><Fence key={`side${side}`} x={side*2.9} z={0} rotation={Math.PI/2} length={2.3}/>)}<Animal model="goat_kid" index={0} width={5} depth={1.6}/><Animal model="chicken" index={1} width={5} depth={1.6}/><Animal model="duckling" index={2} width={5} depth={1.6}/></group>;}
export function HousePaddock({person,style}:{person:Villager;style:HouseStyle}){
  const p=paddockLayout(style), animals=person.equipped.filter(i=>i.slot==='farm_animal').slice(0,6);
  return <group name={`paddock:${person.user_id}`} position={[p.center[0],0,p.center[1]]}>
    <mesh position={[0,.015,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[p.width,p.depth]}/><meshStandardMaterial color="#a8ba7b"/></mesh>
    {[-1,1].map(side=><Fence key={`end${side}`} x={0} z={side*p.depth/2} length={p.width}/>)}
    {[-1,1].flatMap(side=>Array.from({length:4},(_,i)=><Fence key={`${side}:${i}`} x={side*p.width/2} z={(i-1.5)*p.depth/4} rotation={Math.PI/2} length={p.depth/4}/>))}
    {animals.map((a,i)=><Animal key={a.item_id} model={a.asset_key??'chicken'} index={i} width={p.width} depth={p.depth}/>)}
  </group>;
}
