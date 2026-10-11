import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { FeedItem } from '../api/types';
import { SettingToggle } from '../components/SettingToggle';
import { BarkPlayer, type BarkManifest } from './barks';
import { sound } from './engine';

export const barks = new BarkPlayer(() => sound.effectsEnabled(), () => sound.settings.volume, async url => {
  const response = await fetch(url, {headers:await api.authHeaders(), cache:'no-store', signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('Bark unavailable');
  return response.blob();
});
export function barkPreference(user: string) { try {return localStorage.getItem(`village:barks:${user}`) !== 'off';} catch {return true;} }
export function VoiceBarkSetting({user}: {user: string}) {
  const [enabled, setEnabled] = useState(() => barkPreference(user));
  return <SettingToggle label="Voice barks" help="Short avatar voice lines. Saved for you on this device." checked={enabled} onChange={value => {
    setEnabled(value); barks.enabled=value; barks.sync();
    try {localStorage.setItem(`village:barks:${user}`,value?'on':'off');} catch { /* Optional storage. */ }
  }}/>;
}
export function VoiceBarks({vid,user,feed}: {vid:string;user:string;feed:FeedItem[]}) {
  useEffect(() => {
    barks.reset(); barks.enabled=barkPreference(user);
    let alive=true;
    const load=async()=>{try {const manifest=api.mode==='mock'?{}:await api.request<BarkManifest>('GET',`/villages/${vid}/barks`); if(alive) barks.manifest=manifest;} catch {if(alive) barks.manifest={};}};
    void load(); const timer=setInterval(()=>void load(),30000);
    const sync=()=>barks.sync(), unsubscribe=sound.subscribe(sync);
    const preference=matchMedia('(prefers-reduced-motion: reduce)'); preference.addEventListener('change',sync);
    document.addEventListener('visibilitychange',sync);
    return ()=>{alive=false;clearInterval(timer);unsubscribe();preference.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);barks.reset();};
  },[vid,user]);
  const [seen] = useState(() => new Map<string, Set<string>>());
  useEffect(()=>{
    const key=`${vid}:${user}`, previous=seen.get(key);
    seen.set(key,new Set(feed.map(item=>item.id)));
    if(!previous) return;
    for(const item of feed) {
      if(previous.has(item.id) || Date.now()-Date.parse(item.created_at)>15000) continue;
      if(item.type==='checkin' && item.user_id) void barks.trigger(item.user_id,'checkin');
      const target=(item.payload as {to_user_id?:string}).to_user_id;
      if(item.type==='cheer' && target) void barks.trigger(target,'cheered');
    }
  },[feed,vid,user,seen]);
  return null;
}
