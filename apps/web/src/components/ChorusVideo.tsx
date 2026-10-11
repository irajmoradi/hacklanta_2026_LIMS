import {useEffect, useRef, useState} from 'react';
import {mediaUrl} from './shared';
/** Muted clips follow the same audio clock, including late readiness and spotlight changes. */
export function ChorusVideo({url, clock}: {url:string; clock:HTMLAudioElement}) {
  const ref=useRef<HTMLVideoElement>(null), [source,setSource]=useState(''), [ready,setReady]=useState(false);
  useEffect(()=>{let alive=true, owned=''; setReady(false); setSource('');
    void mediaUrl(url).then(value=>{owned=value;if(alive)setSource(value);else if(value.startsWith('blob:'))URL.revokeObjectURL(value);}).catch(()=>{});
    return()=>{alive=false;if(owned.startsWith('blob:'))URL.revokeObjectURL(owned);};
  },[url]);
  useEffect(()=>{let frame=0;const tick=()=>{const video=ref.current;
    if(video && ready && Number.isFinite(video.duration) && video.duration>0){
      const target=clock.duration>0?clock.currentTime/clock.duration*video.duration:0;
      if(Math.abs(video.currentTime-target)>.08)video.currentTime=Math.min(target,Math.max(0,video.duration-.01));
      video.playbackRate=Math.max(.25,Math.min(4,video.duration/clock.duration));
      if(clock.paused||clock.ended)video.pause();else if(video.paused)void video.play().catch(()=>{});
    }frame=requestAnimationFrame(tick);};tick();return()=>{cancelAnimationFrame(frame);ref.current?.pause();};
  },[clock,ready]);
  return <video ref={ref} className="chorus-video" data-ready={ready} style={{opacity:ready?1:0}} src={source||undefined} muted playsInline preload="auto" onLoadedData={()=>setReady(true)} onError={()=>setReady(false)} aria-label="Animated chorus head"/>;
}
