import { lazy, Suspense, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocationClick } from './locationCloseup';
import { BENCH_SEATS } from './layout/benchSeats';
import { CafePatio } from './CafePatio';
import { AmbientEmitter } from './SceneAmbience';
import { RideWheel } from './RideWheel';
import { useFrame } from '@react-three/fiber';
import { prefetchWhenIdle } from '../components/lazyPanel';
const loadDisasters = () => import('./DisasterEffects').then(m => ({default:m.DisasterEffects}));
const DisasterEffects = lazy(loadDisasters);
import { FitnessCorner } from './FitnessCorner';
import { StudyNook } from './StudyNook';
import * as THREE from 'three';
import { MayorPlaza } from './MayorPlaza';
import { TreeKind } from './InstancedTrees';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Html } from '@react-three/drei';
import { loadModel, OptionalModel } from './OptionalModel';
import { available, modelName, roleEntry, type Entry } from './registry';
import { type Town } from './layout/town';
import { TownSurfaces } from './TownSurfaces';
import { townDecor, type Decor } from './layout/variety';
import { staticModel } from './staticModel';
import type { WorldState } from './worldTypes';
import { Wheel, Fountain, Glow } from './TownDistricts';
import { ShelterPets } from './ShelterPets';
import {FarmDisplay} from './FarmAnimals';
import {Pigeons} from './Pigeons';
type Point = [number,number,number];
type Instance = {p: Point; scale: Point; rotation?: number; shade?: string};
type Part = {geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4};
function PartBatch({part,instances}:{part:Part;instances:Instance[]}) {
  const ref=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),scale=new THREE.Vector3();
    const up=new THREE.Vector3(0,1,0),color=new THREE.Color();
    instances.forEach((v,i)=>{
      m.compose(p.fromArray(v.p),q.setFromAxisAngle(up,v.rotation??0),scale.fromArray(v.scale));
      ref.current!.setMatrixAt(i,m.multiply(part.matrix));
      ref.current!.setColorAt(i,color.set(v.shade??'#ffffff'));
    });
    ref.current!.instanceMatrix.needsUpdate=true;
    if(ref.current!.instanceColor)ref.current!.instanceColor.needsUpdate=true;
    ref.current!.computeBoundingSphere();
  },[part,instances]);
  return <instancedMesh ref={ref} args={[part.geometry,part.material,instances.length]} receiveShadow dispose={null}/>;
}
function KitBatch({entry,instances,night,blackout=false,blight=false}:{entry:Entry;instances:Instance[];night:boolean;blackout?:boolean;blight?:boolean}) {
  const [parts,setParts]=useState<Part[]|null>(null);
  const role=entry.placement?.role;
  const blackoutStart=useRef(0);
  useEffect(()=>{blackoutStart.current=performance.now();},[blackout]);
  useFrame(({clock}) => { if(role==='streetlight') for(const part of parts??[fallback]) for(const material of Array.isArray(part.material)?part.material:[part.material]) if(material instanceof THREE.MeshStandardMaterial && (material.name==='light'||part===fallback)) material.emissiveIntensity=blackout?(!matchMedia('(prefers-reduced-motion: reduce)').matches && performance.now()-blackoutStart.current<700 ? .25*(1+Math.sin(clock.elapsedTime*12)) : 0):night?2:0; });
  const fallback=useMemo(()=>{const material=new THREE.MeshStandardMaterial({color:blight?'#c3ad81':entry.placement?.color??'#c1b79d',emissive:role==='streetlight'?'#ffe4a4':'#000000',emissiveIntensity:night?.65:0});return {geometry:role==='crosswalk'?mergeGeometries(Array.from({length:4},(_,i)=>new THREE.BoxGeometry(.13,1,1).translate((i-1.5)*.24,0,0))):new THREE.BoxGeometry(1,1,1),material,matrix:new THREE.Matrix4()};},[entry,night,role,blight]);
  useEffect(()=>()=>{fallback.geometry.dispose();fallback.material.dispose();},[fallback]);
  useEffect(() => {
    let active = true, loaded = false;
    const owned: THREE.Material[] = [];
    const attempt = () => {
      if (loaded) return;
      void loadModel(modelName(entry)).then(source => {
        if (!source || !active) return;
        source = staticModel(source);
        loaded = true;
        source.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(source), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        const normalize = new THREE.Matrix4().makeScale(1/Math.max(size.x,.001),1/Math.max(size.y,.001),1/Math.max(size.z,.001))
          .multiply(new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z));
        const light = (material: THREE.Material) => {
          if(blight && material instanceof THREE.MeshStandardMaterial) {const copy=material.clone();copy.color.set('#c3ad81');owned.push(copy);return copy;}
          if (role !== 'streetlight' || !(material instanceof THREE.MeshStandardMaterial) || material.name !== 'light') return material;
          const copy = material.clone();
          copy.emissive.set('#ffd58b'); copy.emissiveIntensity = night ? 2 : 0;
          owned.push(copy); return copy;
        };
        const next: Part[] = [];
        source.traverse(n => {
          if (n instanceof THREE.Mesh) next.push({geometry:n.geometry, material:Array.isArray(n.material)?n.material.map(light):light(n.material), matrix:normalize.clone().multiply(n.matrixWorld)});
        });
        setParts(next);
      });
    };
    attempt();
    const timer = setInterval(attempt,35000);
    return () => { active=false; clearInterval(timer); owned.forEach(m=>m.dispose()); };
  }, [entry, night, role, blight]);
  return <>{(parts??[fallback]).map((p,i)=><PartBatch key={i} part={p} instances={instances}/>)}</>;
}
// Static fallback geometry is merged per lot, sharing one material and one draw call.
export function BuildingFallback({entry,locked=false}:{entry:Entry;locked?:boolean}) {
  const geometry=useMemo(()=>{
    const size=entry.placement?.size??5, color=new THREE.Color(locked?'#bfa879':entry.placement?.color??'#dabd91');
    const boxes: [Point,Point,string?][] = locked ? [[[0,.15,0],[7,.3,7]],[[0,1,2.8],[6,.2,.2]]] : entry.placement?.shape==='stage' ? [[[0,.4,2.2],[9,.8,6],'#ac8264'],[[0,2,-1],[9,.25,.2],'#efd396'],[[-4.3,1,-.5],[.6,2,.7],'#53686b'],[[4.3,1,-.5],[.6,2,.7],'#53686b']] : [[[0,size*.27,0],[size,size*.54,size*.7]],[[0,size*.57,0],[size*1.08,size*.1,size*.78],'#79958b'],[[0,size*.2,size*.36],[size*.2,size*.4,.12],'#846a54'],[[-size*.3,size*.3,size*.36],[size*.22,size*.2,.14],'#b1d2ce'],[[size*.3,size*.3,size*.36],[size*.22,size*.2,.14],'#b1d2ce']];
    const pieces=boxes.map(([p,s,c])=>{const g=new THREE.BoxGeometry(...s).translate(...p);const shade=c?new THREE.Color(c):color;const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3)shade.toArray(colors,i);g.setAttribute('color',new THREE.BufferAttribute(colors,3));return g;});const merged=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());return merged;
  },[entry,locked]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} receiveShadow castShadow><meshStandardMaterial vertexColors roughness={.85}/></mesh>;
}
/** A short rebuild reveal retains the same asset and adds no draw calls. */
function RepairReveal({closed,children}:{closed:boolean;children:import('react').ReactNode}) {
  const ref=useRef<THREE.Group>(null),wasClosed=useRef(closed),start=useRef(-Infinity);
  useEffect(()=>{if(wasClosed.current&&!closed)start.current=performance.now();wasClosed.current=closed;},[closed]);
  useFrame(()=>{if(ref.current){const t=matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min(1,(performance.now()-start.current)/750);ref.current.scale.y=.75+.25*t;}});
  return <group ref={ref}>{children}</group>;
}
export const GridTown = memo(function GridTown({town,world,night,reduced,onMayor,onGazette,onShop,onReading,inspected,onInspect,petCount=0}:{petCount?:number;inspected:string|null;onInspect:(id:string|null)=>void;town:Town;world:WorldState;night:boolean;reduced:boolean;onMayor:()=>void;onGazette:()=>void;onReading:()=>void;onShop:(section?:'farm')=>void}) {
  const locationClick = useLocationClick();
  const island = useMemo(() => {
    const w=town.width/2, d=town.depth/2, r=10, shape=new THREE.Shape();
    shape.moveTo(-w+r,-d); shape.lineTo(w-r,-d); shape.quadraticCurveTo(w,-d,w,-d+r);
    shape.lineTo(w,d-r); shape.quadraticCurveTo(w,d,w-r,d); shape.lineTo(-w+r,d);
    shape.quadraticCurveTo(-w,d,-w,d-r); shape.lineTo(-w,-d+r); shape.quadraticCurveTo(-w,-d,-w+r,-d);
    const g=new THREE.ExtrudeGeometry(shape,{depth:1.4,bevelEnabled:true,bevelSize:.6,bevelThickness:.35,bevelSegments:3,steps:1,curveSegments:10});
    g.rotateX(-Math.PI/2); return g;
  }, [town.width, town.depth]);
  useEffect(() => () => island.dispose(), [island]);
  const batches=useMemo(()=>{
    const out=new Map<Decor['role'],Decor[]>();
    for(const d of townDecor(town)){if(!out.has(d.role))out.set(d.role,[]);out.get(d.role)!.push(d);}
    return [...out];
  },[town]);
  const detailPart=useMemo(()=>({geometry:new THREE.BoxGeometry(1,1,1),material:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9}),matrix:new THREE.Matrix4()}),[]);
  useEffect(()=>()=>{detailPart.geometry.dispose();detailPart.material.dispose();},[detailPart]);
  const centerZ=(town.roadsZ[0]+town.roadsZ.at(-1)!)/2;
  return <group name="grid-town">
    <DeferredDisasters disaster={world.disaster} town={town} reduced={reduced} petCount={petCount}/>
    <mesh geometry={island} position={[0,-1.8,centerZ]} receiveShadow><meshStandardMaterial color="#b8c79a" roughness={1}/></mesh>
    <TownSurfaces town={town}/>
    {batches.map(([role,instances])=>role.startsWith('tree_')
      ? <TreeKind key={role} name={role} fitBounds foregroundScale={1} trees={instances.map(v=>({x:v.p[0],z:v.p[2],scale:1,stretch:v.scale,rotation:v.rotation,lean:v.lean,shade:v.shade}))}/>
      : role==='detail'?<PartBatch key={role} part={detailPart} instances={instances}/>
      : <KitBatch key={role} entry={roleEntry(role)} instances={instances} night={night} blackout={world.disaster?.kind==='blackout'} blight={world.disaster?.kind==='blight' && role==='hedge'}/>)}
    {town.lots.filter(l=>l.entry).map(lot=>{const entry=lot.entry!, unlocked=available(entry,world),shape=entry.placement?.shape;const closed=world.disaster?.closed_building===entry.id;const action=entry.placement?.action;const size=Math.max(7,Math.min(11,(entry.placement?.size??5)*1.8));return <group key={lot.id} name={`${unlocked?'unlocked':'construction'}:${entry.id}`} position={[lot.center[0],.1,lot.center[1]]} onPointerOver={e=>{e.stopPropagation();onInspect(lot.id);}} onPointerOut={()=>onInspect(null)} onClick={e=>{e.stopPropagation();locationClick({id:lot.id,name:entry.name??entry.id.replaceAll('_',' '),center:lot.center},()=>{onInspect(lot.id);if(entry.id==='library'&&unlocked&&!closed){onReading();return;}if(entry.id==='town_hall'&&unlocked&&!closed){window.dispatchEvent(new Event('village-open-hall'));}else if(action&&unlocked&&!closed){if(action==='mayor')onMayor();else onShop(entry.id==='farm_store'?'farm':undefined);}},false,e.nativeEvent.detail>=2);}}>
      {shape==='plaza' && <mesh rotation={[-Math.PI/2,0,0]} position={[0,.005,0]}><planeGeometry args={[14,14]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false}/></mesh>}
      {unlocked && !closed && world.disaster?.kind!=='outbreak' && entry.id === 'pet_shelter' && <ShelterPets/>}
      {unlocked && !closed && entry.id === 'storefront_cafe' && <CafePatio night={night}/> }
      {unlocked && entry.id === 'farm_store' && <FarmDisplay/>}
      {unlocked && shape === 'fountain' && <><Pigeons/>{BENCH_SEATS.map((seat,i)=><group key={i} position={[seat.offset[0],0,seat.offset[1]]} rotation={[0,seat.yaw,0]} name={`reading-bench:${i}`}><mesh position={[0,.85,0]}><boxGeometry args={[1.5,.12,.65]}/><meshStandardMaterial color="#a47b59"/></mesh><mesh position={[0,1.2,-.3]}><boxGeometry args={[1.5,.65,.1]}/><meshStandardMaterial color="#8eaa91"/></mesh>{[-.6,.6].map(x=><mesh key={x} position={[x,.4,0]}><boxGeometry args={[.1,.8,.5]}/><meshStandardMaterial color="#a47b59"/></mesh>)}</group>)}</>}
      {unlocked && !closed && (shape==='fountain' || shape==='lake' || action==='shop') && <AmbientEmitter id={`lot:${lot.id}`} name={shape==='fountain'?'fountain_trickle':shape==='lake'?'creek_babble':'market_bustle_light'}/>}
      {unlocked && shape === 'wheel' ? <RideWheel/> : unlocked && entry.id === 'fitness_corner' ? <FitnessCorner/> : unlocked && entry.id === 'study_nook' ? <StudyNook night={night}/> : unlocked && shape==='plaza' ? <MayorPlaza spot={{id:lot.id,name:entry.name??'Mayor Plaza',center:lot.center}} onMayor={onMayor} onGazette={onGazette}/> : unlocked?<group position={entry.id === 'festival_lights' ? [0,3.1,0] : entry.id === 'storefront_cafe' ? [0,0,-1.5] : ['pet_shelter','farm_store'].includes(entry.id) ? [0,0,-1.8] : [0,0,0]}><RepairReveal closed={closed}><OptionalModel charred={closed} batchStatic={shape!=='wheel'} name={modelName(entry)} size={entry.id === 'storefront_cafe' ? 7 : ['pet_shelter','farm_store'].includes(entry.id) ? 6 : size} hero animate={shape==='wheel'?(model,time)=>{const wheel=model.getObjectByName('wheel');if(wheel)wheel.rotation.z=time*.12;}:undefined}>
        {shape==='wheel'?<Wheel/>:shape==='fountain'?<Fountain/>:shape==='lake'?<mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[8,8]}/><meshStandardMaterial color="#78b6c2" roughness={.2}/></mesh>:<BuildingFallback entry={{...entry,placement:{...entry.placement,size:entry.id === 'storefront_cafe' ? 5 : size,color:closed?'#77616a':entry.placement?.color}}}/>}
      </OptionalModel></RepairReveal></group>:null}
      {unlocked && entry.id === 'festival_lights' && [-1,1].map(side=><mesh key={side} name="festival-light-pole" position={[side*size/2,1.6,0]}><cylinderGeometry args={[.07,.09,3.2,8]}/><meshStandardMaterial color="#4f5555"/></mesh>)}
      {shape==='stage'&&<Glow night={night} reduced={reduced}/>}
      {entry.id === 'town_hall' && <Html position={[0,5.8,3]} center zIndexRange={[5,0]}><button className="scene-label" onClick={e=>{e.stopPropagation();locationClick({id:lot.id,name:entry.name??'Community Hall',center:lot.center},()=>window.dispatchEvent(new Event('village-open-hall')),e.detail===0,e.detail>=2);}}>Enter Community Hall</button></Html>}
      {inspected === lot.id && <Html position={[0,size*.7+1,0]} center zIndexRange={[5,0]}><button className="scene-label" data-testid="building-label" onClick={e=>{e.stopPropagation();locationClick({id:lot.id,name:entry.name??entry.id.replaceAll('_',' '),center:lot.center},()=>{if(entry.id==='library'&&unlocked&&!closed){onReading();return;}if(entry.id==='town_hall'&&unlocked&&!closed){window.dispatchEvent(new Event('village-open-hall'));return;}if(action&&unlocked&&!closed){if(action==='mayor')onMayor();else onShop(entry.id==='farm_store'?'farm':undefined);}},e.detail===0,e.detail>=2);}}>{entry.name??entry.id.replaceAll('_',' ')}{closed?' - Closed for repairs':!unlocked?' - Coming soon':''}</button></Html>}
    </group>;})}

  </group>;
});

function DeferredDisasters(props: import('react').ComponentProps<typeof DisasterEffects>) {
  useEffect(() => prefetchWhenIdle(loadDisasters), []);
  const activated = useRef(false);
  if (props.disaster) activated.current = true;
  // Keep the effect mounted after repair so its celebration and cleanup can finish.
  return activated.current ? <Suspense fallback={null}><DisasterEffects {...props}/></Suspense> : null;
}
