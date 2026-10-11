import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, Group, InstancedMesh, Matrix4, Mesh, type Material } from 'three';
import { FLOOR_HEIGHT, stairLabel, stairOpening } from '../scene/interiorWalk';

// Each floor owns its material copies, including asynchronously loaded furniture.
export function InteriorFloor({level,focus,children,world=false}:{level:number;focus:number;children:ReactNode;world?:boolean}) {
  const root=useRef<Group>(null);
  const copies=useRef(new Set<Material>());
  useEffect(()=>()=>{copies.current.forEach(m=>m.dispose());copies.current.clear();},[]);
  const originals=useRef(new WeakMap<Mesh,{materials:Material[];opacity:number[];transparent:boolean[];depthWrite:boolean[];raycast:Mesh['raycast']}>());
  useFrame(()=>root.current?.traverse(object=>{
    if(!(object instanceof Mesh)) return;
    let saved=originals.current.get(object);
    if(!saved) {
      const materials=(Array.isArray(object.material)?object.material:[object.material]).map(m=>m.clone());
      materials.forEach(m=>copies.current.add(m));
      saved={materials,opacity:materials.map(m=>m.opacity),transparent:materials.map(m=>m.transparent),depthWrite:materials.map(m=>m.depthWrite),raycast:object.raycast};
      object.material=Array.isArray(object.material)?materials:materials[0];originals.current.set(object,saved);
    }
    const ghost=level>focus;
    saved.materials.forEach((m,i)=>{m.opacity=saved.opacity[i]*(ghost?.25:1);m.transparent=ghost||saved.transparent[i];m.depthWrite=ghost?false:saved.depthWrite[i];});
    object.raycast=level===focus?saved.raycast:()=>{};
  }));
  return <group ref={root} position={[0,world?0:level*FLOOR_HEIGHT,0]}>{children}</group>;
}
export function InteriorSlab({level,color,onWalk}:{level:number;color:string;onWalk:(p:{x:number;z:number})=>void}) {
  const {minX,maxX,minZ,maxZ}=stairOpening;
  const pieces=level===0 ? [[0,0,8,8]] : [
    [0,(-4+minZ)/2,8,minZ+4], [0,(maxZ+4)/2,8,4-maxZ],
    [(-4+minX)/2,(minZ+maxZ)/2,minX+4,maxZ-minZ],
    [(maxX+4)/2,(minZ+maxZ)/2,4-maxX,maxZ-minZ],
  ];
  return <>{pieces.map(([x,z,w,d],i)=><mesh key={i} receiveShadow position={[x,-.1,z]} onClick={e=>{e.stopPropagation();onWalk({x:e.point.x,z:e.point.z});}}>
    <boxGeometry args={[w,.2,d]}/><meshStandardMaterial color={color} roughness={.85}/>
  </mesh>)}</>;
}
export function InteriorStaircase({lower,focus,onWalk}:{lower:number;focus:number;onWalk:(p:{x:number;z:number})=>void}) {
  const active=focus===lower || focus===lower+1, ghost=lower>focus;
  const treads=useRef<InstancedMesh>(null);
  useFrame(()=>{if(treads.current) treads.current.raycast=active?InstancedMesh.prototype.raycast:()=>{};});
  useLayoutEffect(()=>{
    for(let i=0;i<24;i++) {
      treads.current!.setMatrixAt(i,new Matrix4().makeTranslation(3-(i+.5)*6/24,(i+1)*FLOOR_HEIGHT/24-.08,0));
      treads.current!.setColorAt(i,new Color(i%2?'#aa8b69':'#937454'));
    }
    treads.current!.instanceMatrix.needsUpdate=true;
    treads.current!.instanceColor!.needsUpdate=true;
  },[]);
  return <group position={[0,lower*FLOOR_HEIGHT,3]}>
    <instancedMesh ref={treads} args={[undefined,undefined,24]} onClick={e=>{if(active){e.stopPropagation();onWalk({x:focus===lower?3:-3,z:3});}}}>
      <boxGeometry args={[.26,.16,.94]}/><meshStandardMaterial transparent={ghost} opacity={ghost?.25:1}/>
    </instancedMesh>
    {/* Two stringers make this one continuous flight, open beneath the treads. */}
    {[-.43,.43].map(z=><mesh key={z} position={[0,FLOOR_HEIGHT/2-.2,z]} rotation={[0,0,-Math.atan2(FLOOR_HEIGHT,6)]}>
      <boxGeometry args={[Math.hypot(6,FLOOR_HEIGHT),.16,.1]}/><meshStandardMaterial color="#70593f" transparent={ghost} opacity={ghost?.25:1}/>
    </mesh>)}
    {active && <Html center position={[focus===lower?3:-3,focus===lower?.45:FLOOR_HEIGHT+.45,0]}>
      <button className="interior-stairs" onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onWalk({x:focus===lower?3:-3,z:3});}}>{stairLabel(focus===lower?1:-1)}</button>
    </Html>}
  </group>;
}
