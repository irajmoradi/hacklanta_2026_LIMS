import { InteriorFloor } from './HouseInteriorFloors';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group } from 'three';
import type { Villager } from '../api/types';
import { OptionalModel } from '../scene/OptionalModel';
import { door, positionHeight, type InteriorPeer, type InteriorPosition } from '../scene/interiorWalk';

function Avatar({id,name,person,position}: {id:string;name:string;person?:Villager;position:InteriorPosition}) {
  const root=useRef<Group>(null), legs=useRef<Group>(null);
  const initial=useRef<[number,number,number]>([position.x,position.y ?? 0,position.z]);
  useFrame((state,dt)=>{
    if(!root.current) return;
    const alpha=1-Math.exp(-dt*16);
    root.current.position.x+=(position.x-root.current.position.x)*alpha;
    root.current.position.y+=((position.y ?? 0)-root.current.position.y)*alpha;
    root.current.position.z+=(position.z-root.current.position.z)*alpha;
    root.current.rotation.y+=Math.atan2(Math.sin(position.heading-root.current.rotation.y),Math.cos(position.heading-root.current.rotation.y))*alpha;
    legs.current?.children.forEach((leg,i)=>{leg.rotation.x=position.moving?Math.sin(state.clock.elapsedTime*12+i*Math.PI)*.5:0;});
  });
  const colors=person?.avatar.body.colors;
  return <group ref={root} position={initial.current}>
    <OptionalModel name="villager_base" size={1.65} colors={colors} head={person?.avatar.body} equipment={person?.equipped} crown={person?.has_crown} animation={()=>position.moving?'walk':'idle'}>
      <mesh position={[0,1.35,0]}><sphereGeometry args={[.22,12,12]}/><meshStandardMaterial color={colors?.skin ?? '#d8b494'}/></mesh>
      <mesh position={[0,.9,0]}><boxGeometry args={[.45,.55,.28]}/><meshStandardMaterial color={colors?.shirt ?? '#718b80'}/></mesh>
      <group ref={legs}>{[-1,1].map(side=><group key={side} position={[side*.13,.65,0]}><mesh position={[0,-.28,0]}><boxGeometry args={[.17,.55,.2]}/><meshStandardMaterial color={colors?.pants ?? '#535e69'}/></mesh></group>)}</group>
    </OptionalModel>
    <Html center position={[0,1.95,0]} style={{pointerEvents:'none'}}><span className="interior-credit" data-testid={`interior-avatar-${id}`} data-x={position.x.toFixed(2)} data-z={position.z.toFixed(2)} data-floor={position.floor} data-y={(position.y ?? 0).toFixed(2)} data-moving={String(position.moving)}>{name}</span></Html>
  </group>;
}
export function InteriorAvatars({user,members,peers,position,floors}: {user:string;members:Villager[];peers:Record<string,InteriorPeer>;position:InteriorPosition;floors:number}) {
  return <>
    <Avatar key={user} id={user} name={`${members.find(m=>m.user_id===user)?.display_name ?? 'You'} (you)`} person={members.find(m=>m.user_id===user)} position={position}/>
    {Object.entries(peers).filter(([id])=>id!==user).map(([id,p])=><InteriorFloor key={id} level={p.floor??0} focus={position.floor} world><Avatar id={id} name={p.name} person={members.find(m=>m.user_id===id)} position={{...door,heading:0,moving:false,running:false,emote:null,...p,floor:p.floor??0,y:positionHeight(p,floors)}}/></InteriorFloor>)}
  </>;
}
