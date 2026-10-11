import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useWallets,useConnect,useConnectedWallet} from '@solana/kit-plugin-wallet/react';
import {ClientProvider,potWalletClient} from '@village/pot-client/react';
import {prepareIntent,sendIntent,type WalletIntent} from '@village/pot-client/wallet';

export type {WalletIntent} from '@village/pot-client/wallet';
export type TransactionConfig = {
  prepare: (wallet:string)=>Promise<WalletIntent>;
  confirm: (id:string,signature:string)=>Promise<unknown>;
  storageKey:string;
};
const json=(value:unknown)=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2);
function Panel({config,client}:{config:TransactionConfig;client:ReturnType<typeof potWalletClient>}) {
  const wallets=useWallets(client),connected=useConnectedWallet(client),connect=useConnect(client);
  const [prepared,setPrepared]=useState<Awaited<ReturnType<typeof prepareIntent>>|null>(null);
  const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  const [receipt,setReceipt]=useState<{id:string;signature:string}|null>(()=>{try{return JSON.parse(localStorage.getItem(config.storageKey)||'null');}catch{return null;}});
  const locked=useRef(false);
  async function run(action:()=>Promise<void>) {if(locked.current)return;locked.current=true;setBusy(true);setError('');try{await action();}catch(e){setError(String(e));setStatus(String(e).includes('failed on devnet')?'Failed on devnet':'Not verified');}finally{locked.current=false;setBusy(false);}}
  async function verify(r:NonNullable<typeof receipt>){setStatus('Verifying confirmed transaction...');await config.confirm(r.id,r.signature);setStatus('Confirmed');localStorage.removeItem(config.storageKey);setPrepared(null);}
  return <section className="wallet-review" aria-label="Devnet wallet transaction"><strong>DEVNET &middot; test SOL</strong>
    <p style={{overflowWrap:'anywhere'}}>{connected?.signer?`Connected: ${connected.signer.address}`:'Wallet disconnected'}</p>
    {connected&&<button className="button secondary" disabled={busy} onClick={()=>void run(async()=>{setPrepared(null);await client.wallet.disconnect();})}>Disconnect wallet</button>}
    {!wallets.length&&<p>No compatible wallet installed. Install a Wallet Standard wallet with devnet support, then reopen this panel.</p>}
    {wallets.map(wallet=><button className="button secondary" key={wallet.name} disabled={busy} onClick={()=>void run(async()=>{setPrepared(null);await connect.dispatchAsync(wallet);})}>Connect {wallet.name}</button>)}
    {connected?.signer&&!receipt&&<button className="button primary" disabled={busy} onClick={()=>void run(async()=>{setPrepared(null);const intent=await config.prepare(connected!.signer!.address);const next=await prepareIntent(client,intent);setPrepared(next);setStatus(next.review.simulation.value.err===null?'Simulation succeeded':'Simulation failed');})}>Simulate transaction</button>}
    {prepared&&<section aria-label="Simulation result"><h4>{prepared.review.simulation.value.err===null?'Simulation succeeded':'Simulation failed'}</h4>
      <p>Network fee: {String(prepared.review.feeLamports??'unavailable')} lamports. Review the destination, amount and payout terms below.</p>
      <dl style={{overflowWrap:'anywhere'}}><dt>Fee payer</dt><dd>{prepared.review.feePayer}</dd><dt>Amount</dt><dd>{String(prepared.review.metadata.lamports??prepared.review.metadata.entry_lamports??'0')} lamports</dd><dt>Destination</dt><dd>{String(prepared.review.metadata.destination??prepared.review.metadata.vault??'See instructions')}</dd>{prepared.review.metadata.xp!=null&&<><dt>Personal XP</dt><dd>{String(prepared.review.metadata.xp)}</dd></>}{prepared.review.metadata.rent_lamports!=null&&<><dt>Account rent (retained in pot)</dt><dd>{String(prepared.review.metadata.rent_lamports)} lamports</dd></>}{prepared.review.metadata.payout_mode!=null&&<><dt>Payout mode</dt><dd>{String(prepared.review.metadata.payout_mode).replaceAll('_',' ')}</dd><dt>Ranked split (basis points)</dt><dd>{json(prepared.review.metadata.ranked_bps)}</dd></>}</dl>
      <details><summary>Simulation logs and transaction instructions</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:240,overflow:'auto'}}>{json(prepared.review)}</pre></details>
      <button className="button primary" disabled={busy||!!receipt||prepared.review.simulation.value.err!==null||prepared.review.feeLamports===null} onClick={()=>void run(async()=>{
        setStatus('Awaiting wallet signature...');
        const signature=await sendIntent(client,prepared,signature=>{const r={id:prepared.review.intentId,signature};setReceipt(r);localStorage.setItem(config.storageKey,JSON.stringify(r));setStatus('Pending confirmation...');});
        await verify({id:prepared.review.intentId,signature});
      })}>Approve signature & send devnet transaction</button>
    </section>}
    {receipt&&<><p style={{overflowWrap:'anywhere'}}><a href={`https://explorer.solana.com/tx/${receipt.signature}?cluster=devnet`} target="_blank" rel="noreferrer">View transaction on devnet Explorer</a></p>{status!=='Confirmed'&&<button className="button secondary" disabled={busy} onClick={()=>void run(()=>verify(receipt))}>Retry verification (no payment)</button>}</>}
    {status==='Failed on devnet'&&receipt&&<button className="button secondary" disabled={busy} onClick={()=>{localStorage.removeItem(config.storageKey);setReceipt(null);setPrepared(null);setError('');setStatus('');}}>Clear failed transaction and try again</button>}
    {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
export function mountTransaction(host:HTMLElement,config:TransactionConfig){
  const client=potWalletClient({rpcUrl:'https://api.devnet.solana.com'}),root=createRoot(host);
  root.render(<ClientProvider client={client}><Panel client={client} config={config}/></ClientProvider>);
  return ()=>root.unmount();
}
