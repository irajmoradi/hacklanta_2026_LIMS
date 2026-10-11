import { useEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, Mesh, MeshStandardMaterial } from 'three';
import type { PlayerState } from './playerControl';

/** Walking focus: a ground ring under the controlled villager; the body itself is never tinted. */
export function WalkingFocus({body, player, disabled}: {body: RefObject<Group>; player: PlayerState; disabled?: boolean}) {
  const ring = useRef<Group>(null);
  const originals = useRef(new Map<MeshStandardMaterial, {color: Color; intensity: number}>());
  const elapsed = useRef(1);
  const restore = () => {
    for (const [material, original] of originals.current) {
      material.emissive.copy(original.color); material.emissiveIntensity = original.intensity;
    }
    originals.current.clear();
  };
  useEffect(() => restore, []);
  useFrame((_, dt) => {
    const active = player.active && !disabled && !player.dragging && !player.ride;
    if (ring.current) ring.current.visible = !!active;
    if (!active) { restore(); return; }
    elapsed.current += dt;
    if (elapsed.current < .1) return;
    elapsed.current = 0;
    ring.current?.children.forEach((node, index) => {
      if (node instanceof Mesh) node.material.opacity = player.moving ? (index ? .95 : .85) : .24;
    });
    // R-149: highlight is the ground ring only; tinting body materials discolored the villager (and shared materials).
  });
  return <group ref={ring} name="walking-highlight" visible={false}>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.022,0]}>
      <ringGeometry args={[.48,.65,48]}/><meshBasicMaterial color="#263d32" transparent opacity={.85} depthWrite={false}/>
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.025,0]}>
      <ringGeometry args={[.51,.61,48]}/><meshBasicMaterial color="#d0f5ac" toneMapped={false} transparent opacity={.95} depthWrite={false}/>
    </mesh>
  </group>;
}
