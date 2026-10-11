import {createRoot} from 'react-dom/client';
import {HeadChorus} from '../src/components/HeadStudio';
import {api} from '../src/api/client';
import {makeFixtures,DEMO_USER_ID} from '../src/api/fixtures';
import '../src/styles.css';
api.mode='mock';api.user=DEMO_USER_ID;
const {village}=makeFixtures();village.villagers=village.villagers.slice(0,3);
for(const p of village.villagers)p.avatar.portrait={kind:'initials'};
const query=new URLSearchParams(location.search);
if(query.has('live'))village.villagers[0].avatar.portrait={kind:'lam_head',head_package_url:'/api/assets/synthetic/avatar.zip'};
const members=village.villagers.map((p,i)=>({id:String(i),user_id:p.user_id,text:'Tiny village. Enormous sandwich energy.',audio_url:'/heads-demo.wav',expr_url:null,cached:true,video_url:query.has('offline')?null:'/tests/chorus-synthetic.mp4',status:query.has('offline')?'unavailable':query.has('late')?'pending':'ready'}));
let posts=0,polls=0;
api.request=async(method,path,body)=>{
 if(path==='/heads/presets')return {presets:[{id:'0',text:members[0].text}]} as any;
 if(path.endsWith('/villagergrams/options'))return {members:village.villagers.map(p=>({id:p.user_id,allow_voice_by_friends:true}))} as any;
 if(path==='/heads/chorus'){(window as any).posts=++posts;return {members:members.map(m=>({...m,video_url:m.status==='pending'?null:m.video_url}))} as any;}
 if(path.startsWith('/heads/chorus/')){(window as any).polls=++polls;return {...members[Number(path.split('/').at(-1))],status:'ready'} as any;}
 throw Error('Unexpected request '+path);
};
createRoot(document.getElementById('root')!).render(<main style={{padding:24}}><HeadChorus village={village}/></main>);
