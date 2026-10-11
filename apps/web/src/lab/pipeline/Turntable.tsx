import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, OrbitControls, useGLTF } from '@react-three/drei';
import { Group, Mesh, MeshNormalMaterial, MeshStandardMaterial } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { SAMPLE_COLORS } from './runtimeMedia';
export const COLORS = SAMPLE_COLORS;
class PreviewBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="status">3D preview unavailable. The cached artifact can still be explored in the other steps.</p> : this.props.children; }
}
function Model({ avatar, wireframe, normals, colors }: { colors: typeof COLORS; avatar: boolean; wireframe: boolean; normals: boolean }) {
  const { scene } = useGLTF(avatar ? '/models/villager_base.glb' : '/lab/mug.glb');
  const group = useRef<Group>(null);
  const model = useMemo(() => {
    const next = clone(scene);
    next.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const materials = (Array.isArray(node.material) ? node.material : [node.material]).map(original => {
        if (normals) return new MeshNormalMaterial({ wireframe });
        const material = original.clone() as MeshStandardMaterial;
        material.wireframe = wireframe;
        if (avatar) for (const [part, color] of Object.entries(colors)) if (material.name.toLowerCase().includes(part)) material.color?.set(color);
        return material;
      });
      node.material = Array.isArray(node.material) ? materials : materials[0];
    });
    return next;
  }, [scene, avatar, wireframe, normals, colors]);
  useEffect(() => () => model.traverse(node => { if (node instanceof Mesh) (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose()); }), [model]);
  useFrame((_, dt) => { if (group.current && !matchMedia('(prefers-reduced-motion: reduce)').matches) group.current.rotation.y += dt * .3; });
  return <group ref={group}><Center><primitive object={model} scale={avatar ? 1 : 3} /></Center></group>;
}
export function Turntable({ avatar = false, wireframe = false, normals = false, village = false, colors = COLORS }: { colors?: typeof COLORS; avatar?: boolean; wireframe?: boolean; normals?: boolean; village?: boolean }) {
  return <div className="lab-turntable" aria-label={avatar ? 'Tinted villager turntable' : 'Cached Hunyuan3D mug turntable'}><PreviewBoundary><Canvas camera={{position: [2, 1.5, 3.5], fov: 38}}><color attach="background" args={[village ? '#dce9c7' : '#e9e7dc']} /><ambientLight intensity={2} /><directionalLight position={[3, 5, 4]} intensity={3} /><Suspense fallback={null}><Model colors={colors} avatar={avatar} wireframe={wireframe} normals={normals} /></Suspense>{village && <mesh position={[0, -.9, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[3, 48]} /><meshStandardMaterial color="#93af72" /></mesh>}<OrbitControls enablePan={false} minDistance={2} maxDistance={7} /></Canvas></PreviewBoundary></div>;
}
