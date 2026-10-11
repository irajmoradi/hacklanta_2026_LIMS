import { useLocationClick, type LocationSpot } from './locationCloseup';
import { MayorSpeaking } from './CinematicContext';
import { useContext, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Html } from '@react-three/drei';
import { OptionalModel } from './OptionalModel';

function Stone({size}: {size: [number,number,number]}) {
  return <mesh position={[0,size[1]/2,0]}><boxGeometry args={size}/><meshStandardMaterial color="#c6c5ac"/></mesh>;
}
/** Preserve asset origins and relative scale: ASSET-005 assembly, on paving. */
export function MayorPlaza({onMayor,onGazette,spot}: {spot?:LocationSpot;onMayor:()=>void;onGazette:()=>void}) {
  const locationClick=useLocationClick();
  const activate=(single:()=>void,keyboard=false,double=false)=>spot?locationClick(spot,single,keyboard,double):single();
  const speaking = useContext(MayorSpeaking);
  const statue = useRef<Group>(null);
  useFrame(({clock}) => {
    if (!statue.current) return;
    const animate = speaking && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    statue.current.position.y = animate ? (1 - Math.cos(clock.elapsedTime * 2 * Math.PI / 1.8)) * .04 : 0;
    statue.current.rotation.x = animate ? Math.sin(clock.elapsedTime*2)*.06 : 0;
  }, -1); // Update before TownCamera follows the statue in the same frame.
  return <group name="mayors-plaza">
    <group name="mayor_podium" onClick={e=>{e.stopPropagation();activate(onMayor,false,e.nativeEvent.detail>=2);}}>
      <OptionalModel batchStatic name="mayor_podium" size={1} authored><Stone size={[4,.5,3]}/></OptionalModel>
      <Html position={[0,4.8,0]} center zIndexRange={[5,0]}><button className="scene-label" onClick={e=>{e.stopPropagation();activate(onMayor,e.detail===0,e.detail>=2);}} aria-label="Mayor’s Plaza announcements">Mayor’s Plaza</button></Html>
    </group>
    <group ref={statue} name="mayor_statue" position={[-2.7,0,3.1]}><OptionalModel animate={(model,time) => {
      const tip = speaking && !matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.max(0, Math.sin(time*2))*.18 : 0;
      for (const name of ['hat_band','hat_brim','top_hat']) {
        const hat = model.getObjectByName(name); if (!hat) continue;
        if (hat.userData.restY === undefined) { hat.userData.restY = hat.position.y; hat.userData.restX = hat.rotation.x; }
        hat.position.y = hat.userData.restY + tip; hat.rotation.x = hat.userData.restX - tip;
      }
    }} name="mayor_statue" size={1} authored><Stone size={[.8,1.8,.8]}/></OptionalModel></group>
    <group name="notice_board" position={[2.75,0,2.7]} onClick={e=>{e.stopPropagation();activate(onGazette,false,e.nativeEvent.detail>=2);}}>
      <OptionalModel batchStatic name="notice_board" size={1} authored><Stone size={[1.5,1.6,.15]}/></OptionalModel>
      <Html position={[0,2.3,0]} center zIndexRange={[5,0]}><button className="scene-label" onClick={e=>{e.stopPropagation();activate(onGazette,e.detail===0,e.detail>=2);}} aria-label="Read the Gazette at the plaza notice board">Gazette</button></Html>
    </group>
  </group>;
}
