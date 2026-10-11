import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Item } from '../../scene/interior';
import { door, FLOOR_HEIGHT, inStairwell, interiorPath, stairAt, stairPoint, walkable, type InteriorPosition, type Point } from '../../scene/interiorWalk';

type Flight = {lower:number; progress:number; direction:number};
export function useInteriorWalk({items,floor,floors,paused,onFloor,socket,broadcast}: {
  items:Item[]; floor:number; floors:number; paused:boolean; onFloor:(floor:number)=>void;
  socket:RefObject<WebSocket|null>; broadcast?:(position:InteriorPosition)=>void;
}) {
  const [position,setPosition]=useState<InteriorPosition>({...door,y:floor*FLOOR_HEIGHT,heading:Math.PI,moving:false,running:false,emote:null,floor});
  const state=useRef(position), keys=useRef(new Set<string>()), path=useRef<Point[]>([]), sent=useRef(0), lastPayload=useRef('');
  const flight=useRef<Flight|null>(null), landingLock=useRef<Point|null>(null);
  const options=useRef({items,floor,floors,paused,onFloor,broadcast});
  options.current={items,floor,floors,paused,onFloor,broadcast};
  function shortcut(next:number) {
    flight.current=null;path.current=[];keys.current.clear();
    const landing={x:next ? -3 : 3,z:3};landingLock.current=landing;
    state.current={...state.current,...landing,y:next*FLOOR_HEIGHT,floor:next,moving:false};
    setPosition(state.current);
  }
  useEffect(()=>{if(state.current.floor!==floor && !flight.current) shortcut(floor);},[floor]);
  useEffect(()=>{
    const clear=()=>{keys.current.clear();path.current=[];};
    const start=(direction:number)=>{
      const p=state.current;
      flight.current={lower:p.floor-(direction<0?1:0),progress:direction>0?0:1,direction};
      clear();
    };
    const down=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement;
      if(options.current.paused || !target.closest('[data-interior-walk]') || target.closest('button,input,textarea,select,[contenteditable=true]')) return;
      const key=e.key.toLowerCase();
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e'].includes(key)) {
        e.preventDefault();path.current=[];
        if(key==='e') {
          const stair=stairAt(state.current,state.current.floor,options.current.floors,1);
          if(stair && !e.repeat && !flight.current && Math.hypot(state.current.x-stair.x,state.current.z-stair.z)<.12) {landingLock.current=null;start(stair.direction);}
          else if(stair && !e.repeat && !flight.current) {landingLock.current=null;path.current=interiorPath(state.current,stair,options.current.items,state.current.floor,options.current.floors>1);}
        } else keys.current.add(key);
      }
    };
    const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown',down,true);window.addEventListener('keyup',up,true);
    window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
    let last=performance.now();
    const timer=setInterval(()=>{
      const now=performance.now(), dt=Math.min((now-last)/1000,.08);last=now;
      const o=options.current, p={...state.current};p.moving=false;
      if(o.paused) clear();
      else if(flight.current) {
        const f=flight.current;
        f.progress=Math.max(0,Math.min(1,f.progress+f.direction*dt*2.5/6));
        Object.assign(p,stairPoint(f.lower,f.progress),{floor:f.lower,heading:f.direction>0?-Math.PI/2:Math.PI/2,moving:true});
        if(f.progress===0 || f.progress===1) {
          p.floor=f.lower+(f.progress===1?1:0);flight.current=null;landingLock.current={x:p.x,z:p.z};
          o.onFloor(p.floor);
        }
      } else {
        const k=keys.current;
        let dx=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft'));
        let dz=Number(k.has('s')||k.has('arrowdown'))-Number(k.has('w')||k.has('arrowup'));
        const next=path.current[0];
        if(next) {dx=next.x-p.x;dz=next.z-p.z;}
        const length=Math.hypot(dx,dz), step=Math.min(2.5*dt,next?length:Infinity);
        if(length) {
          const n={x:p.x+dx/length*step,z:p.z+dz/length*step};
          if(walkable(n,o.items,p.floor) && (o.floors===1 || !inStairwell(n))) {Object.assign(p,n);p.heading=Math.atan2(dx,dz);p.moving=true;}
          else path.current=[];
          if(next && length<=step+.001) path.current.shift();
        }
        p.y=p.floor*FLOOR_HEIGHT;
        if(landingLock.current && Math.hypot(p.x-landingLock.current.x,p.z-landingLock.current.z)>.65) landingLock.current=null;
        const stair=stairAt(p,p.floor,o.floors,.12);
        if(stair && p.moving && !landingLock.current) {state.current=p;start(stair.direction);}
      }
      const previous=state.current;
      state.current=p;
      if(p.x!==previous.x || p.z!==previous.z || p.y!==previous.y || p.floor!==previous.floor || p.heading!==previous.heading || p.moving!==previous.moving) setPosition(p);
      const payload=JSON.stringify({type:'movement',...p});
      if(now-sent.current>=120 && (payload!==lastPayload.current || now-sent.current>=1000)) {
        if(socket.current?.readyState===1) socket.current.send(payload);
        o.broadcast?.(p);sent.current=now;lastPayload.current=payload;
      }
    },40);
    return()=>{clearInterval(timer);window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up,true);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};
  },[socket]);
  return {position,shortcut,walkTo:(p:Point)=>{
    if(!options.current.paused && !flight.current) {
      const stair=stairAt(p,state.current.floor,options.current.floors,.12);
      if(stair && Math.hypot(state.current.x-p.x,state.current.z-p.z)<.12) {
        flight.current={lower:state.current.floor-(stair.direction<0?1:0),progress:stair.direction>0?0:1,direction:stair.direction};
        return;
      }
      path.current=interiorPath(state.current,p,options.current.items,state.current.floor,options.current.floors>1);
    }
  }};
}
