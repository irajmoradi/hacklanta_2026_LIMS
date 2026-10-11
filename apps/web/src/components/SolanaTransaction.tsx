import {useEffect,useRef,useState} from 'react';
import {api} from '../api/client';
type WalletIntent = import('./pot/transactions').WalletIntent;

export function SolanaTransaction({vid,action,competitionId,auditorWallet,xp,onConfirmed}:{vid:string;action:string;competitionId?:string;auditorWallet?:string;xp?:number;onConfirmed?:()=>void}) {
  const host=useRef<HTMLDivElement>(null),[error,setError]=useState('');
  const callback=useRef(onConfirmed);callback.current=onConfirmed;
  useEffect(()=>{let active=true,dispose:(()=>void)|undefined;
    void import('./pot/transactions').then(module=>{if(active&&host.current)dispose=module.mountTransaction(host.current,{
      storageKey:`village-solana:${api.user}:${vid}:${competitionId??'treasury'}:${action}`,
      prepare:wallet=>api.request<WalletIntent>('POST',`/villages/${vid}/solana/intents`,{wallet,action,competition_id:competitionId,auditor_wallet:auditorWallet,xp}),
      confirm:async(id,signature)=>{const result=await api.request('POST',`/villages/${vid}/solana/intents/${id}/confirm`,{signature});callback.current?.();return result;},
    });}).catch(e=>setError(String(e)));
    return()=>{active=false;dispose?.();};
  },[vid,action,competitionId,auditorWallet,xp]);
  return <>{error&&<p role="alert">{error}</p>}<div ref={host}/></>;
}
