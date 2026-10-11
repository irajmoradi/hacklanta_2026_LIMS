import { useState } from 'react';
import type { Emote } from './emotes';
import './emotes.css';
import {townLive} from '../api/townLive';
export function EmoteWheel({ disabled, villagers=[] }: { disabled: boolean; villagers?:{id:string;name:string}[] }) {
  const [open, setOpen] = useState(false);
  return <div className="emote-wheel">
    {open && !disabled && <div role="group" aria-label="Choose emote" className="emote-options">
      {([['wave', 'Wave', '1'], ['cheer', 'Cheer', '2'], ['spin', 'Dance spin', '3']] as const).map(([kind, label, key]) =>
        <button key={kind} onClick={event => {
          event.currentTarget.closest('.scene')?.dispatchEvent(new CustomEvent<Emote>('village-emote', { detail: kind }));
          setOpen(false);
        }}>{label}<small>{key}</small></button>)}
      {townLive.live && <><select aria-label="Follow a villager" defaultValue="" onChange={e=>{if(e.target.value)townLive.intent('follow',{user:e.target.value});setOpen(false);}}>
        <option value="" disabled>Follow a villager</option>{villagers.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
      </select><button onClick={()=>{townLive.intent('leave_attraction');setOpen(false);}}>Stop activity</button></>}
    </div>}
    <button className="emote-toggle" disabled={disabled} aria-label="Emotes" aria-expanded={open && !disabled} onClick={() => setOpen(v => !v)}>&#9786;</button>
  </div>;
}
