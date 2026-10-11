import { AmbientEmitter } from './SceneAmbience';
import { sound } from '../sound/engine';
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Sparkles } from '@react-three/drei';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedMesh, Material, Mesh, MeshStandardMaterial, Object3D, Group, Texture, WebGLRenderTarget, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadModel, OptionalModel } from './OptionalModel';
import type { Village } from '../api/types';
import { arenaPosition, type Standing } from '../components/colosseumData';

// Keep animation pivots separate from immutable architecture. All static stone,
// including seating rings, is merged by material; silhouettes share one draw.
function Stands({ source }: {source: Object3D}) {
  const data = useMemo(() => {
    source.updateMatrixWorld(true);
    const groups=new Map<string,{material:Material|Material[];geometries:BufferGeometry[]}>();
    source.traverse(node=>{
      if (!(node instanceof Mesh)) return;
      let ancestor:Object3D|null=node;
      while(ancestor) {
        if (/^(gate$|banner_|flag_|crowd_|torch_flame|flicker_)/.test(ancestor.name)) return;
        ancestor=ancestor.parent;
      }
      const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);
      Object.keys(geometry.attributes).filter(k=>!['position','normal','color','uv'].includes(k)).forEach(k=>geometry.deleteAttribute(k));
      // Normalize COLOR_0 to RGB, supplying white for unweathered stone.
      const colors=new Float32Array(geometry.attributes.position.count*3).fill(1);
      const original=geometry.getAttribute('color');
      if(original)for(let i=0;i<original.count;i++)colors.set([original.getX(i),original.getY(i),original.getZ(i)],i*3);
      geometry.setAttribute('color',new BufferAttribute(colors,3));
      const key=Array.isArray(node.material)?node.material.map(m=>m.uuid).join(':'):node.material.uuid;
      if(!groups.has(key))groups.set(key,{material:node.material,geometries:[]});
      groups.get(key)!.geometries.push(geometry);
    });
    return [...groups.values()].map(g=>{
      const geometry=mergeGeometries(g.geometries);g.geometries.forEach(x=>x.dispose());
      const clone=(m:Material)=>{const c=m.clone();if(c instanceof MeshStandardMaterial)c.vertexColors=true;return c;};
      return {geometry,material:Array.isArray(g.material)?g.material.map(clone):clone(g.material)};
    });
  },[source]);
  useEffect(()=>()=>data.forEach(b=>{b.geometry?.dispose();(Array.isArray(b.material)?b.material:[b.material]).forEach(m=>m.dispose());}),[data]);
  return <>{data.map((b,i)=>b.geometry&&<mesh key={i} geometry={b.geometry} material={b.material} dispose={null} receiveShadow castShadow/>)}</>;
}
function ArenaLife({source,closed,active}:{source:Object3D;closed:boolean;active:boolean}) {
  const crowd=useRef<InstancedMesh>(null);
  const progress=useRef(0);
  useEffect(()=>{progress.current=0;},[active]);
  const reduced=useMemo(()=>matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  const data=useMemo(()=>{
    const root=new Object3D(),people:Mesh[]=[],cloth:{mesh:Mesh;positions:Float32Array}[]=[],flames:Mesh[]=[];
    source.updateMatrixWorld(true);
    source.traverse(node=>{
      if(node instanceof Mesh && node.name.startsWith('crowd_'))people.push(node);
      if(node.name==='gate' || /^(banner_|flag_|torch_flame|flicker_)/.test(node.name)) {
        const copy=node.clone(true);root.add(copy);
        node.matrixWorld.decompose(copy.position,copy.quaternion,copy.scale);
        if(copy instanceof Mesh && /^(banner_|flag_)/.test(copy.name)){
          copy.geometry=copy.geometry.clone();
          cloth.push({mesh:copy,positions:new Float32Array(copy.geometry.attributes.position.array)});
        }
        if(copy instanceof Mesh && /^(torch_flame|flicker_)/.test(copy.name)){
          copy.material=(copy.material as MeshStandardMaterial).clone();flames.push(copy);
        }
      }
    });
    const material=new MeshStandardMaterial({color:'#ffffff',roughness:1,side:DoubleSide});
    return {root,people,cloth,flames,gate:root.getObjectByName('gate'),material,matrix:new Object3D()};
  },[source]);
  useLayoutEffect(()=>{
    const palette=['#914d43','#397e79','#d3ad71','#536079','#806a80'];
    data.people.forEach((p,i)=>{crowd.current?.setMatrixAt(i,p.matrixWorld);crowd.current?.setColorAt(i,new Color(palette[i%palette.length]));});
    if(crowd.current){crowd.current.instanceMatrix.needsUpdate=true;crowd.current.computeBoundingSphere();}
  },[data]);
  useEffect(()=>()=>{data.cloth.forEach(c=>c.mesh.geometry.dispose());data.flames.forEach(f=>(f.material as Material).dispose());data.material.dispose();},[data]);
  useFrame(({clock},delta)=>{
    progress.current=Math.min(1,progress.current+delta/1.8);
    const intro=reduced?1:1-(1-progress.current)**3;
    if(data.gate) {
      const goal=closed?0:3.5*intro;
      data.gate.position.y=reduced?goal:data.gate.position.y+(goal-data.gate.position.y)*Math.min(1,delta*5);
    }
    data.cloth.forEach(({mesh,positions},i)=>{
      mesh.scale.y=.08+.92*intro;
      if(reduced)return;
      const p=mesh.geometry.attributes.position;
      for(let v=0;v<p.count;v++)p.setZ(v,positions[v*3+2]+Math.sin(clock.elapsedTime*1.8+positions[v*3]*3+i)*.095*Math.min(1,Math.abs(positions[v*3+1])));
      p.needsUpdate=true;
    });
    data.flames.forEach((f,i)=>{f.scale.y=reduced?1:1+Math.sin(clock.elapsedTime*8+i)*.1;(f.material as MeshStandardMaterial).emissiveIntensity=reduced?2:2.5+Math.sin(clock.elapsedTime*11+i)*.35;});
    if(crowd.current&&!reduced){
      data.people.forEach((p,i)=>{data.matrix.matrix.copy(p.matrixWorld);data.matrix.matrix.elements[13]+=.035*Math.sin(clock.elapsedTime*1.9+i*2.4);crowd.current!.setMatrixAt(i,data.matrix.matrix);});
      crowd.current.instanceMatrix.needsUpdate=true;
    }
  });
  return <><primitive object={data.root} dispose={null}/>{data.people.length>0&&<instancedMesh ref={crowd} args={[data.people[0].geometry,data.material,data.people.length]} dispose={null}/>}</>;
}
function FallbackArena() {
  const ref=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{const obj=new Object3D(); for(let tier=0;tier<3;tier++)for(let i=0;i<28;i++) {const a=(24+i*312/27)*Math.PI/180;obj.position.set(Math.sin(a)*(7.7+tier*.95),.45+tier*.65,Math.cos(a)*(7.7+tier*.95));obj.rotation.y=a;obj.scale.set(1.7,.65+tier*1.3,1.05);obj.updateMatrix();ref.current!.setMatrixAt(tier*28+i,obj.matrix);}ref.current!.instanceMatrix.needsUpdate=true;ref.current!.computeBoundingSphere();},[]);
  return <><mesh position={[0,.08,0]}><cylinderGeometry args={[10,10,.16,48]}/><meshStandardMaterial color="#c8b998"/></mesh><instancedMesh ref={ref} args={[undefined,undefined,84]}><boxGeometry/><meshStandardMaterial color="#ddc9a9"/></instancedMesh>{[1.05,.7,.4].map((h,i)=><mesh key={i} position={[[0,-2,2][i],h/2+.16,0]}><boxGeometry args={[1.8,h,1.8]}/><meshStandardMaterial color={i?'#e3d0ae':'#3b9790'}/></mesh>)}</>;
}
function Architecture({open,active,onLoaded}:{open:boolean;active:boolean;onLoaded:()=>void}) {
  const [source,setSource]=useState<Object3D|null>(null);
  useEffect(()=>{let alive=true;void loadModel('colosseum').then(s=>{if(alive){setSource(s);onLoaded();}});return()=>{alive=false;};},[]);
  return source ? <><Stands source={source}/><ArenaLife source={source} closed={open} active={active}/></> : <><FallbackArena/>{open&&<mesh position={[0,1.6,9.6]}><boxGeometry args={[3.8,3,.15]}/><meshStandardMaterial color="#384852" wireframe/></mesh>}</>;
}

