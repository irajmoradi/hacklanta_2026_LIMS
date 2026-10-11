import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { townLive } from '../api/townLive';
import { readPresence, type Presence } from '../api/social';
const Context = createContext<{online: Presence[]; connected: boolean}>({online: [], connected: false});
export const usePresence = () => useContext(Context);
export function PresenceProvider({vid, user, activity, children}: {vid?: string; user: string; activity: string; children: ReactNode}) {
  const [intentError,setIntentError]=useState('');
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    const rejected=(event:Event)=>{setIntentError(String((event as CustomEvent).detail));clearTimeout(timer);timer=setTimeout(()=>setIntentError(''),4000);};
    window.addEventListener('village-intent-error',rejected);
    return()=>{window.removeEventListener('village-intent-error',rejected);clearTimeout(timer);};
  },[]);
  useEffect(() => vid ? townLive.connect(vid) : undefined, [vid, user]);
  const latestActivity = useRef(activity); latestActivity.current = activity;
  const heartbeatNow = useRef<() => void>(() => {});
  useEffect(() => { heartbeatNow.current(); }, [activity]);
  const [state, setState] = useState({online: [] as Presence[], connected: false});
  useEffect(() => {
    setState({online: [], connected: false}); if (!vid) return;
    let streamFailures = 0, beatFailures = 0, pending = false, nextBeat = 0;
    let alive = true, retry: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const update = (online: Presence[]) => { if (alive) setState({online, connected: true}); };
    async function connect() {
      try { const headers = await api.authHeaders(); if (!alive) return;
        await readPresence(await fetch(`/api/villages/${vid}/presence/stream`, {headers, signal: controller.signal}), controller.signal, online => { streamFailures = 0; update(online); });
      } catch { /* Reconnect while mounted. */ }
      if (alive) { setState({online: [], connected: false}); retry = setTimeout(() => void connect(), Math.min(60000, 5000 * 2 ** streamFailures++)); }
    }
    if (api.mode === 'live') void connect();
    const beat = () => {
      if (!alive || pending || Date.now() < nextBeat || document.visibilityState === 'hidden') return;
      pending = true;
      void api.heartbeat(vid!, latestActivity.current).then(r => { beatFailures = 0; update(r.online); }).catch(() => {
        beatFailures++; if (alive) setState({online: [], connected: false});
      }).finally(() => { pending = false; nextBeat = Date.now() + Math.min(60000, 10000 * 2 ** beatFailures); });
    };
    heartbeatNow.current = beat; beat(); const timer = setInterval(beat, 10000); document.addEventListener('visibilitychange', beat);
    return () => { alive = false; heartbeatNow.current = () => {}; controller.abort(); clearTimeout(retry); clearInterval(timer); document.removeEventListener('visibilitychange', beat); };
  }, [vid, user]);
  return <Context.Provider value={state}>{children}{intentError && <div role="status" className="scene-label" style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:1000}}>{intentError}</div>}</Context.Provider>;
}
export function PresenceDot({user}: {user: string}) {
  const {online} = usePresence(); const person = online.find(p => p.user_id === user);
  return person ? <span className="presence-dot" role="img" aria-label="Online now" title={`Online now - ${person.activity}`} /> : null;
}
