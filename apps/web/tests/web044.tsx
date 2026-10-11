import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import {VillageScene} from '../src/scene/VillageScene';
import {makeFixtures,DEMO_USER_ID} from '../src/api/fixtures';
import {api} from '../src/api/client';
import '../src/styles.css';
api.mode='mock';api.user=DEMO_USER_ID;
const {village}=makeFixtures();village.villagers=village.villagers.slice(0,5);
const guest=structuredClone(village.villagers[0]);guest.user_id='00000000-0000-4000-8000-000000000006';guest.display_name='Rowan';guest.avatar.user_id=guest.user_id;village.villagers.push(guest);
village.active_events=[];village.world={xp:0,next_level_xp:null,unlocked:[],upcoming:[],...village.world,level:99,time_of_day:'afternoon',weather:'clear'};
village.villagers.forEach((p,i)=>{p.house_slot=i;p.idle_activity='home';});
if(new URLSearchParams(location.search).has('crowded')) for(let i=6;i<32;i++){const p=structuredClone(guest);p.user_id=`crowd-${i}`;p.avatar.user_id=p.user_id;p.display_name=`Guest ${i}`;p.house_slot=100+i;village.villagers.push(p);}
// Freeze the schedule, not animation time. All six cafe guests share this cohort.
Date.now=()=>new Date('2026-10-10T12:07:10Z').getTime();
const baselinePath='/tests/web044BaselineVillageScene.tsx';
const Scene=new URLSearchParams(location.search).has('baseline')?(await import(/* @vite-ignore */ baselinePath)).VillageScene:VillageScene;
function Fixture(){const [selected,setSelected]=useState<string|null>(null);useEffect(()=>{const open=()=>setSelected('hall');window.addEventListener('village-open-hall',open);return()=>window.removeEventListener('village-open-hall',open);},[]);return <div style={{height:'100vh'}}><Scene onReading={()=>setSelected('reading')} onLocationOpen={()=>setSelected(null)} village={village} selected={selected} onSelect={setSelected} onShop={()=>setSelected('shop')} onMayor={()=>setSelected('mayor')} onGazette={()=>setSelected('gazette')}/>{selected && <button style={{position:'fixed',top:0,zIndex:100}} onClick={()=>setSelected(null)} data-testid="profile">Profile {selected}</button>}</div>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
