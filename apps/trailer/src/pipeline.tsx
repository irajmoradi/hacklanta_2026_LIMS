import React from 'react';
import {AbsoluteFill,Audio,Img,OffthreadVideo,Sequence,staticFile,useCurrentFrame,interpolate} from 'remotion';
import {Words} from './trailer';
export function Pipeline({square}:{square:boolean}) {
 const f=useCurrentFrame(),t=f/60;
 const starts=square?[0,1,2,3,4,6.8,9]:[0,2,4,6,9,15,21];
 const stage=starts.filter(x=>t>=x).length-1;
 const labels=['REAL PHOTO','SAM 3 / SEGMENTATION','EXTRACTED TRAITS','YOUR VILLAGER','LAM / 3D GAUSSIAN SPLAT','YOUR RECORDED VOICE','ELEVENLABS VOICE'];
 const captions=['Start with Iraj’s real photo.','SAM 3 separates the person from the background.','Photo-derived colors become your villager’s palette.','A recognizable villager in the world.','Iraj’s actual Gaussian-splat head. A slow orbit.','Iraj’s original recording becomes his AI voice.','“Video test from the village! Get off your ass and go crush your goals today.”'];
 const visual={position:'absolute' as const,left:square?55:705,top:square?285:105,width:square?970:1100,height:square?655:800,borderRadius:24,overflow:'hidden',background:'#16251f'};
 return <AbsoluteFill style={{background:'#102b22'}}>
 <div style={{position:'absolute',left:60,top:square?50:145,width:square?960:595}}><div className="eyebrow">YOUR FACE. YOUR VOICE.</div><Words text={stage<5?'That’s actually you.':'And you sound like you.'} f={f} size={square?70:100}/>{!square&&<p style={{fontSize:31,lineHeight:1.4,marginTop:36,color:'#c1d1bd'}}>One photo. One voice memo.<br/>A friend you recognize.</p>}</div>
 <div style={visual}>
 {stage===0&&<Img src={staticFile('captures/photo.jpg')} style={{width:'100%',height:'100%',objectFit:'contain',transform:`scale(${1+t*.035})`}}/>}
 {stage===1&&<><Img src={staticFile('captures/segmented.png')} style={{width:'100%',height:'100%',objectFit:'contain'}}/><div style={{position:'absolute',inset:0,background:'#dfff65',opacity:.32,maskImage:`url(${staticFile('captures/mask.png')})`,maskMode:'luminance',maskSize:'contain',maskRepeat:'no-repeat',maskPosition:'center'}}/><div style={{position:'absolute',left:0,right:0,top:`${((t-starts[1])/(starts[2]-starts[1]))*100}%`,height:4,background:'#e9ff75',boxShadow:'0 0 30px #e9ff75'}}/></>}
 {stage===4&&<Sequence from={starts[4]*60}><OffthreadVideo muted playbackRate={square?2.14:1} src={staticFile('captures/head-detail.mp4')} style={{width:'100%',height:'100%',objectFit:'contain'}}/></Sequence>}
 {stage===2&&<><Img src={staticFile('captures/segmented.png')} style={{height:'100%',width:'50%',objectFit:'contain',opacity:.75}}/><OffthreadVideo muted src={staticFile('captures/walking.mp4')} style={{position:'absolute',right:0,top:0,height:'100%',width:'50%',objectFit:'cover'}}/>{['#313f83','#b7957f','#5f5954'].map((color,i)=><div key={color} style={{position:'absolute',left:60+interpolate(t-starts[2],[0,1.3],[0,500],{extrapolateRight:'clamp'})+i*95,top:220+i*100,width:90,height:90,background:color,border:'4px solid white',borderRadius:20}}/>)}</>}
 {stage===3&&<Sequence from={starts[3]*60}><OffthreadVideo muted src={staticFile('captures/walking.mp4')} style={{width:'100%',height:'100%',objectFit:'cover',transform:'scale(3.5)'}}/></Sequence>}
 {stage===5&&<><div style={{padding:'130px 50px',textAlign:'center'}}><div style={{fontSize:40,color:'#e9ff75'}}>Iraj’s original voice memo</div><Img src={staticFile('captures/waveform.svg')} style={{width:'100%',height:240,marginTop:30}}/><div style={{fontSize:36}}>Recorded voice → ElevenLabs voice</div></div><Sequence from={starts[5]*60}><Audio src={staticFile('captures/memo.ogg')} volume={.85}/></Sequence></>}
 {stage===6&&<Sequence from={starts[6]*60}><OffthreadVideo src={staticFile('captures/talk.mp4')} volume={1} style={{width:'100%',height:'100%',objectFit:'contain'}}/></Sequence>}
 <div style={{position:'absolute',left:24,bottom:22,background:'#0b211eee',padding:'12px 22px',borderRadius:14,fontSize:square?25:29,color:'#e9ff75'}}>{labels[stage]}{stage===6?' · CACHED AI VOICE':''}</div>
 </div>
 <div style={{position:'absolute',left:square?60:65,top:square?238:640,width:square?960:590,fontSize:square?20:24,lineHeight:1.65,color:'#c1d1bd'}}>SAM 3 · LAM · Audio2Expression{square?' / ':''}<br style={{display:square?'none':'block'}}/> ElevenLabs · Hunyuan3D · Modal GPUs</div>
 <div style={{position:'absolute',left:0,right:0,bottom:0,height:108,background:'#091d18',padding:'18px 50px',fontSize:square?28:32,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>{captions[stage]}</div>
 </AbsoluteFill>;
}
