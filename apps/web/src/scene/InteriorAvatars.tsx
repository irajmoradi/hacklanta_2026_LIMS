import { useEffect, useRef } from 'react';
import { barks } from '../sound/VoiceBarks';
import { locateBark } from './barkSpatial';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group } from 'three';
import type { Villager } from '../api/types';
import { OptionalModel } from './OptionalModel';
import { door, stairs, type InteriorPeer, type InteriorPosition } from './interiorWalk';

function Avatar({id,name,person,position}: {id:string;name:string;person?:Villager;position:InteriorPosition}) {
  const entered=useRef(false), previous=useRef('');
  useEffect(()=>()=>barks.forget(id),[id]);
  const root=useRef<Group>(null), legs=useRef<Group>(null);
  const initial=useRef<[number,number,number]>([position.x,0,position.z]);
  useFrame((state,dt)=>{
    if(!root.current) return;
    locateBark(id,root.current,state.camera);
    if(!entered.current) {entered.current=true;void barks.trigger(id,'house');}
    const action=position.emote ?? (position.moving?'walk':'');
    if(action!==previous.current) {previous.current=action;if(action) void barks.trigger(id,action);}
    const alpha=1-Math.exp(-dt*16);
    root.current.position.x+=(position.x-root.current.position.x)*alpha;
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
    <Html center position={[0,1.95,0]} style={{pointerEvents:'none'}}><span className="interior-credit" data-testid={`interior-avatar-${id}`} data-x={position.x.toFixed(2)} data-z={position.z.toFixed(2)} data-floor={position.floor} data-moving={String(position.moving)}>{name}</span></Html>
  </group>;
}
export function InteriorAvatars({user,members,peers,position}: {user:string;members:Villager[];peers:Record<string,InteriorPeer>;position:InteriorPosition}) {
  return <>
    <Avatar key={`${user}:${position.floor}`} id={user} name={`${members.find(m=>m.user_id===user)?.display_name ?? 'You'} (you)`} person={members.find(m=>m.user_id===user)} position={position}/>
    {Object.entries(peers).filter(([id,p])=>id!==user && (p.floor??0)===position.floor).map(([id,p])=><Avatar key={`${id}:${p.floor}`} id={id} name={p.name} person={members.find(m=>m.user_id===id)} position={{...door,heading:0,moving:false,running:false,emote:null,...p,floor:p.floor??0}}/>)}
  </>;
}
export function InteriorStairs({floor,floors,onWalk}: {floor:number;floors:number;onWalk:(point:{x:number;z:number})=>void}) {
  return <>{stairs.filter(s=>floor+s.direction>=0 && floor+s.direction<floors).map(s=><group key={s.direction} position={[s.x,0,s.z]} onClick={e=>{e.stopPropagation();onWalk(s);}}>
    {[0,1,2,3].map(i=><mesh key={i} position={[0,.12+i*.12,-i*.2]}><boxGeometry args={[.8,.24+i*.24,.3]}/><meshStandardMaterial color="#937d64"/></mesh>)}
    <Html center position={[0,1.25,0]}><button className="interior-stairs" onClick={()=>onWalk(s)}>{s.direction===1?'Upstairs':'Downstairs'}</button></Html>
  </group>)}</>;
}
