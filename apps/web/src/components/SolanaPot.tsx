import {useState} from 'react';
import type {Competition} from '../api/types';
import {api} from '../api/client';
import {SolanaTransaction} from './SolanaTransaction';
export function SolanaPot({competition:c,vid,program:_program}:{competition:Competition;vid?:string;program?:string}){
  const [action,setAction]=useState(''),[auditorWallet,setAuditorWallet]=useState(c.chain_config?.auditor??'');
  if(c.friendly||!c.entry_lamports)return null;
  return <section className="solana-pot" aria-label="On-chain pot"><strong>DEVNET &middot; test SOL</strong>
    <p>{c.pot_address?'Pot ready. Entry is recorded only after confirmed payment.':'Creator must create and confirm the devnet pot before anyone can enter.'}</p>
    <p>Deadline: {c.deadline?new Date(c.deadline).toLocaleString():'Not configured'}. Unsettled stakes are refundable after another 72 hours.</p>
    {c.status==='open'&&vid&&<>
      {!c.pot_address&&c.creator_id===api.user&&<><label>Auditor wallet address<input value={auditorWallet} disabled={!!action} onChange={e=>setAuditorWallet(e.target.value)} placeholder="Ask the assigned auditor for their public address"/></label><button className="button secondary" disabled={!!action||!auditorWallet} onClick={()=>setAction('create')}>Create devnet pot</button></>}
      {c.pot_address&&<><button className="button secondary" disabled={!!action||c.auditor_id===api.user} onClick={()=>setAction('join')}>Join pot with wallet</button>{c.auditor_id===api.user&&<button className="button secondary" disabled={!!action} onClick={()=>setAction('settle')}>Settle & pay from wallet</button>}<button className="button secondary" disabled={!!action} onClick={()=>setAction('refund')}>Refund after 72 hours</button></>}
      {action&&<button className="button secondary" onClick={()=>setAction('')}>Close wallet panel</button>}{action&&<SolanaTransaction vid={vid} action={action} competitionId={c.id} auditorWallet={auditorWallet||undefined}/>}
    </>}
    {!vid&&<p>Open this competition from your village to connect a wallet.</p>}
  </section>;
}
