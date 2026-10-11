import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TOWN_SCALE, type DropTarget, type PlayerState } from './playerControl';
export function DropHighlights({targets,player}:{targets:DropTarget[];player:PlayerState}) {
  const group=useRef<THREE.Group>(null);
  const [dragging,setDragging]=useState(false);
  useFrame(()=>{if(group.current)group.current.visible=player.dragging;if(dragging!==player.dragging)setDragging(player.dragging);});
  return <group ref={group} scale={TOWN_SCALE}>{targets.map(t=><group key={t.id} position={[t.center[0],.22,t.center[1]]}>
    <mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[5.5,6.1,48]}/><meshBasicMaterial color="#27a59a" transparent opacity={.8} depthWrite={false} toneMapped={false}/></mesh>
    {dragging && <Html position={[0,2,0]} center style={{pointerEvents:'none'}}><span className="scene-label" data-drop-target={t.id}>{t.label}</span></Html>}
  </group>)}</group>;
}
