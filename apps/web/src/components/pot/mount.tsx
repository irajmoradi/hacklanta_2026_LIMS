import { useId, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { address, type Address } from '@solana/kit';
import { useWallets, useConnect, useConnectedWallet } from '@solana/kit-plugin-wallet/react';
import { ClientProvider, potWalletClient, useJoinPot } from '@village/pot-client/react';

const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
// This React 19 island keeps its SVG local; no React 18 elements cross the boundary.
function SolAmount({ lamports }: { lamports: bigint }) {
  const gradient = useId();
  return <span className="currency-amount"><svg className="currency-icon" data-currency="SOL" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9945ff"/><stop offset="1" stopColor="#14f195"/></linearGradient></defs><path d="m6 3-4 4h16l4-4ZM2 10l4 4h16l-4-4Zm4 7-4 4h16l4-4Z" fill={`url(#${gradient})`}/></svg>{`${lamports / 1000000000n}.${(lamports % 1000000000n).toString().padStart(9, '0')} SOL`} <small className="devnet-tag">devnet &middot; test</small></span>;
}
const sol = (lamports: bigint) => <SolAmount lamports={lamports} />;

function WalletPanel({ client, pot }: { client: ReturnType<typeof potWalletClient>; pot: Address }) {
  const wallets = useWallets(client), connected = useConnectedWallet(client), connect = useConnect(client);
  const join = useJoinPot(pot);
  const [signed, setSigned] = useState(false), [consumed, setConsumed] = useState(false), [error, setError] = useState('');
  const review = join.review;
  return <div className="wallet-review">
    {!wallets.length && <p>No compatible wallet found. Install a Wallet Standard wallet with devnet signing support, then reopen this panel.</p>}
    {wallets.map(wallet => <button className="button secondary" disabled={join.pending || connect.status === 'running'} key={wallet.name} onClick={() => { setSigned(false); setError(''); void connect.dispatchAsync(wallet).catch(e => setError(String(e))); }}>Connect {wallet.name}</button>)}
    {connected && <button className="button primary" disabled={join.pending} onClick={() => { setSigned(false); setConsumed(false); setError(''); void join.simulate().catch(e => setError(String(e))); }}>{join.pending ? 'Working…' : 'Simulate join on DEVNET'}</button>}
    {review && <section aria-label="Simulation result"><h4>Simulation {review.simulation.value.err === null ? 'succeeded' : 'failed'} · DEVNET</h4>
      <dl className="transaction-summary">
        <div><dt>Entry</dt><dd>{sol(review.entryLamports)}</dd></div>
        <div><dt>Network fee</dt><dd>{review.feeLamports === null ? 'Unavailable — simulate again' : sol(review.feeLamports)}</dd></div>
        <div><dt>Fee payer</dt><dd>{review.feePayer}</dd></div>
        <div><dt>Pot</dt><dd>{review.pot}</dd></div>
        <div><dt>Vault destination</dt><dd>{review.vault}</dd></div>
        <div><dt>Program</dt><dd>{review.programAddress}</dd></div>
      </dl>
      <p>Approval requests a signature for this simulated transaction. It does not broadcast a payment. A simulation cannot guarantee future chain state.</p>
      <details><summary>Simulation logs and transaction details</summary><pre tabIndex={0}>{json(review)}</pre></details>
      <button className="button primary" disabled={join.pending || consumed || review.simulation.value.err !== null || review.feeLamports === null} onClick={() => { setConsumed(true); setError(''); void join.sign({ approved: true }).then(() => setSigned(true)).catch(e => setError(String(e))); }}>Approve signature</button>
    </section>}
    {(error || join.error != null) && <p role="alert">{error || String(join.error)}</p>}
    {signed && <p role="status">Signed locally; not broadcast. You have not joined the on-chain pot.</p>}
  </div>;
}

/** React 19 island: no React elements or contexts cross the React 18 village boundary. */
export function mountPot(host: HTMLElement, config: { program: string; pot: string }) {
  const client = potWalletClient({ rpcUrl: 'https://api.devnet.solana.com', programAddress: address(config.program) });
  const pot = address(config.pot), root = createRoot(host);
  root.render(<ClientProvider client={client}><WalletPanel client={client} pot={pot} /></ClientProvider>);
  return () => root.unmount();
}
