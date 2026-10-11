import { EMOTE_SECONDS, emoteKey, emoteLabels, type Emote } from './emotes';
import { townLive } from '../api/townLive';
import type { AvatarState } from '../api/overworld';
import { predictIntent } from './predictIntent';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls } from 'three-stdlib';
import type { Town } from './layout/town';
import type { Graph } from './layout/navigation';
import type { XY } from './worldTypes';
import { acceptsKey, editingElement, movement, moveGround, groundRoute, resolveDrop, rideTimeline, CONTROL_TIMEOUT, ACTIVITY_SECONDS, TOWN_SCALE, WHEEL_SPEED, type ManualMotion, type PlayerState, type DropTarget } from './playerControl';

export function usePlayerController(owned:boolean, blocked:boolean, motion:ManualMotion, player:PlayerState, town:Town, graph:Graph, targets:DropTarget[], group:RefObject<THREE.Group>, onShop:(section?:'farm')=>void) {
  const {gl,camera,scene,clock,controls}=useThree();
  const keys=useRef(new Set<string>());
  const [anchor,setAnchor]=useState<THREE.Object3D|null>(null);
  const latest=useRef({blocked,targets,onShop}); latest.current={blocked,targets,onShop};
  const suppressClick=useRef(false);
  const cancelGesture=useRef(()=>{});
  const now=()=>performance.now()/1000;
  const activate=()=>{player.active=true;player.lastInput=now();player.until=now()+CONTROL_TIMEOUT;motion.path=[];motion.tx=motion.x;motion.tz=motion.z;};
  const leaveRide=()=>{if(player.ride){[motion.x,motion.z]=player.ride.target.point;motion.tx=motion.x;motion.tz=motion.z;}player.ride=null;setAnchor(null);};
  useEffect(()=>{
    if(!owned)return;
    const predict=(action:string, fields:Record<string,unknown>)=>{
      const world=townLive.world, previous=world.sample(world.ownId);
      return previous ? predictIntent({...previous,x:motion.x,z:motion.z},action,fields,latest.current.targets,world.avatars.values(),world.now()) : undefined;
    };
    townLive.predictIntent=predict;
    return ()=>{if(townLive.predictIntent===predict)townLive.predictIntent=undefined;};
  },[owned,motion]);
  useEffect(()=>{
    if(!owned) return;
    const canvas=gl.domElement, root=canvas.closest<HTMLElement>('.scene') ?? canvas.parentElement!;
    const map=controls as OrbitControls|undefined;
    let gesture:{id:number;x:number;y:number;origin:XY;point:XY|null;timer:ReturnType<typeof setTimeout>;picked:boolean}|null=null;
    const ray=new THREE.Raycaster(), plane=new THREE.Plane(new THREE.Vector3(0,1,0),0), hit=new THREE.Vector3();
    const isBlocked=()=>latest.current.blocked || !!document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]');
    const ground=(e:PointerEvent):XY|null=>{
      const r=canvas.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) return null;
      ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
      return ray.ray.intersectPlane(plane,hit) ? [hit.x/TOWN_SCALE,hit.z/TOWN_SCALE] : null;
    };
    const pickup=()=>{if(!gesture || isBlocked())return;player.activity=null;player.destination=null;gesture.picked=true;suppressClick.current=true;leaveRide();activate();player.dragging=true;player.label='Carrying';canvas.style.cursor='grabbing';};
    const down=(e:PointerEvent)=>{
      if(gesture || e.button!==0 || isBlocked() || !group.current) return;
      const label=e.target instanceof Element ? e.target.closest('[data-player="true"]') : null;
      if(!label && e.target!==canvas) return;
      ground(e);
      if(!label) {
        const first=ray.intersectObjects(scene.children,true).find(hit=>{let n:THREE.Object3D|null=hit.object;while(n){if(!n.visible)return false;n=n.parent;}return true;});
        let node:THREE.Object3D|null=first?.object??null;
        while(node && node!==group.current)node=node.parent;
        if(!node)return;
      }
      e.preventDefault();e.stopPropagation();
      suppressClick.current=false;
      gesture={id:e.pointerId,x:e.clientX,y:e.clientY,origin:[motion.x,motion.z],point:null,picked:false,timer:setTimeout(pickup,250)};
      if(map)map.enabled=false;
      canvas.setPointerCapture(e.pointerId);
    };
    const move=(e:PointerEvent)=>{
      if(!gesture || e.pointerId!==gesture.id)return;
      e.preventDefault();e.stopPropagation();
      if(!gesture.picked && Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>5)pickup();
      if(gesture.picked){gesture.point=ground(e);if(gesture.point){motion.x=gesture.point[0];motion.z=gesture.point[1];}player.lastInput=now();}
    };
    const finish=(cancel:boolean)=>{
      if(!gesture)return;
      clearTimeout(gesture.timer);
      const g=gesture;gesture=null;
      if(canvas.hasPointerCapture(g.id))canvas.releasePointerCapture(g.id);
      if(map)map.enabled=true;
      canvas.style.cursor='';player.dragging=false;
      if(!g.picked)return;
      [motion.x,motion.z]=g.origin;motion.tx=motion.x;motion.tz=motion.z;
      player.label=null;player.until=now()+CONTROL_TIMEOUT;
      if(cancel || isBlocked())return;
      const target=resolveDrop(latest.current.targets,g.point);
      if(target){
        if(townLive.live){
          townLive.intent('drop',{attraction_id:target.id});
          if(target.id==='home') window.dispatchEvent(new Event('village-enter-home'));
          if(target.id==='shop' || target.id==='farm_store') latest.current.onShop(target.id==='farm_store'?'farm':undefined);
          return;
        }
        activate();player.activity=target;player.until=now()+ACTIVITY_SECONDS;player.label=target.label;
        [motion.x,motion.z]=target.point;motion.tx=motion.x;motion.tz=motion.z;
        motion.activity=target.activity==='ride'?'sit':target.activity==='pet'?'kneel':target.activity;
        if(target.id==='home') window.dispatchEvent(new Event('village-enter-home'));
        if(target.id==='shop' || target.id==='farm_store') latest.current.onShop(target.id==='farm_store'?'farm':undefined);
        if(target.activity==='ride'){
          // Board whichever upright cabin is nearest the bottom, then remain its child for two revolutions.
          const angle=clock.elapsedTime*WHEEL_SPEED;
          const cabin=((Math.round(-angle/(Math.PI/5))%10)+10)%10;
          const object=scene.getObjectByName(`ride-cabin:${cabin}`);
          if(object){player.ride={start:clock.elapsedTime,target,cabin};player.label='Riding Ferris wheel';setAnchor(object);}
        }
      } else if(g.point) {
        const path=groundRoute(town,graph,g.origin,g.point);
        if(path.length){player.destination=g.point;motion.path=path;[motion.tx,motion.tz]=motion.path.shift()!;player.label='Walking';}
      }
    };
    // Let pointerup reach the scene so its drag/pointer bookkeeping also clears.
    const up=(e:PointerEvent)=>{if(gesture?.id!==e.pointerId)return;const picked=gesture.picked; if(picked){const over=document.elementFromPoint(e.clientX,e.clientY);gesture.point=over?.closest('.scene') && !over.closest('.camera-hint,.player-hint') ? ground(e) : null;}finish(false);if(!picked){canvas.dispatchEvent(new CustomEvent('village-player-select'));}};
    const cancel=()=>finish(true);cancelGesture.current=cancel;
    const clear=()=>{keys.current.clear();cancel();};
    const perform=(kind:Emote)=>{if(isBlocked() || player.dragging)return;if(townLive.live){townLive.intent('emote',{kind});return;}leaveRide();activate();player.activity=null;player.destination=null;motion.activity='wander';player.emote={kind,start:now()};player.label=emoteLabels[kind];};
    const touchEmote=(e:Event)=>{const kind=(e as CustomEvent).detail; if(['wave','cheer','spin'].includes(kind))perform(kind);};
    root.addEventListener('village-emote',touchEmote);
    const keydown=(e:KeyboardEvent)=>{
      if(!acceptsKey(e,isBlocked(),editingElement(e.target)))return;
      if(e.code==='KeyC' && !e.shiftKey)return;
      e.preventDefault();
      if(e.code==='KeyC'){if(!e.repeat)player.follow=!player.follow;return;}
      const emote=emoteKey(e.code);if(emote){if(!e.repeat)perform(emote);return;}
      keys.current.add(e.code);
    };
    const keyup=(e:KeyboardEvent)=>{keys.current.delete(e.code);};
    const click=(e:MouseEvent)=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}};
    const visibility=()=>{if(document.hidden)clear();};
    root.addEventListener('pointerdown',down,true);window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);
    root.addEventListener('click',click,true);window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',visibility);
    return ()=>{root.removeEventListener('village-emote',touchEmote);clear();player.emote=null;player.active=false;player.ride=null;player.activity=null;player.destination=null;root.removeEventListener('pointerdown',down,true);window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);root.removeEventListener('click',click,true);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);};
  },[owned,gl,camera,scene,clock,controls,motion,player,town,graph]);
  useEffect(()=>{if(blocked){keys.current.clear();cancelGesture.current();}},[blocked]);
  const frame=(dt:number)=>{
    if(!owned)return false;
    const time=now();
    player.moving=false; player.running=false;
    if(player.emote && time-player.emote.start>=EMOTE_SECONDS)player.emote=null;
    if(!blocked && !editingElement(document.activeElement) && !player.dragging){
      const input=movement(keys.current);
      if(input[0]||input[1]){
        player.emote=null;
        leaveRide();activate();player.activity=null;player.destination=null;player.label='Walking';
        // Screen-relative movement follows the camera's ground-plane orientation.
        const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);right.y=0;right.normalize();
        const forward=new THREE.Vector3(-right.z,0,right.x);
        const speed=(keys.current.has('ShiftLeft')||keys.current.has('ShiftRight'))?7:3.5;
        player.running=speed===7;
        const delta:XY=[(right.x*input[0]+forward.x*input[1])*speed*dt,(right.z*input[0]+forward.z*input[1])*speed*dt];
        const previous:XY=[motion.x,motion.z];[motion.x,motion.z]=moveGround(town,previous,delta);
        player.moving=Math.hypot(motion.x-previous[0],motion.z-previous[1])>.0001;
        motion.tx=motion.x;motion.tz=motion.z;motion.activity='wander';
        if(player.moving && group.current)group.current.userData.heading=Math.atan2(delta[0],delta[1]);
      }
    }
    if(!townLive.live && player.ride && rideTimeline(clock.elapsedTime-player.ride.start).done){leaveRide();player.activity=null;player.until=time;}
    if(player.destination && !player.dragging){
      let dx=motion.tx-motion.x,dz=motion.tz-motion.z,d=Math.hypot(dx,dz);
      if(d<.08 && motion.path.length){[motion.tx,motion.tz]=motion.path.shift()!;dx=motion.tx-motion.x;dz=motion.tz-motion.z;d=Math.hypot(dx,dz);}
      if(d>.08){const step=Math.min(d,dt*3.5);[motion.x,motion.z]=moveGround(town,[motion.x,motion.z],[dx/d*step,dz/d*step]);player.moving=true;player.until=time+CONTROL_TIMEOUT;if(group.current)group.current.userData.heading=Math.atan2(dx,dz);}
      else{player.destination=null;player.label=null;}
    }
    if(player.active && !player.dragging && !player.ride && time>=player.until){player.active=false;player.activity=null;player.label=null;}
    if(player.active && !player.dragging && !player.ride && !player.activity && !player.destination && !player.moving)player.label=player.emote?emoteLabels[player.emote.kind]:'Taking a break';
    return player.active;
  };
  const syncAvatar=(state:AvatarState|undefined)=>{
    const cabin=state?.mode==='attraction' && state.attraction_id==='ferris_wheel' ? scene.getObjectByName(`ride-cabin:${state.slot}`)??null : null;
    if(anchor!==cabin)setAnchor(cabin);
  };
  return {frame,syncAvatar,anchor:townLive.live ? anchor : owned && player.ride ? anchor : null,suppressClick};
}
