import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Villager, Village } from '../api/types';
import { Dialog, errorText, mediaUrl, Portrait } from './shared';
import type { HeadVoice } from './GaussianHead';
import { pollExpression } from './voiceMotion';
import { clockedVoice, placeholderFace, waitForFaces, type FaceState } from './headPlayback';
import { VillageIcon } from './VillageIcon';
import './HeadStudio.css';
import { ChorusVideo } from './ChorusVideo';
type ChorusMember = Line & {user_id:string; video_url:string|null; status:string; error?:string};
type Line = {id:string; text:string; audio_url:string; expr_url:string|null; cached:boolean};
type Member = {id:string; allow_voice_by_friends:boolean};
export function HeadStudio({people, vid, chorus = false, externalVoice, onStart, onBusyChange}: {people:Villager[]; vid:string; chorus?:boolean; externalVoice?:HeadVoice; onStart?:()=>void; onBusyChange?:(busy:boolean)=>void}) {
  const [presets,setPresets] = useState<{id:string;text:string}[]>([]), [members,setMembers] = useState<Member[]>([]);
  const [choice,setChoice] = useState('0'), [custom,setCustom] = useState(''), [status,setStatus] = useState('');
  const [busy,setBusy] = useState(false), [active,setActive] = useState(''), [voice,setVoice] = useState<HeadVoice>();
  const [line,setLine] = useState(''), [word,setWord] = useState(-1), [fallback,setFallback] = useState<Set<string>>(new Set());
  const [clips,setClips] = useState<Record<string,ChorusMember>>({});
  const [ensemble,setEnsemble] = useState(false);
  const [states,setStates] = useState<Record<string,FaceState>>({});
  const readiness = useRef<Record<string,FaceState>>({}), cancel = useRef(()=>{}), run = useRef(0);
  const eligible = (p:Villager) => !placeholderFace(p) && (p.user_id === api.user || members.some(m=>m.id===p.user_id && m.allow_voice_by_friends));
  const speakers = people.filter(eligible), quiet = people.filter(p=>!eligible(p));
  const state = (id:string):FaceState => readiness.current[id] ?? 'loading';
  useEffect(()=>{onBusyChange?.(busy);return ()=>onBusyChange?.(false);},[busy,onBusyChange]);
  useEffect(()=>{let alive=true; void Promise.all([api.request<{presets:typeof presets}>('GET','/heads/presets'),api.request<{members:Member[]}>('GET',`/villages/${vid}/villagergrams/options`)]).then(([p,m])=>{if(alive){setPresets(p.presets);setMembers(m.members);}}).catch(e=>{if(alive)setStatus(errorText(e));});return()=>{alive=false;run.current++;cancel.current();};},[vid,people.map(p=>p.user_id).join(','),api.user]);
  useEffect(() => {
    const controller = new AbortController();
    void api.authHeaders().then(headers => Promise.allSettled(speakers.map(async p => {
      const value = p.avatar.portrait.head_package_url;
      if (!value || !/\.zip(?:\?|$)/i.test(value)) return;
      const url = new URL(value, location.origin);
      if (![location.origin, 'http://localhost:8010', 'http://127.0.0.1:8010'].includes(url.origin) || !url.pathname.startsWith('/api/assets/')) return;
      url.searchParams.set('rev', String(p.avatar.revision));
      await fetch(url.pathname + url.search, {headers, cache:'force-cache', signal:controller.signal});
    }))).catch(() => {});
    return () => controller.abort();
  }, [speakers.map(p => p.user_id + ':' + p.avatar.revision).join(',')]);
  async function speak(all=false, surprise=false, pick?: string) {
    const chosen = pick ?? choice;
    if(busy)return;
    onStart?.(); const current=++run.current; cancel.current();setBusy(true);setClips({});setEnsemble(all);setFallback(new Set());setStatus('Warming up faces…');
    const controller=new AbortController(); let context:AudioContext|undefined, stop=()=>{}, frame=0;
    const cleanup=()=>{controller.abort();stop();cancelAnimationFrame(frame);if(context && context.state!=='closed')void context.close();};cancel.current=cleanup;
    try {
      context=new AudioContext(); await context.resume();
      const cast=all?speakers:speakers.slice(0,1);
      if(!cast.length)throw new Error('No consenting speakers.');
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      const ready=await waitForFaces(speakers.map(p=>p.user_id),state,controller.signal);
      setFallback(new Set(speakers.filter(p=>!ready.has(p.user_id)).map(p=>p.user_id)));
      let sameText=surprise?'':custom.trim();
      let batch:ChorusMember[]|undefined;
      if(all){
        const response=await api.request<{members:ChorusMember[]}>('POST','/heads/chorus',{village_id:vid,member_ids:cast.map(p=>p.user_id),...(sameText?{text:sameText}:{preset_id:surprise?'surprise':chosen})});
        controller.signal.throwIfAborted();batch=response.members;
        setClips(Object.fromEntries(batch.map(m=>[m.user_id,m])));
        for(const member of batch.filter(m=>m.status==='pending'))void (async()=>{
          let current=member;
          for(let attempt=0;attempt<65&&!controller.signal.aborted&&current.status==='pending';attempt++){
            await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,2000);controller.signal.addEventListener('abort',done,{once:true});});
            if(controller.signal.aborted)return;
            current={...current,...await api.request<ChorusMember>('GET',`/heads/chorus/${member.id}`)};
            if(!controller.signal.aborted)setClips(old=>({...old,[member.user_id]:current}));
          }
        })().catch(()=>{});
      }
      let played=0;
      const errors:string[]=[];
      for(const p of cast){
        setStatus(`Preparing ${p.display_name}’s AI voice…`);
        const result=batch?batch.find(m=>m.user_id===p.user_id):await api.request<Line>('POST',`/heads/${p.user_id}/say`,sameText?{text:sameText}:{preset_id:surprise?'surprise':chosen});
        controller.signal.throwIfAborted();if(!result?.audio_url){errors.push(p.display_name);continue;}played++;sameText=result.text;
        const url=await mediaUrl(result.audio_url);
        let buffer:AudioBuffer;
        try{buffer=await context.decodeAudioData(await (await fetch(url,{signal:controller.signal})).arrayBuffer());}finally{if(url.startsWith('blob:'))URL.revokeObjectURL(url);}
        controller.signal.throwIfAborted();
        const playback=clockedVoice(context,buffer);stop=playback.stop;
        setActive(p.user_id);setLine(result.text);setVoice({audio:playback.audio,expr:playback.expr});
        const expression=new AbortController(), signal=AbortSignal.any([controller.signal,expression.signal]);
        if(api.mode!=='mock')void pollExpression(result.expr_url??`/api/assets/avatars/${p.user_id}/voice/${result.id}/line_expr.json`,signal).then(expr=>{if(expr&&!signal.aborted)setVoice({audio:playback.audio,expr});}).catch(()=>{});
        // Let React bind the shared clock and expression track before scheduling sound.
        await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
        controller.signal.throwIfAborted();playback.start();setStatus('AI voice · approximate word timing');
        const tick=()=>{setWord(Math.min(result.text.split(/\s+/).length-1,Math.floor(playback.audio.currentTime/buffer.duration*result.text.split(/\s+/).length)));frame=requestAnimationFrame(tick);};tick();
        await playback.ended;cancelAnimationFrame(frame);expression.abort();controller.signal.throwIfAborted();setVoice(undefined);setActive('');
      }
      setStatus(`${played?'Finished - AI voice. Replay uses the cache.':'No voices available.'}${errors.length?' Unavailable: '+errors.join(', '):''}`);
    }catch(e){if(!controller.signal.aborted)setStatus(errorText(e));}finally{cleanup();if(current===run.current){setBusy(false);setVoice(undefined);setActive('');setWord(-1);}}
  }
  const warming=speakers.filter(p=>(states[p.user_id]??'loading')==='loading').length;
  return <div className="head-studio">
    <div className="chorus-stage"><div className="stage-caption"><VillageIcon name="music" size={16}/> {chorus?'THE VILLAGE, IN HARMONY':'A LITTLE MIC MOMENT'}</div>
      <div className="chorus-row">{speakers.map(p=><article key={p.user_id} data-speaking={active===p.user_id} data-fallback={fallback.has(p.user_id)}>
        <div className="chorus-face"><Portrait person={p} large animate={!fallback.has(p.user_id)} cacheHead voice={active===p.user_id?voice:!chorus?externalVoice:undefined} onHeadState={s=>{if(readiness.current[p.user_id]===s)return;readiness.current[p.user_id]=s;setStates(v=>({...v,[p.user_id]:s}));}}/>{ensemble&&voice&&clips[p.user_id]?.video_url&&!(active===p.user_id&&p.avatar.portrait.kind==='lam_head'&&!fallback.has(p.user_id))&&<ChorusVideo url={clips[p.user_id].video_url!} clock={voice.audio}/>}</div>
        <strong>{p.display_name}</strong><small>{active===p.user_id?'ON THE MIC':ensemble&&voice?'IN THE CHORUS':'Ready for a line'}</small>
        <div className="karaoke">{active===p.user_id?line.split(/\s+/).map((w,i)=><span key={i} data-current={i===word}>{w} </span>):' '}</div>
        {(active===p.user_id||(ensemble&&!!voice))&&<span className="voice-wave" aria-label="Voice playing">{[0,1,2,3,4].map(i=><i key={i} style={{animationDelay:`${i*.12}s`}}/>)}</span>}
      </article>)}</div>
      {!speakers.length&&<p className="stage-empty">The mic is quiet. Friends can opt in to AI voice in Settings.</p>}
      {!!warming&&!fallback.size&&<p className="warming" role="status">Warming up faces… {speakers.length-warming}/{speakers.length}<progress max={speakers.length} value={speakers.length-warming}/></p>}
    </div>
    {!!quiet.length&&<div className="chorus-quiet"><small>Not in the chorus (voice off)</small><div>{quiet.map(p=><span key={p.user_id}><Portrait person={p}/><span>{p.display_name}{placeholderFace(p)&&<small>placeholder face</small>}</span></span>)}</div></div>}
    <div className="line-chips" aria-label="Suggested lines">{presets.slice(0,4).map(p=><button key={p.id} disabled={busy} aria-pressed={!custom&&choice===p.id} onClick={()=>{setChoice(p.id);setCustom('');void speak(false,false,p.id);}}>{p.text}</button>)}</div>
    <label className="custom-line">Make it your own<input aria-label="Your line" maxLength={100} placeholder="Something only your village would say…" value={custom} disabled={busy} onChange={e=>setCustom(e.target.value)}/></label>
    <div className="speech-actions"><button className="button" disabled={busy||!speakers.length||(!presets.length&&!custom.trim())} onClick={()=>void speak()}><VillageIcon name="music"/> Play</button>{chorus&&<button className="button secondary" disabled={busy||!speakers.length||!presets.length} onClick={()=>void speak(true)}><VillageIcon name="chat"/> Everyone says it</button>}<button className="button secondary" disabled={busy||!speakers.length||!presets.length} onClick={()=>void speak(chorus,true)}><VillageIcon name="star"/> Surprise me</button>{busy&&<button className="text-button" onClick={()=>{run.current++;cancel.current();setBusy(false);setVoice(undefined);setActive('');setStatus('Stopped.');}}>Stop</button>}</div>
    <small>AI voice · 10 new lines per day · Cached replays are free</small><p className="speech-status" role="status">{status}</p>
  </div>;
}
export function HeadChorus({village}:{village:Village}){const[open,setOpen]=useState(false);return <><button className="button secondary chorus-entry" onClick={()=>setOpen(true)}><VillageIcon name="music"/> Everyone says it</button>{open&&<Dialog title="The village chorus" eyebrow="AI VOICES" onClose={()=>setOpen(false)} wide><HeadStudio people={village.villagers} vid={village.id} chorus/></Dialog>}</>;}
