import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WHEEL_SPEED } from './playerControl';
import { townLive } from '../api/townLive';

// Authored here so cabin anchors have identical geometry with or without downloaded assets.
export function RideWheel() {
  const rotor=useRef<THREE.Group>(null), cabins=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    const angle=(townLive.live ? townLive.world.now() : clock.elapsedTime)*WHEEL_SPEED;
    if(rotor.current) rotor.current.rotation.z=angle;
    cabins.current?.children.forEach((c,i)=>{const a=angle+i*Math.PI/5;c.position.set(Math.sin(a)*4,4.9-Math.cos(a)*4,.9);});
  }, -1);
  return <group name="ride-wheel">
    {[-1,1].map(s=><mesh key={s} position={[s*1.2,2.4,-.3]} rotation={[0,0,s*.22]}><boxGeometry args={[.28,5,.35]}/><meshStandardMaterial color="#799d98"/></mesh>)}
    <group ref={rotor} position={[0,4.9,0]}><mesh><torusGeometry args={[4,.12,6,48]}/><meshStandardMaterial color="#f0c46e"/></mesh>
      {Array.from({length:10},(_,i)=><mesh key={i} rotation={[0,0,i*Math.PI/5]} position={[0,0,0]}><boxGeometry args={[.075,8,.075]}/><meshStandardMaterial color="#f6dfaf"/></mesh>)}
    </group>
    <group ref={cabins}>{Array.from({length:10},(_,i)=><group key={i} name={`ride-cabin:${i}`}>
      <mesh position={[0,-.15,0]}><boxGeometry args={[1.65,.25,1.15]}/><meshStandardMaterial color={i%2?'#dd9284':'#8cbbb4'}/></mesh>
      <mesh position={[0,.3,-.5]}><boxGeometry args={[1.65,.65,.12]}/><meshStandardMaterial color={i%2?'#dd9284':'#8cbbb4'}/></mesh>
      {[-.75,.75].map(x=><mesh key={x} position={[x,.55,0]}><boxGeometry args={[.07,1.4,1.1]}/><meshStandardMaterial color="#f5dca7"/></mesh>)}
    </group>)}</group>
  </group>;
}
