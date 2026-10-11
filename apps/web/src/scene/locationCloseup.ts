import { createContext, useContext, useEffect, useRef } from 'react';
export type LocationSpot = { id:string; name:string; center:[number,number] };
export type LocationPerson = {id:string; activity:string};
export const LocationContext = createContext<{open:(spot:LocationSpot)=>void;close:()=>void;active:string|null}>({open:()=>{},close:()=>{},active:null});
/** Delay only pointer single-clicks; keyboard activation remains immediate. */
export function useLocationClick() {
  const {open,close,active} = useContext(LocationContext);
  const pending = useRef<{id:string;time:number;timer:ReturnType<typeof setTimeout>} | null>(null);
  useEffect(()=>()=>{if(pending.current)clearTimeout(pending.current.timer);},[]);
  return (spot:LocationSpot, single:()=>void, keyboard=false, double=false) => {
    const activate=()=>{if(active && active!==spot.id)close();single();};
    if(keyboard){activate();return;}
    const previous=pending.current;
    if(previous) clearTimeout(previous.timer);
    if(double || previous?.id===spot.id && performance.now()-previous.time<350){pending.current=null;open(spot);return;}
    pending.current={id:spot.id,time:performance.now(),timer:setTimeout(()=>{pending.current=null;activate();},350)};
  };
}
