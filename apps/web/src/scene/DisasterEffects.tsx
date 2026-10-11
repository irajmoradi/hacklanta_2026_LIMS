import { VillageIcon } from '../components/VillageIcon';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {sound} from '../sound/engine';
import type {Disaster} from '../api/types';
import type {Town} from './layout/town';
import {disasterParts,effectCenter,lightningIntensity,primitiveAtlas,vfxFragment,vfxVertex} from './disasterVisuals';

export function DisasterEffects({disaster:d,town,reduced,petCount=0}:{disaster?:Disaster|null;town:Town;reduced:boolean;petCount?:number}) {
  const camera=useThree(s=>s.camera);
  const [still,setStill]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setStill(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const lastEvent=useRef(d);
  if(d)lastEvent.current=d;
  const previous=useRef({disaster:d,pets:petCount});
  const [celebration,setCelebration]=useState(false);
  const [celebrationId,setCelebrationId]=useState(0);
  useEffect(()=>{
    const last=previous.current;
    if(last.disaster&&(!d || d.kind==='outbreak'&&petCount>last.pets)) {setCelebration(true);setCelebrationId(i=>i+1);if(d)sound.play('prayer_chime');}
    previous.current={disaster:d,pets:petCount};
  },[d,petCount]);
  // A new rehearsal/event must not retain the previous repair's welcome-home VFX.
  useEffect(()=>{if(d)setCelebration(false);},[d?.repair_event_id]);
  useEffect(()=>{if(!celebration)return;const timer=setTimeout(()=>setCelebration(false),4200);return()=>clearTimeout(timer);},[celebration,celebrationId]);
  const parts=useMemo(()=>disasterParts(d,town,reduced,celebration,effectCenter(lastEvent.current,town)),[d,town,reduced,celebration]);
  const geometry=useMemo(()=>{const g=primitiveAtlas();g.setAttribute('effect',new THREE.InstancedBufferAttribute(new Float32Array(parts.flatMap(p=>[p.shape,p.fx??0,p.phase??0,p.alpha??1])),4));return g;},[parts]);
  const material=useMemo(()=>new THREE.ShaderMaterial({vertexShader:vfxVertex,fragmentShader:vfxFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,uniforms:{time:{value:0},age:{value:0},still:{value:0}}}),[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);
  const mesh=useRef<THREE.InstancedMesh>(null), light=useRef<THREE.DirectionalLight>(null);
  const start=useRef(performance.now()), celebrationStart=useRef(performance.now());
  useEffect(()=>{start.current=performance.now();},[d?.repair_event_id]);
  useEffect(()=>{celebrationStart.current=performance.now();},[celebrationId]);
  useLayoutEffect(()=>{if(!mesh.current)return;const o=new THREE.Object3D();parts.forEach((p,i)=>{o.position.set(...p.p);o.scale.set(...p.s);o.rotation.set(0,p.yaw??0,0);o.updateMatrix();mesh.current!.setMatrixAt(i,o.matrix);mesh.current!.setColorAt(i,new THREE.Color(p.color));});mesh.current.instanceMatrix.needsUpdate=true;if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true;},[parts]);
  const shake=useRef(0);
  // Undo our previous offset before controls update. Never accumulate camera drift.
  useFrame(()=>{camera.position.x-=shake.current;shake.current=0;},-100);
  useEffect(()=>()=>{camera.position.x-=shake.current;shake.current=0;},[camera]);
  useFrame(()=>{
    const age=(performance.now()-start.current)/1000;
    material.uniforms.time.value=age;
    material.uniforms.age.value=celebration?(performance.now()-celebrationStart.current)/1000:age;
    material.uniforms.still.value=still?1:0;
    if(light.current)light.current.intensity=d?.kind==='blackout'?lightningIntensity(age,still):0;
    if(d?.kind==='scorch'&&!still&&age>=1&&age<1.25){shake.current=Math.sin(age*95)*.055*(1-(age-1)/.25);camera.position.x+=shake.current;}
  });
  if(!parts.length)return null;
  const [x,z]=effectCenter(d??lastEvent.current,town);
  return <group name={`disaster:${d?.kind??'rebuilt'}`}>
    <instancedMesh key={parts.length} name="disaster-vfx-batch" ref={mesh} args={[geometry,material,parts.length]} frustumCulled={false} raycast={()=>{}}/>
    {d?.kind==='blackout'&&<directionalLight ref={light} position={[-15,30,5]} color="#cfd7ff" intensity={0}/>}
    {d?.kind==='scorch'&&<Html position={[x,2.3,z+5]} center style={{pointerEvents:'none'}}><span className="scene-label" style={{background:'#f4dfba',color:'#755641',borderColor:'#b68962',fontSize:11}}>Closed for repairs</span></Html>}
    {d?.kind==='outbreak'&&<Html position={[x+4,3.4,z+4]} center style={{pointerEvents:'none'}}><span className="scene-label" style={{background:'#e4f0dc',color:'#457c73'}}><VillageIcon name="paw" size={14}/> Vet visit</span></Html>}
    {celebration&&<Html position={[x,6,z]} center style={{pointerEvents:'none'}}><span className="scene-label">{d?'Welcome home!':'Rebuilt with love'}</span></Html>}
  </group>;
}
