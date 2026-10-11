import type {AvatarState} from '../api/overworld';
import type {DropTarget} from './playerControl';
import {CAFE_SEATS} from './layout/cafeSeats';
import {STUDY_SEATS} from './layout/studySeats';
import {BENCH_SEATS} from './layout/benchSeats';

/** Tentative allocation only; the authoritative reducer resolves contention. */
export function predictIntent(previous:AvatarState, action:string, fields:Record<string,unknown>, targets:DropTarget[], avatars:Iterable<AvatarState>, now:number):AvatarState|undefined {
  const base:AvatarState={user_id:previous.user_id,seq:previous.seq,since:now,mode:'idle',x:previous.x,z:previous.z,heading:previous.heading,activity:'wander',until:now+20};
  if(action==='emote')return {...base,mode:'emote',emote:fields.kind as AvatarState['emote'],until:now+3};
  if(action==='leave_attraction')return base;
  if(!['drop','sit','join_attraction'].includes(action))return;
  const seat=typeof fields.seat_id==='string'?fields.seat_id:undefined;
  const id=seat?seat.slice(0,seat.lastIndexOf(':')):fields.attraction_id;
  const target=targets.find(t=>t.id===id);if(!target)return;
  if(id==='home')return {...base,mode:'home',x:target.point[0],z:target.point[1]};
  const seats=id==='storefront_cafe'?CAFE_SEATS:id==='study_nook'?STUDY_SEATS:id==='fountain'?BENCH_SEATS:undefined;
  const capacity=seats?.length ?? ({ferris_wheel:10,festival_stage:24,fitness_corner:8,mayor_podium:100}[String(id)]??12);
  const occupied=new Set([...avatars].filter(s=>s.user_id!==previous.user_id && s.attraction_id===id).map(s=>s.slot));
  const slot=seat?Number(seat.slice(seat.lastIndexOf(':')+1)):Array.from({length:capacity},(_,i)=>i).find(i=>!occupied.has(i));
  if(slot===undefined || !Number.isInteger(slot) || slot<0 || slot>=capacity)return;
  let [x,z]=target.center, heading=0;
  if(seats){x+=seats[slot].offset[0];z+=seats[slot].offset[1];heading=seats[slot].yaw;}
  else if(id==='festival_stage'){x+=(slot%6-2.5)*1.25;z+=1+Math.floor(slot/6)*1.1;}
  else if(id==='fitness_corner'){x+=-3+(slot%4)*2;z+=3+Math.floor(slot/4)*2;}
  else if(id==='mayor_podium'){x+=(slot%10-4.5)*1.1;z+=4+Math.floor(slot/10)*.8;}
  else z+=target.activity==='kneel'||target.activity==='pet'?3:6;
  return {...base,mode:seats?'seated':'attraction',x,z,heading,attraction_id:String(id),slot,seat_id:seats?`${id}:${slot}`:null,
    activity:target.activity==='ride'?'sit':target.activity==='pet'?'kneel':target.activity,elevation:target.elevation??0,
    until:now+(id==='ferris_wheel'?4*Math.PI/.12:120)};
}