function Camera({target,open,auditor}:{auditor:boolean;target:[number,number,number]|null;open:boolean}) {
  const {camera}=useThree();
  const transition=useRef({start:0,from:camera.position.clone(),look:new Vector3(),fromLook:new Vector3(),to:new Vector3(),toLook:new Vector3()});
  useEffect(()=>{const t=transition.current;t.start=performance.now();t.from.copy(camera.position);t.fromLook.copy(t.look);t.to.fromArray(auditor?[0,12,-14]:target?[target[0]+3.5,target[1]+3,target[2]+6] as [number,number,number]:open?[16,18,29]:[15,19,24]);t.toLook.fromArray(auditor?[0,0,1]:target?[target[0],target[1]+1,target[2]] as [number,number,number]:open?[0,1,5]:[0,0,0]);},[target?.[0],target?.[1],target?.[2],open,camera,auditor]);
  useFrame(()=>{const t=transition.current;const p=Math.min(1,(performance.now()-t.start)/(matchMedia('(prefers-reduced-motion: reduce)').matches?1:320));const ease=1-(1-p)**3;camera.position.lerpVectors(t.from,t.to,ease);t.look.lerpVectors(t.fromLook,t.toLook,ease);camera.lookAt(t.look);sound.ambience.setListener([t.look.x,t.look.y,t.look.z],35/Math.max(4,camera.position.distanceTo(t.look)));});
  return null;
}
function PodiumLight({active}:{active:boolean}) {
  const target=useMemo(()=>{const o=new Object3D();o.position.set(0,.3,0);return o;},[]);
  return <><primitive object={target}/><spotLight position={[0,10,3]} target={target} intensity={active?110:0} color="#ffe7b0" angle={.43} penumbra={.85} distance={24} decay={2}/></>;
}
function ArchRays() {
  return <group>{[-1,1].map(side=><mesh key={side} position={[side*5,2.5,-4]} rotation={[-.5,0,side*.55]}>
    <planeGeometry args={[1.1,7]}/><meshBasicMaterial color="#ffd995" transparent opacity={.045} depthWrite={false} side={DoubleSide}/>
  </mesh>)}</group>;
}
// Keep every village avatar mounted; previews only change visibility and targets.
function Contender({active,position,index,children}:{active:boolean;position:[number,number,number];index:number;children:ReactNode}) {
  const ref=useRef<Group>(null), puff=useRef<Mesh>(null);
  const motion=useRef({start:0,from:new Vector3(),to:new Vector3(),active:false});
  useLayoutEffect(()=>{const m=motion.current;m.from.copy(ref.current!.position);m.to.fromArray(position);m.start=performance.now()+Math.min(index,6)*18;if(active&&!m.active)m.from.copy(m.to).add(new Vector3(0,2.5,0));m.active=active;},[active,position[0],position[1],position[2],index]);
  useFrame(()=>{if(!active)return;const m=motion.current;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const t=Math.max(0,Math.min(1,(performance.now()-m.start)/180));const spring=t===1?1:1-Math.exp(-7*t)*Math.cos(9*t);ref.current!.position.lerpVectors(m.from,m.to,reduced?1:spring);if(puff.current){puff.current.visible=!reduced&&t>.35&&t<1;puff.current.scale.setScalar(.3+t*1.4);}});
  return <group ref={ref} visible={active}>{children}<mesh ref={puff} rotation={[-Math.PI/2,0,0]} position={[0,.02,0]} visible={false}><ringGeometry args={[.25,.6,16]}/><meshBasicMaterial color="#e4c9a2" transparent opacity={.22} depthWrite={false}/></mesh></group>;
}
// Compile and draw with the real lights and material variants while the dialog is
// hidden. A draw is necessary: compile alone does not upload geometry or shadow maps.
function WarmArena({loaded,allowed,onWarmed}:{loaded:boolean;allowed:boolean;onWarmed?:()=>void}) {
  const {gl,scene,camera}=useThree();
  useEffect(()=>{
    if(!loaded || !allowed || gl.domElement.dataset.arenaReady === 'true')return;
    let idle=0,disposed=false;
    const timer=setTimeout(()=>{idle=requestIdleCallback(()=>{
      if(disposed)return;
      performance.mark('arena-warm-start');
      const hidden:Object3D[]=[],culled:Object3D[]=[];
      scene.traverse(node=>{
        if(!node.visible){hidden.push(node);node.visible=true;}
        if(node.frustumCulled){culled.push(node);node.frustumCulled=false;}
        if(node instanceof Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material]) {
          for(const value of Object.values(material))if(value instanceof Texture)gl.initTexture(value);
        }
      });
      const target=new WebGLRenderTarget(64,64),previous=gl.getRenderTarget();
      try {
        gl.compile(scene,camera);
        gl.setRenderTarget(target);gl.render(scene,camera);
        // Default framebuffer uses a different output color-space shader variant.
        gl.setRenderTarget(previous);gl.render(scene,camera);
      } finally {
        gl.setRenderTarget(previous);target.dispose();hidden.forEach(node=>{node.visible=false;});culled.forEach(node=>{node.frustumCulled=true;});
      }
      // Prime the final framebuffer as well, at the eventual display dimensions.
      gl.render(scene,camera);
      performance.mark('arena-warm-end');performance.measure('arena-warm','arena-warm-start','arena-warm-end');
      gl.domElement.dataset.arenaReady='true';
      onWarmed?.();
    },{timeout:2000});},500);
    return()=>{disposed=true;clearTimeout(timer);cancelIdleCallback(idle);};
  },[loaded,allowed,gl,scene,camera,onWarmed]);
  return null;
}
function VictoryConfetti() {
  const ref=useRef<InstancedMesh>(null);
  const dummy=useMemo(()=>new Object3D(),[]);
  const reduced=useMemo(()=>matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  useLayoutEffect(()=>{for(let i=0;i<72;i++)ref.current?.setColorAt(i,new Color(['#f8cf76','#65cabb','#e999ae'][i%3]));},[]);
  useFrame(({clock})=>{
    if(!ref.current)return;
    for(let i=0;i<72;i++){
      const t=reduced?0:clock.elapsedTime;
      dummy.position.set(Math.sin(i*2.4)*4,1+(i*.37-t*.8%7+7)%7,Math.cos(i*2.4)*3);
      dummy.rotation.set(i+t,i*.8+t*.7,i*.4);dummy.scale.set(1,1,1);dummy.updateMatrix();
      ref.current.setMatrixAt(i,dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate=true;
  });
  return <instancedMesh ref={ref} args={[undefined,undefined,72]} frustumCulled={false}><boxGeometry args={[.12,.2,.025]}/><meshStandardMaterial roughness={.5}/></instancedMesh>;
}
class Boundary extends Component<{children:ReactNode;onFailed?:()=>void},{failed:boolean}> {state={failed:false};static getDerivedStateFromError(){return{failed:true};}componentDidCatch(){this.props.onFailed?.();}render(){return this.state.failed?<p className="arena-webgl">3D is unavailable. Select a participant from the leaderboard.</p>:this.props.children;}}
export function ColosseumScene({village,rows,open,selected,onSelect,competitionSelected=false,active=true,warmAllowed=true,onWarmed,auditor=false,settled=false}:{warmAllowed?:boolean;active?:boolean;onWarmed?:()=>void;village:Village;rows:Standing[];open:boolean;selected:string|null;onSelect:(id:string)=>void;competitionSelected?:boolean;auditor?:boolean;settled?:boolean}) {
  const [loaded,setLoaded]=useState(false);
  const loadedModel=useMemo(()=>()=>setLoaded(true),[]);
  const index=rows.findIndex(r=>r.user_id===selected);
  const target=index<0?null:arenaPosition(index,rows[index].rank,open);
  return <Boundary onFailed={onWarmed}><Canvas resize={{offsetSize:true}} frameloop={active?'always':'never'} shadows camera={{position:[15,19,24],fov:45}} dpr={[1,1.5]} gl={{antialias:true,powerPreference:'high-performance'}}>
    {active && <AmbientEmitter id="arena:crowd" name="arena_crowd_murmur"/>}
    <color attach="background" args={['#393342']}/><fog attach="fog" args={['#393342',32,78]}/>
    <hemisphereLight intensity={1.4} color="#cac4e5" groundColor="#735341"/>
    <directionalLight position={[-8,14,5]} intensity={3} color="#ffd09a" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-normalBias={.06}/>
    <directionalLight position={[7,9,-10]} intensity={1.6} color="#b8c9ef"/>
    <PodiumLight active={competitionSelected}/><ArchRays/>
    <WarmArena allowed={warmAllowed} loaded={loaded} onWarmed={onWarmed}/><Camera target={target} open={open} auditor={auditor}/><Architecture open={open} active={active} onLoaded={loadedModel}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.02,0]}><planeGeometry args={[200,200]}/><meshStandardMaterial color="#484446"/></mesh>
    {settled&&<VictoryConfetti/>}
    <Sparkles count={matchMedia('(prefers-reduced-motion: reduce)').matches?0:60} scale={[20,5,20]} position={[0,2,0]} size={2} speed={.15} opacity={.25} color="#f5d4aa"/>
    {village.villagers.map(person=>{const i=rows.findIndex(r=>r.user_id===person.user_id),r=rows[i];return <Contender key={person.user_id} active={!!r} index={Math.max(i,0)} position={r?arenaPosition(i,r.rank,open):[0,0,0]}><group onClick={e=>{e.stopPropagation();onSelect(person.user_id);}}>
      <OptionalModel name="villager_base" size={1.6} colors={person?.avatar.body.colors} head={person?.avatar.body} equipment={person?.equipped} hero={false}>
        <mesh position={[0,.55,0]}><capsuleGeometry args={[.24,.65,3,6]}/><meshStandardMaterial color={person?.avatar.body.colors.shirt??'#3b9790'}/></mesh><mesh position={[0,1.2,0]}><icosahedronGeometry args={[.3,1]}/><meshStandardMaterial color={person?.avatar.body.colors.skin??'#dda77d'}/></mesh>
      </OptionalModel>
      {r&&<Html position={[0,2.05,0]} center zIndexRange={[2,1]}><button className={`arena-badge ${selected===person.user_id?'selected':''}`} aria-label={`Inspect ${person?.display_name??'Participant'}`} onClick={()=>onSelect(person.user_id)}>{!open&&<b>#{r?.rank}</b>} {person?.display_name??'Participant'}</button></Html>}
    </group></Contender>;})}
  </Canvas></Boundary>;
}
