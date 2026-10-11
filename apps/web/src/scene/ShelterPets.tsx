import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { OptionalModel } from './OptionalModel';

function Pet({ index }: { index: number }) {
  const ref = useRef<Group>(null);
  useFrame(({clock}) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * .28 + index * Math.PI / 2;
    // Slow loops with pauses; the full footprint remains inside the front yard.
    const phase = t - .7 * Math.sin(t);
    ref.current.position.set(Math.cos(phase) * (1.2 + index * .3), .12 + Math.abs(Math.sin(t * 5)) * .035, 3.8 + Math.sin(phase) * .65);
    ref.current.rotation.y = Math.atan2(-Math.sin(phase), Math.cos(phase) * .5);
  });
  return <group ref={ref} name={`shelter-pet:${index}`}>
    <OptionalModel batchStatic name={index % 2 ? 'pet_dog_b' : 'pet_dog'} size={.85}>
      <mesh position={[0,.3,0]}><boxGeometry args={[.35,.38,.6]}/><meshStandardMaterial color={index % 2 ? '#e7d9b7' : '#a47850'}/></mesh>
      <mesh position={[0,.5,.3]}><sphereGeometry args={[.23,8,6]}/><meshStandardMaterial color="#c29a69"/></mesh>
    </OptionalModel>
  </group>;
}

export function ShelterPets() {
  return <group name="shelter-yard">
    <mesh position={[0,.05,3.8]}><boxGeometry args={[8,.08,3.5]}/><meshStandardMaterial color="#a8bb85"/></mesh>
    {[-4,4].map(x => <mesh key={x} position={[x,.5,3.8]}><boxGeometry args={[.12,.8,3.5]}/><meshStandardMaterial color="#e3ce9d"/></mesh>)}
    {[2.05,5.55].flatMap(z => [.35,.75].map(y => <mesh key={`${z}:${y}`} position={[0,y,z]}><boxGeometry args={[8,.12,.12]}/><meshStandardMaterial color="#e3ce9d"/></mesh>))}
    {Array.from({length:9},(_,i) => <mesh key={i} position={[-4+i,.5,5.55]}><boxGeometry args={[.1,1,.12]}/><meshStandardMaterial color="#e3ce9d"/></mesh>)}
    {[0,1,2,3].map(index => <Pet key={index} index={index}/>)}
  </group>;
}
