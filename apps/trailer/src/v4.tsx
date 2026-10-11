import React,{useEffect,useState} from 'react';
import {AbsoluteFill,Audio,Img,OffthreadVideo,Sequence,cancelRender,continueRender,delayRender,interpolate,staticFile,useCurrentFrame} from 'remotion';
import {Pipeline} from './pipeline';
import {Words} from './trailer';
export const main=[0,3,6,32,39,47,54,61,67,73,81,90,94];
export const social=[0,1,2,14,17,20,23,26,29,32,35,37,39];
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const scenes=[
 {tag:'THE PROBLEM',title:'Group chats go quiet.',caption:'Friends drift. Making plans becomes the hardest part.',shots:[]},
 {tag:'MEET VILLAGE',title:'A reason to show up.',caption:'AI that gets your people together.',shots:['town']},
 {tag:'YOUR FACE. YOUR VOICE.',title:'That’s actually you.',caption:'',shots:[]},
 {tag:'SHARED GOALS',title:'Show up for each other.',caption:'Group challenges + daily check-ins earn collective XP.',shots:['checkin','goals','colosseum','growth']},
 {tag:'GROW TOGETHER',title:'Unlock the town together.',caption:'Collective XP → village levels → new buildings, including the Pet Shelter.',shots:['growth-unlock']},
 {tag:'REPAIR TOGETHER',title:'Save it together.',caption:'Shelter closed. Everyone’s check-ins fill the repair bar. Rebuild together.',shots:['disaster-repair']},
 {tag:'LITTLE COMPANIONS',title:'A friend for your friend.',caption:'Unlock the Shelter. Preview an adoption. Walk with your companion.',shots:['shelter','pets','synced-walking']},
 {tag:'HUNYUAN3D / OBJECTS',title:'Make your world yours.',caption:'Existing generated plant → textured mesh → a prop in your home.',shots:['object-turntable','object-room']},
 {tag:'LIVE, SHARED SPACES',title:'Your home. Our town.',caption:'Decorate your house and Community Hall. A saved edit appears in both browsers.',shots:['house-sync','hall-decor']},
 {tag:'GEMINI + PHOTON',title:'The nudge leaves the screen.',caption:'The frosted Mayor in the plaza. A real delivered Iraj video gram over iMessage.',shots:['mayor','imessage']},
 {tag:'A PERSISTENT WORLD',title:'Life goes on here.',caption:'Routines, homes, pets, goals. A persistent, lived-in world.',shots:['routines','friends','shop','wardrobe','farm','reading','review','competition','gazette']},
 {tag:'VILLAGE',title:'Get your people together.',caption:'Your people. One living village.',shots:[]},
];
function DeliveredMessage({square}:{square:boolean}){
 const [data,setData]=useState<any>(null);const [handle]=useState(()=>delayRender('Delivered message provenance'));
 useEffect(()=>{fetch(staticFile('captures/message-display.json')).then(r=>{if(!r.ok)throw Error('Missing real message');return r.json()}).then(d=>{setData(d);continueRender(handle)}).catch(cancelRender)},[handle]);
 if(data?.media)return data.media.endsWith('.png')?<Img src={staticFile(data.media)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<OffthreadVideo muted src={staticFile(data.media)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>;
 return <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:50,background:'#dfe8df',color:'#112a20',padding:24}}>
 <div style={{width:square?440:470,height:'100%',background:'#fafafa',border:'8px solid #31463d',borderRadius:45,padding:'24px 25px',overflow:'hidden'}}>
 <div style={{textAlign:'center',fontSize:22,fontWeight:700,borderBottom:'1px solid #ddd',paddingBottom:15}}>Village Mayor ›<div style={{fontSize:15,color:'#777',marginTop:7}}>iMessage · delivered video gram</div></div>
 <div style={{fontSize:13,textAlign:'center',color:'#777',marginTop:12}}>October 10 · 2:48 PM</div>
 <div style={{background:'#e9e9eb',padding:15,borderRadius:20,marginTop:16,fontSize:19,lineHeight:1.3}}>{data?.text}</div>
 <OffthreadVideo muted src={staticFile('captures/talk.mp4')} style={{display:'block',height:square?185:225,width:'100%',objectFit:'contain',background:'#17251f',borderRadius:16,marginTop:10}}/>
 <p style={{fontSize:15,textAlign:'center',marginTop:10}}>Frame reconstructed from sent outbox data</p>
 </div>
 {!square&&<div style={{maxWidth:470}}><div className="eyebrow" style={{color:'#365e45'}}>REAL DELIVERED CONTENT</div><h2 style={{fontSize:43,letterSpacing:-1}}>Your villager can send a video gram.</h2><p style={{fontSize:25,lineHeight:1.5,marginTop:20}}>Iraj’s actual sent message and cached AI voice video.</p><p style={{fontSize:20,lineHeight:1.5,marginTop:28}}>iMessage frame reconstructed from sent outbox data. No phone screen recording supplied.</p></div>}
 </div>;
}
function Scene({index,square,duration}:{index:number;square:boolean;duration:number}){
 const f=useCurrentFrame(),b=scenes[index];if(index===2)return <Pipeline square={square}/>;
 const shots=square&&index===10?['routines','competition']:b.shots;const length=duration/Math.max(1,shots.length),n=Math.min(shots.length-1,Math.floor(f/length)),shot=shots[n];
 const sandbox=['growth-unlock','disaster-repair','routines'].includes(shot);
 const scratch=['synced-walking','house-sync','hall-decor','object-room'].includes(shot);
 const seconds:Record<string,number>={'synced-walking':3,'house-sync':3,'hall-decor':3,'object-room':3,'object-turntable':6,'growth-unlock':8,'disaster-repair':7};
 const label=sandbox?'DEMO LAB / LOCAL SIMULATION':shot==='object-room'?'GENERATED PROP / SCRATCH HOME':scratch?'TWO LIVE BROWSERS / SCRATCH VILLAGE':shot==='object-turntable'?'EXISTING HUNYUAN3D OUTPUT':shot==='imessage'?'ACTUAL DELIVERED iMESSAGE CONTENT':'PRODUCTION / READ-ONLY CAPTURE';
 const montage:Record<string,string>={routines:'A persistent, lived-in world. Neighbors follow their daily routines.',friends:'Friends + cheers. Keep each other going.',shop:'Earn coins by showing up. Explore the Village Shop.',wardrobe:'Try on a new outfit. Make your villager yours.',farm:'Farm Store: pets, paddocks and farm animals.',reading:'A reading group with a place to gather.',review:'Weekly reviews crown the friend who showed up.',competition:'Friendly competition. Shared Solana devnet incentives.',gazette:'The Gazette turns your week into village history.'};
 return <AbsoluteFill style={{background:'#102b22',padding:50}}>
 <div style={{display:'flex',justifyContent:'space-between',fontSize:18,letterSpacing:3,color:'#bfd1b9'}}><span>village<span style={{color:'#e9ff75'}}>●</span></span><span>{String(index+1).padStart(2,'0')} / 12</span></div>
 <div style={{position:'absolute',left:60,right:50,top:square?105:100}}><div className="eyebrow" style={{marginBottom:15}}>{b.tag}</div><Words text={b.title} f={f} size={square?70:85}/></div>
 {shot&&<div style={{position:'absolute',left:60,right:60,top:square?330:270,bottom:155,borderRadius:24,overflow:'hidden',border:'1px solid #bcd0b64d',background:'#1b352b'}}>
 <Sequence from={Math.round(n*length)} durationInFrames={Math.ceil(length)}>{shot==='imessage'?<DeliveredMessage square={square}/>:<OffthreadVideo muted playbackRate={seconds[shot]?seconds[shot]*60/length:1} src={staticFile(`captures/${shot}.mp4`)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>}</Sequence>
 <div style={{position:'absolute',top:15,left:18,background:'#0b241fec',color:'#e9ff75',padding:'8px 12px',borderRadius:8,fontSize:square?16:18,letterSpacing:1}}>{label}</div>
 {shot==='synced-walking'&&<div style={{position:'absolute',bottom:10,left:20,right:20,textAlign:'center',background:'#102b22e8',padding:8,fontSize:20}}>Same villager, synchronized movement · fixture pet follows its owner</div>}
 {index===8&&<div style={{position:'absolute',bottom:10,left:20,right:20,textAlign:'center',background:'#102b22e8',padding:10,fontSize:square?19:24}}>TigerData: live house state · LISTEN/NOTIFY · scratch Postgres capture</div>}
 {shot==='competition'&&<div style={{position:'absolute',bottom:10,left:20,right:20,textAlign:'center',background:'#102b22e8',padding:10,fontSize:20}}>Solana devnet · test assets · stake intent ≠ payment</div>}
 </div>}
 {index===0&&<div style={{position:'absolute',top:400,left:square?120:420,right:square?120:420}}>{['We should hang soon.','Next week?','…'].map((text,i)=><div key={text} style={{margin:'18px 0',marginLeft:i*45,padding:25,borderRadius:24,background:i===2?'#e9ff75':'#29493a',color:i===2?'#102b22':'#dbe7d6',fontSize:42,opacity:interpolate(f,[i*12,i*12+15],[0,1],clamp)}}>{text}</div>)}</div>}
 {index===11&&<div style={{position:'absolute',top:350,left:60,right:60,textAlign:'center'}}><Words text="Village." f={f} size={square?170:190}/><p style={{fontSize:square?29:37,marginTop:40,color:'#c1d1bd'}}>Gemini · ElevenLabs · SAM 3 · LAM · Hunyuan3D<br/>Photon iMessage · TigerData · Solana devnet<br/>Modal · Vultr · Auth0</p><div style={{display:'inline-block',marginTop:55,padding:'22px 30px',borderRadius:18,background:'#e9ff75',color:'#102b22',fontSize:square?34:45,fontWeight:700}}>thefriendshipvillage.vodka</div></div>}
 <div style={{position:'absolute',bottom:25,left:50,right:50,height:105,display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',fontSize:square?28:31,lineHeight:1.3}}>{index===10?montage[shot]:b.caption}</div>
 </AbsoluteFill>;
}
export function Trailer({square}:{square:boolean}){
 const [handle]=useState(()=>delayRender('Bundled fonts'));useEffect(()=>{Promise.all([document.fonts.load('800 96px Manrope'),document.fonts.load('400 31px "DM Sans"')]).then(()=>continueRender(handle)).catch(cancelRender)},[handle]);
 const f=useCurrentFrame(),times=square?social:main,total=times.at(-1)!*60;
 return <AbsoluteFill className="film"><style>{`@font-face{font-family:Manrope;src:url("${staticFile('fonts/Manrope.ttf')}");font-weight:200 800}@font-face{font-family:'DM Sans';src:url("${staticFile('fonts/DMSans.ttf')}");font-weight:100 1000}`}</style>
 <Audio loop src={staticFile('audio/village-original.wav')} playbackRate={1.15} volume={v=>(v>=(square?8.8:21)*60&&v<(square?14:32)*60?.09:.55)*interpolate(v,[0,20,total-60,total],[0,1,1,0],clamp)}/>
 {times.slice(0,-1).map((start,i)=><Sequence key={i} from={start*60} durationInFrames={(times[i+1]-start)*60}><Scene index={i} square={square} duration={(times[i+1]-start)*60}/></Sequence>)}
 <div style={{position:'absolute',bottom:0,left:0,height:5,background:'#e9ff75',width:`${100*f/(total-1)}%`}}/>
 </AbsoluteFill>;
}
