import { Portrait } from './shared';
import type { Villager } from '../api/types';
import type { LocationPerson, LocationSpot } from '../scene/locationCloseup';
import './locationCloseup.css';
export function LocationCloseup({spot,people,villagers,onBack,onSelect}:{spot:LocationSpot;people:LocationPerson[];villagers:Villager[];onBack:()=>void;onSelect:(id:string)=>void}) {
  return <aside className="location-closeup" aria-label={`${spot.name} close-up`} data-testid="location-closeup">
    <div><h2>{spot.name}</h2><button className="button secondary" onClick={onBack}>Back to town</button></div>
    <p>{people.length ? `${people.length} here now` : 'A quiet moment here'}</p>
    <ul>{people.map(p=>{const person=villagers.find(v=>v.user_id===p.id);return person && <li key={p.id}><button onClick={()=>onSelect(p.id)}><Portrait person={person}/><span>{person.display_name}<small>{p.activity}</small></span></button></li>;})}</ul>
  </aside>;
}
