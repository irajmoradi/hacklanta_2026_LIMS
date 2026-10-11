import {useEffect,useState} from 'react';
import {api} from '../api/client';
import {SolanaTransaction} from './SolanaTransaction';
export function Treasury({vid,refresh}:{vid:string;refresh:()=>Promise<void>}) {
  const [config,setConfig]=useState<{enabled:boolean;used_xp:number;daily_cap_xp:number}|null>(null),[error,setError]=useState(''),[xp,setXp]=useState(100),[open,setOpen]=useState(()=>!!localStorage.getItem(`village-solana:${api.user}:${vid}:treasury:treasury`));
  const load=()=>api.request<NonNullable<typeof config>>('GET',`/villages/${vid}/treasury`).then(setConfig).catch(e=>setError(String(e)));
  useEffect(()=>{void load();},[vid]);
  return <details><summary>Treasury &middot; devnet SOL &rarr; personal XP</summary><section aria-label="Treasury"><h3>Treasury <small>DEVNET</small></h3>
    <p>0.01 test SOL = 100 personal XP. Limit: 1,000 XP per account per UTC day. Prepared purchases reserve the daily allowance. XP arrives after server verification.</p>
    <p>Every 100 personal XP adds an auditor selection chance, up to 11 chances. Rotation and sit-out rules still apply.</p>
    {config&&<p>{config.used_xp} / {config.daily_cap_xp} XP reserved today.</p>}
    {!config?.enabled?<p>Treasury is awaiting its devnet destination configuration.</p>:<><label>Personal XP<input type="number" min={1} max={Math.max(1,config.daily_cap_xp-config.used_xp)} step={1} value={xp} disabled={open} onChange={e=>setXp(Number(e.target.value))}/></label><p>Cost: {(xp/10000).toFixed(4)} devnet SOL + network fee</p><button className="button secondary" disabled={open||!Number.isInteger(xp)||xp<1||xp>config.daily_cap_xp-config.used_xp} onClick={()=>setOpen(true)}>Convert SOL to XP</button>{open&&<button className="button secondary" onClick={()=>setOpen(false)}>Close wallet panel</button>}{open&&<SolanaTransaction vid={vid} action="treasury" xp={xp} onConfirmed={()=>{void load();void refresh();}}/>}</>}
    {error&&<p role="alert">{error}</p>}
  </section></details>;
}
