import {useEffect,useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {loadModel} from './OptionalModel';

/** Eight birds share geometry/material. Reuse matrices; never cast shadows. */
export function Pigeons() {
  const [reduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const root=useRef<THREE.Group>(null), flock=useRef<THREE.InstancedMesh>(null), wings=useRef<THREE.InstancedMesh>(null);
  const [asset,setAsset]=useState<THREE.BufferGeometry|null>(null);
  const fallback=useMemo(()=>new THREE.SphereGeometry(.24,6,4).scale(.8,1,1.4).translate(0,.24,0),[]);
  const wingGeometry=useMemo(()=>new THREE.IcosahedronGeometry(1,0).scale(.17,.045,.23),[]);
  const state=useMemo(()=>({matrix:new THREE.Matrix4(), wing:new THREE.Object3D(), dummy:new THREE.Object3D(), world:new THREE.Vector3(), local:new THREE.Vector3(), until:new Float64Array(8), visitors:[] as THREE.Object3D[], scan:0}),[]);
  useEffect(()=>{let active=true;let owned:THREE.BufferGeometry|undefined;
    void loadModel('pigeon').then(model=>{if(!model||!active)return;model.updateMatrixWorld(true);const pieces:THREE.BufferGeometry[]=[];
      model.traverse(n=>{if(!(n instanceof THREE.Mesh)||n.name.startsWith('wing_flutter'))return;const g=n.geometry.clone().applyMatrix4(n.matrixWorld).toNonIndexed();const m=Array.isArray(n.material)?n.material[0]:n.material;const c=m instanceof THREE.MeshStandardMaterial?m.color:new THREE.Color('#8796a4');const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3)c.toArray(colors,i);g.setAttribute('color',new THREE.BufferAttribute(colors,3));for(const key of Object.keys(g.attributes))if(!['position','normal','color'].includes(key))g.deleteAttribute(key);pieces.push(g);});
      owned=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());setAsset(owned);
    });return()=>{active=false;owned?.dispose();};},[]);
  useEffect(()=>()=>{fallback.dispose();wingGeometry.dispose();},[fallback,wingGeometry]);
  useFrame(({clock,scene})=>{if(!root.current||!flock.current)return;const t=clock.elapsedTime;
    if(t>state.scan){state.visitors=[];scene.traverse(n=>{if(n.name.startsWith('villager:'))state.visitors.push(n);});state.scan=t+2;}
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4+(reduced?0:Math.sin(t*.18+i)*.22), radius=3.7+(i%3)*.55;
      let x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      for(const visitor of state.visitors){visitor.getWorldPosition(state.world);state.local.copy(state.world);root.current.worldToLocal(state.local);if(Math.hypot(state.local.x-x,state.local.z-z)<1.8)state.until[i]=t+2;}
      const flight=reduced?0:Math.min(1,Math.max(0,state.until[i]-t));
      x+=Math.cos(angle)*flight*1.1;z+=Math.sin(angle)*flight*1.1;
      state.dummy.position.set(x,.04+flight*(.4+Math.abs(Math.sin(t*9+i))*.2),z);
      state.dummy.rotation.set(flight?-.2:Math.max(0,Math.sin((reduced?0:t)*2+i))*.3,-angle,flight*Math.sin(t*20+i)*.25);
      state.dummy.scale.set(.8,.8,.8);state.dummy.updateMatrix();flock.current.setMatrixAt(i,state.dummy.matrix);
      for(let side=0;side<2;side++){const sign=side?1:-1;state.wing.position.set(sign*.23,.35,0);state.wing.rotation.z=sign*(flight?Math.sin(t*22+i)*.9:1.1);state.wing.updateMatrix();state.matrix.multiplyMatrices(state.dummy.matrix,state.wing.matrix);wings.current?.setMatrixAt(i*2+side,state.matrix);}
    }flock.current.instanceMatrix.needsUpdate=true;flock.current.computeBoundingSphere();if(wings.current){wings.current.instanceMatrix.needsUpdate=true;wings.current.computeBoundingSphere();}
  });
  return <group ref={root} name="fountain-pigeons"><instancedMesh name="pigeon-bodies" ref={flock} args={[asset??fallback,undefined,8]}><meshStandardMaterial vertexColors={!!asset} color={asset?'white':'#8796a4'} roughness={.9}/></instancedMesh><instancedMesh name="pigeon-wings" ref={wings} args={[wingGeometry,undefined,16]}><meshStandardMaterial color="#8796a4" roughness={.9}/></instancedMesh></group>;
}
