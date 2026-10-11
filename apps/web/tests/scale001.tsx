import {createRoot} from 'react-dom/client';
import {VillageScene} from '../src/scene/VillageScene';
import {api} from '../src/api/client';
import {WeekPanel} from '../src/components/WeekPanel';
import {monday} from '../src/api/fixtures';
import type {Profile, WeekState} from '../src/api/types';
import '../src/styles.css';

// Playwright supplies the real scratch API's serialized village. No live requests.
api.mode = 'mock';
const village = await (await fetch('/scale001-data')).json();
api.user = village.villagers[0].user_id;
const avatar = api.avatar.bind(api);
api.avatar = uid => {
  document.body.dataset.avatarRequests=String(Number(document.body.dataset.avatarRequests??0)+1);
  return avatar(uid);
};
const noop = () => {};
const review = new URLSearchParams(location.search).has('review');
const week: WeekState = {id:'scale-week',village_id:village.id,week_start:monday(),status:'open',
  auditor_id:null,winner_id:null,finalized_at:null,generation:0,votes:0,stars:[],
  goals:village.villagers.map((p:Profile['villager'])=>({id:`goal-${p.user_id}`,user_id:p.user_id,title:'Synthetic goal',detail:null,week_start:monday(),status:'active',excluded:false,grade:null,suggestion:null}))};
api.week=async()=>week;
api.profile=async(_vid,uid)=>{
  document.body.dataset.profileRequests=String(Number(document.body.dataset.profileRequests??0)+1);
  return {villager:village.villagers.find((p:Profile['villager'])=>p.user_id===uid),goal:null,past_goals:[],check_ins:[]};
};
createRoot(document.getElementById('root')!).render(review ? <WeekPanel village={village} onClose={noop} refresh={async()=>{}} onWeek={noop} celebrate={noop}/> : <main style={{height:'100vh'}}>
  <VillageScene village={village} selected={null} currentUser={api.user}
    onSelect={noop} onShop={noop} onMayor={noop} onGazette={noop} onReading={noop}/>
</main>);
