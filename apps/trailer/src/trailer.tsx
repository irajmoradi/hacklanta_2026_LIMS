import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, cancelRender, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame} from 'remotion';

export const main = [0,3,6,20,35,41,47,52,56,60];
export const social = [0,1,2,10,18,21,24,26,27,29];
const clamp = {extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const rise=(f:number,d=0)=>spring({fps:60,frame:f-d,config:{damping:24,stiffness:230}});
const beats = [
 {label:'THE PROBLEM',title:'Group chats go quiet.',value:'Friends drift. Making plans becomes the hardest part.',shots:[],tags:[]},
 {label:'MEET VILLAGE',title:'AI that gets your people together.',value:'A living world that gives your group a reason to show up.',shots:['town','cafe'],tags:[]},
 {label:'YOUR FACE. YOUR VOICE.',title:'That’s actually you.',value:'Iraj’s photo becomes a living villager.',shots:[],tags:[]},
 {label:'MAKE IT YOURS',title:'A whole life together.',value:'Show up. Dress up. Build a home. Bring a friend.',shots:['checkin','goals','friends','multiplayer','shop','wardrobe','bottoms','shoes','glasses','shelter','pets','farm','house','house-undo','hall','cafe','reading'],tags:['Daily connection','Your own little world']},
 {label:'THE SOLANA ECONOMY',title:'Compete in public.',value:'Friendly competition. Public accountability. Solana incentives.',shots:['colosseum','competition','review','town'],tags:['Colosseum','Weekly crown','Devnet pot']},
 {label:'GEMINI MAYOR',title:'A Mayor who gets you together.',value:'Nudges. Challenges. A Gazette. Repair the village together.',shots:['mayor','dashboard','gazette','town'],tags:['Gemini creativity','Collective repair']},
 {label:'IRL VIA iMESSAGE',title:'The nudge leaves the screen.',value:'The Mayor texts you. Reply with a photo as evidence.',shots:[],tags:[]},
 {label:'BUILT TO BRING US TOGETHER',title:'One village. A connected stack.',value:'AI creativity. A social economy. Your friends, brought to life.',shots:[],tags:[]},
 {label:'VILLAGE',title:'Get your people together.',value:'Village. Get your people together.',shots:['town'],tags:[]},
];
const shotCaptions:Record<string,string> = {
 multiplayer:'Live multiplayer: two recorded views; presence paused for capture.', checkin:'Daily check-ins turn showing up into a little celebration.', goals:'Weekly goals. Stretch goals. Keep each other going.',
 friends:'Friends hub + cheers. Your wins belong here.', shop:'Step inside the clothing shop.', wardrobe:'Try it on. Make your villager yours.',
 bottoms:'New bottoms. A fresh fit.', shoes:'New shoes. Walk your own way.', glasses:'New glasses. The finishing touch.',
 shelter:'Pet Shelter: meet your next little companion.', pets:'Choose a pet to adopt. Preview only; no purchase.', farm:'Farm Store: pets, paddocks and farm animals.',
 house:'Your home, inside and out. Connected floors + stairs.', 'house-undo':'Decorate together. Undo is always within reach.',
 hall:'Community Hall: a shared space to make your own.', cafe:'Pull up a chair at the café.', reading:'The library keeps your reading group together.',
 colosseum:'Enter the Colosseum. Put your goals on the line.', competition:'A shared Solana devnet pot. Friendly stakes.', review:'Weekly reviews crown the friend who showed up.',
 mayor:'Gemini Mayor: options, nudges and shared challenges.', dashboard:'Your village dashboard. One place for the whole crew.',
 gazette:'The Gazette turns your week into village history.', town:'Disasters give the crew a reason to repair together.'
};
function Pipeline({square}:{square:boolean}) {
 const f=useCurrentFrame(),t=f/60;
 const starts=square?[0,.7,1.4,2.7,3.3,4]:[0,1.5,3,6,8,10];
 const stage=starts.filter(x=>t>=x).length-1;
 const labels=['REAL PHOTO','SAM 3 / SEGMENTATION','LAM / 3D GAUSSIAN SPLAT','HUNYUAN3D / YOUR VILLAGER','YOUR RECORDED VOICE','ELEVENLABS VOICE'];
 const captions=['Start with Iraj’s real photo.','SAM 3 separates the person from the background.','His actual Gaussian-splat head. Drag to rotate.','A stylized head on a walking villager.','Iraj’s original recording becomes his AI voice.','“Video test from the village! Get off your ass and go crush your goals today.”'];
 const visual={position:'absolute' as const,left:square?55:705,top:square?285:105,width:square?970:1100,height:square?655:800,borderRadius:24,overflow:'hidden',background:'#16251f'};
 return <AbsoluteFill style={{background:'#102b22'}}>
 <div style={{position:'absolute',left:60,top:square?50:145,width:square?960:595}}><div className="eyebrow">YOUR FACE. YOUR VOICE.</div><Words text={stage<4?'That’s actually you.':'And you sound like you.'} f={f} size={square?70:100}/>{!square&&<p style={{fontSize:31,lineHeight:1.4,marginTop:36,color:'#c1d1bd'}}>One photo. One voice memo.<br/>A friend you recognize.</p>}</div>
 <div style={visual}>
 {stage===0&&<Img src={staticFile('captures/photo.jpg')} style={{width:'100%',height:'100%',objectFit:'contain',transform:`scale(${1+t*.035})`}}/>}
 {stage===1&&<><Img src={staticFile('captures/segmented.png')} style={{width:'100%',height:'100%',objectFit:'contain'}}/><div style={{position:'absolute',inset:0,background:'#dfff65',opacity:.32,maskImage:`url(${staticFile('captures/mask.png')})`,maskMode:'luminance',maskSize:'contain',maskRepeat:'no-repeat',maskPosition:'center'}}/><div style={{position:'absolute',left:0,right:0,top:`${((t-starts[1])/(starts[2]-starts[1]))*100}%`,height:4,background:'#e9ff75',boxShadow:'0 0 30px #e9ff75'}}/></>}
 {stage===2&&<Sequence from={starts[2]*60}><OffthreadVideo muted playbackRate={square?2.25:1} src={staticFile('captures/head.mp4')} style={{width:'100%',height:'100%',objectFit:'cover',transform:'scale(1.35)'}}/></Sequence>}
 {stage===3&&<Sequence from={starts[3]*60}><OffthreadVideo muted src={staticFile('captures/walking.mp4')} style={{width:'100%',height:'100%',objectFit:'cover',transform:'scale(3.5)'}}/></Sequence>}
 {stage===4&&<><div style={{padding:'130px 50px',textAlign:'center'}}><div style={{fontSize:40,color:'#e9ff75'}}>Iraj’s original voice memo</div><Img src={staticFile('captures/waveform.svg')} style={{width:'100%',height:240,marginTop:30}}/><div style={{fontSize:36}}>Recorded voice → ElevenLabs voice</div></div><Sequence from={starts[4]*60}><Audio src={staticFile('captures/memo.ogg')} volume={.85}/></Sequence></>}
 {stage===5&&<Sequence from={starts[5]*60}><OffthreadVideo src={staticFile('captures/talk.mp4')} volume={1} style={{width:'100%',height:'100%',objectFit:'contain'}}/></Sequence>}
 <div style={{position:'absolute',left:24,bottom:22,background:'#0b211eee',padding:'12px 22px',borderRadius:14,fontSize:square?25:29,color:'#e9ff75'}}>{labels[stage]}{stage===5?' · CACHED AI VOICE':''}</div>
 </div>
 <div style={{position:'absolute',left:square?60:65,top:square?238:640,width:square?960:590,fontSize:square?20:24,lineHeight:1.65,color:'#c1d1bd'}}>SAM 3 · LAM · Audio2Expression{square?' / ':''}<br style={{display:square?'none':'block'}}/> ElevenLabs · Hunyuan3D · Modal GPUs</div>
 <div style={{position:'absolute',left:0,right:0,bottom:0,height:108,background:'#091d18',padding:'18px 50px',fontSize:square?28:32,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>{captions[stage]}</div>
 </AbsoluteFill>;
}
export function Words({text,f,size}:{text:string;f:number;size:number}){return <h1 style={{fontSize:size}}>{text.split(' ').map((w,i)=><span key={i} style={{display:'inline-block',marginRight:'.22em',opacity:rise(f,i*1.5),transform:`translateY(${(1-rise(f,i*1.5))*50}px)`}}>{w}</span>)}</h1>}
function Screen({name,f,square}:{name:string;f:number;square:boolean}){
 return <div style={{position:'absolute',left:square?48:700,top:square?385:165,width:square?984:1160,height:square?554:653,border:'2px solid #c3d8aa66',borderRadius:22,overflow:'hidden',boxShadow:'0 38px 100px #0008',transform:`perspective(2400px) rotateY(${square?0:-2}deg) scale(${1+f*.000035})`}}>
 {name==='multiplayer'?<div style={{display:'flex',width:'100%',height:'100%'}}>{['walking','walking-wide'].map((n,i)=><div key={n} style={{width:'50%',height:'100%',borderRight:'3px solid #e9ff75',position:'relative'}}><OffthreadVideo muted src={staticFile(`captures/${n}.mp4`)} style={{width:'100%',height:'100%',objectFit:'cover'}}/><div style={{position:'absolute',bottom:20,left:20,background:'#102b22',padding:12,fontSize:20}}>Client {i+1} / recorded view</div></div>)}</div>:<OffthreadVideo muted src={staticFile(`captures/${name}.mp4`)} style={{width:'100%',height:'100%',objectFit:'cover'}} />}
 <div style={{position:'absolute',top:14,left:18,fontSize:15,background:'#0c211ddd',padding:'6px 12px',borderRadius:20,letterSpacing:2}}>VILLAGE / PRODUCT CAPTURE</div>
 </div>;
}
function Phone({f,square}:{f:number;square:boolean}){return <div style={{position:'absolute',top:square?298:60,left:square?292:1110,width:496,height:square?655:865,border:'12px solid #324c40',borderRadius:58,background:'#f4f6ef',color:'#172c23',padding:'48px 25px 24px',boxShadow:'0 40px 100px #0007'}}>
 <div style={{position:'absolute',top:13,left:177,width:118,height:23,borderRadius:20,background:'#142c22'}}/>
 <div style={{textAlign:'center',fontWeight:800,fontSize:27}}>Village Mayor<div style={{fontWeight:400,fontSize:19,marginTop:8}}>Photon · iMessage</div></div>
 <div className="bubble" style={{opacity:rise(f,10),fontSize:square?24:29}}>Your crew’s goal: get outside together. Got proof?</div>
 <div className="bubble own" style={{opacity:rise(f,40),fontSize:square?23:27}}><svg viewBox="0 0 320 120" style={{width:'100%',height:square?100:150,borderRadius:12,background:'#acd7bd'}}><circle cx="255" cy="25" r="15" fill="#edff73"/><path d="M0 110 90 20 180 110 245 45 320 110V120H0" fill="#517b5b"/><path d="M120 120 180 60 230 120" fill="#315940"/></svg><div style={{marginTop:8}}>Trail done. Together.</div><small style={{fontSize:16}}>Photo evidence · illustration</small></div>
 <div className="bubble" style={{opacity:rise(f,75),fontSize:square?24:29}}>That’s showing up. Sent for review.</div>
 <div style={{position:'absolute',bottom:19,left:12,right:12,textAlign:'center',fontSize:18}}>Illustrative conversation · no live send</div>
 </div>}
function Scene({index,square,duration}:{index:number;square:boolean;duration:number}){
 const f=useCurrentFrame(),b=beats[index];
 if(index===2)return <Pipeline square={square}/>;
 const titleCard=false;
 const shots=square&&index===3?['checkin','goals','shop','bottoms','shoes','glasses','shelter','pets','hall','reading']:square&&index===4?['colosseum','competition','review']:square&&index===5?['mayor','dashboard','gazette']:b.shots;
 const shotLength=Math.floor(duration/Math.max(1,shots.length));
 const shotIndex=Math.min(shots.length-1,Math.floor(f/shotLength));
 const shot=shots[shotIndex];
 return <AbsoluteFill style={{background:index===4?'#172b31':'#102b22',overflow:'hidden'}}>
 <div style={{position:'absolute',width:1100,height:1100,right:-200,top:-300,borderRadius:'50%',background:'radial-gradient(circle,#799b503a,transparent 68%)',transform:`scale(${1+f*.0006})`}}/>
 <div style={{position:'absolute',top:35,left:48,right:48,display:'flex',justifyContent:'space-between',fontSize:19,letterSpacing:3,color:'#bbceb8'}}><span>village<span style={{color:'#e9ff75'}}>●</span></span><span>{String(index+1).padStart(2,'0')} / 09</span></div>
 {shot&&!titleCard&&index!==8&&<Sequence from={shotIndex*shotLength} durationInFrames={duration-shotIndex*shotLength}><Screen name={shot} f={f%shotLength} square={square}/></Sequence>}
 {index===0&&<div style={{position:'absolute',right:square?80:190,top:square?565:210,width:square?920:640,opacity:.8,transform:`rotate(-5deg) translateY(${-f*.12}px)`}}>{['We should hang soon.','Next week?','…'].map((t,i)=><div key={t} style={{padding:30,marginTop:24,marginLeft:i*50,borderRadius:25,background:i===2?'#e9ff75':'#2a493d',color:i===2?'#102b22':'#aac3b1',fontSize:40,opacity:rise(f,i*16)}}>{t}</div>)}</div>}
 {index!==7&&index!==8&&<div style={{position:'absolute',left:square?60:70,top:square?105:titleCard?230:190,width:titleCard?(square?940:1650):square?960:600}}>
 <div className="eyebrow">{b.label}</div>
 <Words text={b.title} f={f} size={titleCard?(square?90:140):square?(index===1?76:index===4?60:70):index>=3?82:100}/>
 {!square&&<p style={{fontSize:31,lineHeight:1.4,marginTop:34,color:'#c1d1bd',maxWidth:565}}>{b.value}</p>}
 {titleCard&&<div style={{marginTop:44,fontSize:35,color:'#e9ff75'}}>{b.tags[0]}</div>}
 </div>}
 {index>=2&&index<=5&&!titleCard&&<div style={{position:'absolute',left:square?60:70,top:square?320:695,display:'flex',gap:10,flexWrap:'wrap',maxWidth:square?960:590}}>{b.tags.map((t,i)=><span className="pill" key={t} style={{fontSize:square?21:23,color:i===0?'#e9ff75':'#e7edde'}}>{t}</span>)}</div>}
 {index===4&&<div style={{position:'absolute',bottom:125,right:square?60:80,color:'#e9ff75',fontSize:23,background:'#102b22',padding:'7px 12px',borderRadius:10}}>Solana devnet · test assets · stake intent ≠ payment</div>}
 {index===6&&<Phone f={f} square={square}/>}
 {index===7&&<div style={{position:'absolute',top:130,left:70,right:70,textAlign:'center'}}><div className="eyebrow">{b.label}</div><Words text={b.title} f={f} size={square?80:110}/><div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:22,marginTop:65}}>{['Gemini','Solana','ElevenLabs','Computer Vision','Photon iMessage','TigerData','Vultr','Auth0'].map((t,i)=><div key={t} style={{padding:'25px 34px',border:'1px solid #a9c6ab55',borderRadius:20,fontSize:square?32:45,background:'#254a3888',opacity:rise(f,i*3)}}>{t}</div>)}</div><p style={{fontSize:square?24:29,marginTop:35,color:'#bed1b9'}}>SAM 3 / LAM / Hunyuan3D on Modal</p><p style={{fontSize:19,marginTop:20,color:'#bed1b9'}}>Solana: devnet · TigerData: live house state · Modal: GPU pipeline</p></div>}
 {index===8&&<><Img src={staticFile('captures/town.png')} style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover',opacity:.17,transform:`scale(${1.05+f*.0002})`}}/><div style={{position:'absolute',top:square?155:180,left:65,right:65,textAlign:'center'}}><div className="eyebrow">GET BACK TO YOUR PEOPLE</div><Words text="Village." f={f} size={square?178:220}/><p style={{fontSize:square?57:70,marginTop:25,fontWeight:700}}>Get your people together.</p><div style={{display:'inline-block',marginTop:70,padding:'23px 32px',background:'#e9ff75',color:'#102b22',borderRadius:18,fontSize:square?35:46,fontWeight:700}}>https://thefriendshipvillage.vodka</div></div></>}
 <div style={{position:'absolute',left:0,right:0,bottom:0,height:108,background:'#091d18f5',display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'15px 55px',fontSize:square?34:32,lineHeight:1.25}}>{shot&&index>=3&&index<=5?(shotCaptions[shot]??b.value):b.value}</div>
 </AbsoluteFill>
}
export function Trailer({square}:{square:boolean}){
 const [handle]=useState(()=>delayRender('Bundled fonts'));
 useEffect(()=>{Promise.all([document.fonts.load('800 96px Manrope'),document.fonts.load('400 31px "DM Sans"')]).then(()=>continueRender(handle)).catch(cancelRender)},[handle]);
 const f=useCurrentFrame(),times=square?social:main,total=square?1740:3600;
 return <AbsoluteFill className="film"><style>{`@font-face{font-family:Manrope;src:url("${staticFile('fonts/Manrope.ttf')}");font-weight:200 800}@font-face{font-family:'DM Sans';src:url("${staticFile('fonts/DMSans.ttf')}");font-weight:100 1000}`}</style>
 <Audio src={staticFile('audio/village-original.wav')} playbackRate={1.15} volume={v=>(v>=(square?5.3:14)*60&&v<(square?10:20)*60?.10:.62)*interpolate(v,[0,15,total-55,total],[0,1,1,0],clamp)}/>
 {times.slice(0,-1).map((start,i)=><Sequence key={i} from={start*60} durationInFrames={(times[i+1]-start)*60}><Scene index={i} square={square} duration={(times[i+1]-start)*60}/></Sequence>)}
 <AbsoluteFill style={{pointerEvents:'none',opacity:.025,backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='white' filter='url(%23n)' d='M0 0h150v150H0z'/%3E%3C/svg%3E\")"}}/>
 <div style={{position:'absolute',bottom:0,left:0,height:5,background:'#e9ff75',width:`${100*f/(total-1)}%`}}/>
 </AbsoluteFill>
}
