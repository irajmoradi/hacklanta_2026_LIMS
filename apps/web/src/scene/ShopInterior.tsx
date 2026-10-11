import { Html, PerspectiveCamera, RenderTexture } from '@react-three/drei';
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, Group, Mesh, Object3D, Vector3, WebGLRenderTarget } from 'three';
import { loadModel, OptionalModel } from './OptionalModel';
import { catalog } from '../../../../packages/catalog/dist/catalog';
import type { ShopItem, Villager } from '../api/types';

import { boutiqueLayout, petPriceRange } from './interior';
import { moveBoutique } from './playerControl';
import { CurrencyAmount } from '../components/Currency';

type Point = [number, number, number];
export type Department = 'general' | 'farm';
const cream = '#f4e4c5', wood = '#966949', teal = '#387f78';
function Box({p,s,c=wood,rotation=0}:{p:Point;s:Point;c?:string;rotation?:number}) {
  return <mesh position={p} rotation={[0,rotation,0]}><boxGeometry args={s}/><meshStandardMaterial color={c} roughness={.8}/></mesh>;
}
function Ball({p,s,c}:{p:Point;s:Point;c:string}) {return <mesh position={p} scale={s}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color={c}/></mesh>;}
function Sign({text,p,width=2,color=cream,ink='#30463c'}:{text:string;p:Point;width?:number;color?:string;ink?:string}) {
  const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 36px Georgia';ctx.fillText(text,256,64,490);return new CanvasTexture(canvas);},[text,color,ink]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh position={p}><planeGeometry args={[width,width/4]}/><meshBasicMaterial map={texture}/></mesh>;
}
function Fence({p,width=1.8,depth=1.6}:{p:Point;width?:number;depth?:number}) {
  return <group position={p}>{[-1,1].flatMap(side=>[<Box key={`post${side}`} p={[side*width/2,.4,depth/2]} s={[.10,.8,.10]} c={cream}/>,... [.25,.6].flatMap(y=>[<Box key={`x${side}${y}`} p={[side*width/2,y,0]} s={[.08,.08,depth]} c={cream}/>,<Box key={`z${side}${y}`} p={[0,y,side*depth/2]} s={[width,.08,.08]} c={cream}/>])])}</group>;
}
export function ShopPet({id,p,size=.75}:{id:string;p:Point;size?:number}) {
  return <group position={p} name={`for-sale:${id}`}><OptionalModel name={id} size={size} hero={false} animate={(model,time)=>{const bob=model.getObjectByName('idle_bob');if(bob)bob.position.y=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.sin(time*2)*.025;}}><Ball p={[0,.24,0]} s={[.2,.22,.3]} c="#d9ab76"/><Ball p={[0,.45,.2]} s={[.19,.18,.18]} c={cream}/></OptionalModel></group>;
}
function Shelves({farm}:{farm:boolean}) {
  return <group>{[.8,1.55,2.3].map((y,row)=><group key={y}><Box p={[boutiqueLayout.shelves.x,y,boutiqueLayout.shelves.z]} s={[boutiqueLayout.shelves.width,.12,boutiqueLayout.shelves.depth]}/>{Array.from({length:6},(_,i)=><group key={i}><Box p={[-4.2+i*.67,y+.18,-3.3]} s={farm?[.40,.32,.33]:[.49,.13,.36]} c={['#e6b776',teal,'#ca827e','#8494ad'][ (i+row)%4]}/>{!farm&&<Box p={[-4.2+i*.67,y+.29,-3.3]} s={[.45,.08,.34]} c={cream}/>}</group>)}</group>)}</group>;
}
function Boutique({items,active,preview}:{items:ShopItem[];active:boolean;preview?:Villager}) {
  const [featured,setFeatured]=useState(0);
  useEffect(()=>{if(!active)return;const timer=setInterval(()=>setFeatured(n=>n+4),20000);return()=>clearInterval(timer);},[active]);
  const candidates=items.filter(i=>i.kind==='clothing'&&(i.slot==='torso'||i.slot==='head')&&(!i.source||i.source==='shop'));
  const fallback=catalog.entries.filter(e=>e.kind==='clothing'&&(e.slot==='torso'||e.slot==='head')&&e.tags?.includes('shop'));
  const turn=useRef(0),displays=useRef<Group>(null);
  // Catalog-driven featured rack rotates gently; no timers or paid generation.
  useFrame((_,delta)=>{if(active&&displays.current&&!matchMedia('(prefers-reduced-motion: reduce)').matches){turn.current+=delta;displays.current.children.forEach((child,i)=>child.rotation.y=Math.sin(turn.current*.25+i)*.25);}});
  return <>
    <Sign text="THREAD & THISTLE" p={[-1,3,-3.65]} width={4}/><Sign text="SALE · little joys" p={[-3.9,2.8,-3.6]} width={1.5}/>
    <Box p={[.1,.035,.7]} s={[3.4,.04,4]} c="#bd7e74"/>
    <group name="clothing-rack" position={[boutiqueLayout.rack.x-.35,0,boutiqueLayout.rack.z+2.55]}>
    <Box p={[.35,1.85,-2.55]} s={[2.7,.08,.08]} c="#c2a166"/>
    {[-1,1.7].map(x=><Box key={x} p={[x,.95,-2.55]} s={[.07,1.9,.07]} c="#c2a166"/>)}
    {[0,1,2,3].map(i=><group key={i}><Box p={[-.7+i*.68,1.17,-2.55]} s={[.47,.82,.13]} c={['#5f899e','#cc9b69','#69967e','#c78083'][i]}/><Box p={[-.7+i*.68,1.61,-2.55]} s={[.55,.05,.1]} c={cream}/><Sign text={`${25+i*15} coins`} p={[-.7+i*.68,.79,-2.46]} width={.38}/></group>)}
    </group>
    <group position={[4.15,1.25,-2.7]} rotation={[0,-.23,0]}><Box p={[0,0,0]} s={[1.1,2.5,.13]} c="#c29d60"/><Box p={[0,0,.08]} s={[.9,2.27,.03]} c="#bad9df"/>{preview ? <mesh position={[0,0,.12]} name="fitting-mirror"><planeGeometry args={[.9,2.27]}/><meshBasicMaterial><RenderTexture attach="map" width={256} height={512}>
      <color attach="background" args={['#bad9df']}/><PerspectiveCamera makeDefault manual aspect={.9/2.27} position={[0,.9,3]} fov={38}/>
      <ambientLight intensity={2}/><directionalLight position={[2,4,3]} intensity={2}/>
      <group scale={[-1,1,1]}><OptionalModel name="villager_base" size={1.7} colors={preview.avatar.body.colors} head={preview.avatar.body} equipment={preview.equipped} hero={false}><Box p={[0,.65,0]} s={[.5,.8,.3]} c={preview.avatar.body.colors.shirt}/><Ball p={[0,1.3,0]} s={[.3,.32,.3]} c={preview.avatar.body.colors.skin}/></OptionalModel></group>
    </RenderTexture></meshBasicMaterial></mesh> : <Box p={[-.25,0,.11]} s={[.035,1.8,.02]} c="#f0f7ef"/>}</group>
    <group ref={displays}>{[0,1,2,3].map(i=>{const entry=candidates[(i+featured)%candidates.length]??fallback[(i+featured)%fallback.length];const asset=entry&&catalog.entries.find(e=>e.id===entry.id)?.asset?.glb.split('/').pop()?.replace('.glb','');return <group key={i} position={[preview?2.3:3.45,0,-1.3+i*1.35]} name={`mannequin:${entry?.id}`}><Box p={[0,.1,0]} s={[.8,.2,.75]} c={cream}/><group position={[0,.2,0]}><OptionalModel name="villager_base" size={1.7} hero={false} colors={{skin:cream,hair:cream,shirt:cream,pants:cream}} equipment={entry?[{item_id:entry.id,slot:entry.slot==='head'?'head':'torso',asset_key:asset??null}]:[]}><Box p={[0,.65,0]} s={[.58,.7,.25]} c={teal}/><Ball p={[0,1.4,0]} s={[.20,.23,.2]} c={cream}/></OptionalModel></group><Sign text={entry?.name??'Village outfit'} p={[0,.25,.4]} width={.95}/></group>;})}</group>
    <Box p={[.1,.55,2.9]} s={[2.5,1.1,.8]} c={wood}/><mesh position={[.1,1.22,2.9]}><boxGeometry args={[2.5,.5,.8]}/><meshStandardMaterial color="#b5e0dc" transparent opacity={.23} depthWrite={false}/></mesh>
    {['glasses_round','scarf','hat_headphones'].map((id,i)=><group key={id} position={[-.7+i*.8,1.1,2.9]}><OptionalModel name={id} size={.45} hero={false}><Ball p={[0,.1,0]} s={[.2,.1,.1]} c="#cca76f"/></OptionalModel></group>)}
    <Box p={[-4.65,1.2,-.9]} s={[.08,2.4,1.6]} c="#ba7979"/>
    <group position={[-4.15,0,-2]}><Box p={[0,.65,0]} s={[.06,1.3,.06]} c="#b49773"/><mesh position={[0,1.34,0]}><cylinderGeometry args={[.36,.36,.05,12]}/><meshStandardMaterial color="#d5ac7b"/></mesh><mesh position={[0,1.48,0]}><cylinderGeometry args={[.18,.22,.25,12]}/><meshStandardMaterial color="#d5ac7b"/></mesh></group>
    {[0,1,2].map(i=><Box key={i} p={[-4.2+i*.6,.18,-2.8]} s={[.5,.3,.65]} c={cream}/>)}
  </>;
}
function PetStore() {
  return <>
    <Sign text="THE LITTLE FARM" p={[-.7,3,-3.65]} width={4}/>
    {[-.5,2].map((x,i)=><group key={x} position={[x,0,-2.4]}><Box p={[0,.45,0]} s={[1.8,.9,1.4]} c={i?teal:'#be7860'}/><Box p={[0,.35,.72]} s={[.8,.7,.03]} c="#443e37"/><mesh position={[0,1.22,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[1.4,.8,4]}/><meshStandardMaterial color={cream}/></mesh><Sign text={i?'pets for sale':'cute pets'} p={[0,1.12,.76]} width={1.5}/><ShopPet id={i?'pet_cat_calico':'pet_pug'} p={[0,0,.6]}/></group>)}
    {[0,1].map(i=><group key={i} position={[1.25+i*2.4,0,.2]}><Fence p={[0,0,0]}/><Sign text="Pets" p={[0,.65,.86]} width={1}/><ShopPet id={i?'pet_husky':'pet_bunny'} p={[0,0,0]}/></group>)}
    <Box p={[-4,.12,1.6]} s={[1.4,.24,.95]} c="#b68691"/><ShopPet id="pet_cat_tabby" p={[-4,.24,1.6]}/><Ball p={[-3.1,.13,1.9]} s={[.25,.11,.25]} c={teal}/>
    <ShopPet id="pet_cat_black" p={[-.8,0,-1.3]}/><ShopPet id="pet_hamster" p={[3.7,.65,2.5]} size={1.05}/><Box p={[3.7,.3,2.5]} s={[1.2,.6,1.2]}/>
    <Box p={[.8,.19,2.7]} s={[1.8,.38,1.1]} c="#739eaa"/><Box p={[.8,.4,2.7]} s={[1.6,.02,.9]} c="#a9d6d9"/>{[0,1,2].map(i=><ShopPet key={i} id="duckling" p={[.3+i*.45,.4,2.7]} size={.35}/>)}
    <Box p={[-1.1,.25,2.6]} s={[.85,.5,.9]} c="#d8b668"/><Box p={[-1.1,.5,2.6]} s={[.1,.52,.92]} c={cream}/>
    <Box p={[4.2,.3,-1.5]} s={[.55,.6,1.3]} c={wood}/><Box p={[4.2,.61,-1.5]} s={[.45,.02,1.15]} c="#c9ac6b"/>
    <Sign text="Feed · toys · leashes" p={[-2.8,2.65,-3.2]} width={2}/>
    {[0,1,2].map(i=><group key={i}><Ball p={[-4+i*.6,1.8,-3.25]} s={[.12,.12,.12]} c={['#db9b71','#7a9c80','#bf8297'][i]}/><mesh position={[-4+i*.6,2.48,-3.27]}><torusGeometry args={[.12,.025,4,12]}/><meshStandardMaterial color={teal}/></mesh></group>)}
    <Box p={[0,3,-3.15]} s={[9,.018,.018]} c="#554d40"/>
  </>;
}
function PetPrices({items}:{items:ShopItem[]}) {
  const range=petPriceRange(items);
  return <group name="pet-price-board" position={[-2.8,1.67,.4]}>
    <Box p={[0,-.15,0]} s={[.07,.34,.08]} c={wood}/><Box p={[0,-.29,0]} s={[.55,.04,.26]} c={wood}/>
    <Html center style={{pointerEvents:'none'}}><div data-testid="pet-counter-prices" style={{width:175,padding:'5px 8px',border:'2px solid #966949',borderRadius:4,background:cream,color:'#30463c',textAlign:'center',fontSize:12,lineHeight:1.3,boxShadow:'0 2px 3px #0002'}}>
      <strong>Pet prices</strong><div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:3,whiteSpace:'nowrap'}}>{range?<><CurrencyAmount amount={range.min} currency="coins"/>{range.max!==range.min&&<>&ndash;<CurrencyAmount amount={range.max} currency="coins"/></>}</>: 'Coming soon'}</div>
    </div></Html>
  </group>;
}
function Room({farm,items,active,preview}:{farm:boolean;items:ShopItem[];active:boolean;preview?:Villager}) {
  return <group name={farm?'farm-interior':'boutique-interior'}>
    <Box p={[0,-.12,0]} s={[10,.24,8]} c={farm?'#b69b79':'#dec7a3'}/>
    {Array.from({length:15},(_,i)=><Box key={i} p={[-4.9+i*.7,.008,0]} s={[.018,.008,8]} c="#b09a7e"/>)}
    <Box p={[0,1.7,-3.9]} s={[10,3.4,.2]} c={farm?'#8e6a52':'#e9cfc2'}/>{farm?<Box p={[-5,1.7,0]} s={[.15,3.4,8]} c="#9d7859"/>:<>
      <Box p={[-5,1.7,-1.325]} s={[.15,3.4,5.35]} c="#edddc7"/>
      <Box p={[-5,1.7,3.675]} s={[.15,3.4,.65]} c="#edddc7"/>
      <Box p={[-5,2.85,2.35]} s={[.15,1.1,2]} c="#edddc7"/>
    </>}
    {farm&&Array.from({length:16},(_,i)=><Box key={i} p={[-4.7+i*.62,1.7,-3.77]} s={[.025,3.4,.025]} c="#75503e"/>)}
    <group name={farm?'farm-shelves':'boutique-shelves'}><Shelves farm={farm}/></group>
    <Box p={[-2.9,.62,.05]} s={[2.7,1.24,1.05]} c={farm?wood:teal}/><Box p={[-2.9,1.29,.05]} s={[2.9,.12,1.18]} c={cream}/><Sign text={farm?'Pets and stuff':'CHECKOUT'} p={[-2.9,.7,.59]} width={2}/>
    <Box p={[-3.45,1.5,0]} s={[.58,.32,.4]} c="#485759"/><Box p={[-3.45,1.62,.22]} s={[.4,.15,.02]} c="#a9d6bb"/>
    <Box p={[-1.87,1.5,0]} s={[.25,.3,.25]} c="#d19c7b"/><Ball p={[-1.87,1.82,0]} s={[.25,.3,.24]} c="#698b62"/>
    {farm?(active&&<PetPrices items={items}/>):<Sign text="Fitting room" p={[-4.5,2,-1]} width={1.1}/>}
    {/* Keep the pet store front entrance; the boutique opens through its left wall. */}
    <group name={farm?'farm-door':'boutique-door'} position={farm?[0,0,3.9]:[boutiqueLayout.door.x,0,boutiqueLayout.door.z]} rotation={[0,farm?0:Math.PI/2,0]}>
      {[-1,1].map(x=><Box key={x} p={[x,1.1,0]} s={[.13,2.2,.14]} c={wood}/>)}<Box p={[0,2.23,0]} s={[2.13,.12,.14]} c={wood}/><Box p={[0,.02,-.25]} s={[1.8,.04,.5]} c={teal}/>
    </group>
    {[-3,0,3].map(x=><group key={x}><Box p={[x,3,0]} s={[.025,.7,.025]} c={wood}/><mesh position={[x,2.65,0]}><coneGeometry args={[.35,.25,8]}/><meshStandardMaterial color="#ebbb73" emissive="#ebbb73" emissiveIntensity={.3}/></mesh></group>)}
    {farm&&Array.from({length:10},(_,i)=><Ball key={i} p={[-4.4+i*.95,2.9+Math.sin(i*.5)*.15,-3.1]} s={[.055,.08,.055]} c="#ffda8a"/>)}
    {farm?<PetStore/>:<Boutique items={items} active={active} preview={preview}/>}
  </group>;
}
function Checkout({person,purchase,trying,section,active}:{active:boolean;person?:Villager;purchase:number;trying:boolean;section:Department}) {
  const shopper=useRef<Group>(null);
  useEffect(()=>{if(shopper.current&&section==='general'){const p=active?boutiqueLayout.spawn:boutiqueLayout.exit;shopper.current.position.set(p[0],0,p[1]);}},[active,section]);
  const start=useRef(-10000),coin=useRef<Group>(null),bag=useRef<Group>(null);
  useEffect(()=>{if(purchase)start.current=performance.now();},[purchase]);
  useFrame((_,delta)=>{const t=(performance.now()-start.current)/1400, reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(shopper.current&&active){const target=trying ? section==='general' ? [3.9,0,-1.2] : [-.6,0,1.4] : [-2.6,0,1.7];const a=reduced?1:section==='general'?1-Math.exp(-delta*10):.16;if(section==='general'){
      const p=shopper.current.position;
      const next=moveBoutique([p.x,p.z],[(target[0]-p.x)*a,(target[2]-p.z)*a]);p.set(next[0],0,next[1]);
    }else shopper.current.position.lerp(new Vector3(...target),a);}
    if(coin.current){coin.current.visible=t>=0&&t<.6&&!reduced;coin.current.position.set(-2.6,1.45+Math.sin(t*Math.PI/.6)*.35,1.05-t*1.5);}
    if(bag.current){bag.current.visible=t>=.35&&t<1;bag.current.scale.setScalar(reduced?1:Math.min(1,(t-.35)*5));}
  });
  return <>
    <group ref={shopper} position={[-2.6,0,1.7]} rotation={[0,Math.PI,0]} name={`shopper:${person?.user_id??'you'}`}>
      <OptionalModel name="villager_base" size={1.7} colors={person?.avatar.body.colors} head={person?.avatar.body} equipment={person?.equipped} hero={false} animate={model=>{const t=(performance.now()-start.current)/1400;const arm=model.getObjectByName('Arm_R');if(arm)arm.rotation.x=t>=0&&t<.65?-Math.sin(t/.65*Math.PI)*1.25:0;}}>
        <Box p={[0,.65,0]} s={[.5,.8,.3]} c={person?.avatar.body.colors.shirt??teal}/><Ball p={[0,1.3,0]} s={[.3,.32,.3]} c={person?.avatar.body.colors.skin??'#d7a680'}/>
      </OptionalModel>
    </group>
    {trying && section==='farm' && person?.equipped.filter(i=>i.slot==='pet').map(item=><group key={item.item_id} name={`try-on-pet:${item.item_id}`}><ShopPet id={item.asset_key??item.item_id} p={[.45,0,1.4]} size={.65}/></group>)}
    <group name="checkout-coins" ref={coin} visible={false}><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.12,.12,.04,12]}/><meshStandardMaterial color="#ffcf57" metalness={.4} roughness={.3}/></mesh></group>
    <group name="checkout-bag" ref={bag} position={[-2.5,1.42,.3]} visible={false}><Box p={[0,.2,0]} s={[.4,.4,.3]} c="#d8af77"/><Box p={[0,.44,0]} s={[.18,.08,.06]} c={cream}/></group>
  </>;
}
function Director({active,section}:{active:boolean;section:Department}) {
  const {gl,scene,camera}=useThree(),start=useRef(0),entered=useRef(false);
  // Switching a dormant Canvas to "always" can schedule its first frame before
  // passive effects. Reset before that frame, not after it has used the old
  // (hidden-shop) clock and briefly published a stale completed transition.
  useLayoutEffect(()=>{start.current=performance.now();entered.current=false;
    gl.domElement.dataset.entered='false';delete gl.domElement.dataset.transitionMs;
    if(!active&&section==='general'){camera.position.set(boutiqueLayout.exit[0],1.5,boutiqueLayout.exit[1]);camera.lookAt(0,.6,0);}
  },[active,section,camera,gl]);
  useEffect(()=>{let disposed=false;let timer:ReturnType<typeof setTimeout>;
    const models=['villager_base','duckling','glasses_round','scarf','hat_headphones',...catalog.entries.filter(e=>e.kind==='pet'||((e.slot==='torso'||e.slot==='head')&&e.tags?.includes('shop'))).flatMap(e=>e.asset?[e.asset.glb.split('/').pop()!.replace('.glb','')]:[])];
    void Promise.all(models.map(loadModel)).then(()=>{if(disposed)return;timer=setTimeout(()=>{
    const hidden:Object3D[]=[];scene.traverse(o=>{if(!o.visible){hidden.push(o);o.visible=true;}});
    const target=new WebGLRenderTarget(64,64),prior=gl.getRenderTarget();
    try{camera.lookAt(0,.6,0);gl.compile(scene,camera);gl.setRenderTarget(target);gl.render(scene,camera);gl.setRenderTarget(prior);gl.render(scene,camera);gl.domElement.dataset.shopWarmed='true';}
    finally{gl.setRenderTarget(prior);target.dispose();hidden.forEach(o=>o.visible=false);}
  },100);});return()=>{disposed=true;clearTimeout(timer);};},[gl,scene,camera]);
  const look=useMemo(()=>new Vector3(0,.6,0),[]);
  useFrame(()=>{const t=matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min(1,(performance.now()-start.current)/360);
    // Cross the department doorway, then rise to the dollhouse overview in 360 ms.
    const door=Math.min(1,t/.25),rise=Math.max(0,(t-.25)/.75),lift=1-(1-rise)**3;
    if(section==='general'){
      const [ex,ez]=boutiqueLayout.exit,[sx,sz]=boutiqueLayout.spawn;
      camera.position.set(t<.25?ex+(sx-ex)*door:sx*(1-lift),1.5+7.2*lift,t<.25?ez+(sz-ez)*door:sz+(12.8-sz)*lift);
    }else camera.position.set(0,1.5+6.2*lift,t<.25?4.8-1.5*door:3.3+7.7*lift);
    camera.lookAt(look);
    gl.domElement.dataset.triangles=String(gl.info.render.triangles);gl.domElement.dataset.drawCalls=String(gl.info.render.calls);gl.domElement.dataset.entered=String(t===1);
    if(t===1&&!entered.current){entered.current=true;gl.domElement.dataset.transitionMs=String(performance.now()-start.current);}
    const names:string[]=[];let triangles=0;scene.traverseVisible(o=>{if(o.name.startsWith('for-sale:')||o.name.startsWith('mannequin:'))names.push(o.name);if(o instanceof Mesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});gl.domElement.dataset.displays=JSON.stringify(names);gl.domElement.dataset.totalTriangles=String(triangles);
    gl.domElement.dataset.checkoutCoins=String(scene.getObjectByName('checkout-coins')?.visible);gl.domElement.dataset.checkoutBag=String(scene.getObjectByName('checkout-bag')?.visible);
  });return null;
}
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<p className="shop-3d-fallback">Welcome in. Browse the shop below while the room is unavailable.</p>:this.props.children;}}
export default function ShopInterior({active,section,person,purchase,items,trying=false}:{trying?:boolean;active:boolean;section:Department;person?:Villager;purchase:number;items:ShopItem[]}) {
  return <Boundary><Canvas frameloop={active?'always':'never'} camera={{position:[0,7.7,11],fov:48}} dpr={[1,1.5]} gl={{antialias:true,powerPreference:'high-performance'}}>
    <color attach="background" args={['#eee1cb']}/><hemisphereLight intensity={2.4} color="#fff5df" groundColor="#9a775c"/><directionalLight position={[-3,8,5]} intensity={2.5}/>
    <group visible={section==='general'}><Room farm={false} items={items} active={active&&section==='general'} preview={trying?person:undefined}/></group><group visible={section==='farm'}><Room farm items={items} active={active&&section==='farm'}/></group>
    <Checkout active={active} person={person} purchase={purchase} trying={trying} section={section}/><Director active={active} section={section}/>
  </Canvas></Boundary>;
}
