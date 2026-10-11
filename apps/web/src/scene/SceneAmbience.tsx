import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { sound } from '../sound/engine';

/** Lives inside the object's group, so layout and parent scale remain authoritative. */
export function AmbientEmitter({id,name}:{id:string;name:string}) {
  const ref=useRef<Group>(null), position=useMemo(()=>new Vector3(),[]);
  useEffect(()=>()=>sound.ambience.removeEmitter(id),[id]);
  useFrame(()=>{if(ref.current){ref.current.getWorldPosition(position);sound.ambience.setEmitter(id,name,[position.x,position.y,position.z]);}});
  return <group ref={ref}/>;
}
