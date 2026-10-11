import {createRoot} from 'react-dom/client';
import {HeadChorus,HeadStudio} from '../src/components/HeadStudio';
import {MockApi} from '../src/api/mock';
import {api} from '../src/api/client';
import {makeFixtures,DEMO_USER_ID} from '../src/api/fixtures';
import '../src/styles.css';
api.mode='mock';api.user=DEMO_USER_ID;
const {village}=makeFixtures();
village.villagers[0].avatar.portrait={kind:'lam_head',head_package_url:'/api/assets/synthetic/avatar.zip'};
const backend=new MockApi();
await backend.request('PATCH','/me',village.villagers[1].user_id,{allow_voice_by_friends:true});
const request=<T,>(method:string,path:string,body?:unknown)=>backend.request<T>(method,path,DEMO_USER_ID,body);
api.request=async (method,path,body)=>{if(path==='/heads/chorus'){
 const members=[];let text=(body as any).text;
 for(const p of village.villagers.slice(0,2)){
  const result=await api.request<any>('POST',`/heads/${p.user_id}/say`,text?{text}:{preset_id:(body as any).preset_id});text=result.text;
  members.push({...result,user_id:p.user_id,video_url:null,status:'unavailable'});
 }return {members} as any;
}if(method==='POST'&&path.endsWith('/say')){(window as any).said??=[];(window as any).said.push({path,body});}if(path.endsWith('/villagergrams/options'))return {members:village.villagers.map((p,i)=>({id:p.user_id,allow_voice_by_friends:i<2}))} as any;return request(method,path,body);};
const start=AudioBufferSourceNode.prototype.start;
AudioBufferSourceNode.prototype.start=function(...args){(window as any).starts??=[];(window as any).starts.push({time:performance.now(),ready:!!document.querySelector('[data-head-state="ready"]'),fallback:!!document.querySelector('[data-fallback="true"]')});return start.apply(this,args);};
createRoot(document.getElementById('root')!).render(<main style={{padding:24}}>{location.search.includes('profile')?<div className="profile-panel"><HeadStudio people={[village.villagers[0]]} vid={village.id}/></div>:<HeadChorus village={village}/>}</main>);
