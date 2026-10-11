import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { BribeReceipt } from '../api/social';
import { errorText } from './shared';
import { VillageIcon } from './VillageIcon';
import { sound } from '../sound/engine';

const receipts = new Map<string, BribeReceipt[]>();
export function MayorSceneBribe({ vid, balance, refresh, onBusy }: { vid: string; balance: number; refresh: () => Promise<void>; onBusy: (busy: boolean) => void }) {
  const key = `${api.mode}:${api.user}:${vid}`;
  const [coins, setCoins] = useState(Math.min(50, balance)), [wish, setWish] = useState('');
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [history, setHistory] = useState(() => receipts.get(key) ?? []);
  const [uncertain, setUncertain] = useState(false);
  const receiptCard = useRef<HTMLElement>(null), focusReceipt = useRef(false);
  useLayoutEffect(() => {
    if (!focusReceipt.current) return;
    focusReceipt.current = false;
    receiptCard.current?.focus();
  }, [history]);
  const lock = useRef(false), confirmation = useRef<HTMLDivElement>(null), amount = useRef<HTMLInputElement>(null);
  const max = Math.min(10000, balance), spend = coins;
  useEffect(() => { if (review) confirmation.current?.focus(); }, [review]);
  const valid = Number.isInteger(spend) && spend >= 1 && spend <= max && !!wish.trim();
  async function offer() {
    if (lock.current || !valid || uncertain) return;
    lock.current = true; setBusy(true); onBusy(true); setError('');
    try {
      const result = await api.bribe(vid, spend, wish.trim());
      const next = [result, ...(receipts.get(key) ?? [])];
      focusReceipt.current = true;
      receipts.set(key, next); setHistory(next); setReview(false); setWish(''); setCoins(Math.min(50, result.balance));
      sound.play('coin_purchase');
      await refresh().catch(() => { setUncertain(true); setError('Your receipt is saved. Reopen the village to refresh your balance before making another offering.'); });
    } catch (e) {
      setError(`${errorText(e)} Coins may have been spent. Check your balance before making another offering.`);
      setUncertain(true);
    } finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  return <section className="mayor-offering" aria-label="Bribe the Mayor"><h3>A coin and a wish</h3><p>An offering costs coins. The Mayor may consider your wish; an event is never guaranteed.</p>
    <div className="mayor-purse"><VillageIcon name="bag" size={32}/><div><span>Your balance</span><strong>{balance.toLocaleString()} coins</strong></div></div>
    {review ? <div ref={confirmation} tabIndex={-1} className="mayor-bribe-review"><h4>Review your offering</h4><blockquote>{wish}</blockquote><dl><div><dt>Cost</dt><dd>{spend} coins</dd></div><div><dt>Balance after offering</dt><dd>{balance - spend} coins</dd></div></dl><p>Coins are spent when you confirm, even if your wish is not granted.</p><div className="mayor-actions"><button className="button primary" disabled={busy || !valid || uncertain} onClick={() => void offer()}>{busy ? 'Offering coins…' : `Confirm · spend ${spend} coins`}</button><button className="button secondary" disabled={busy} onClick={() => {setReview(false); requestAnimationFrame(() => amount.current?.focus());}}>Edit offering</button></div></div> : <form onSubmit={e => { e.preventDefault(); if (valid) setReview(true); }}><label htmlFor="mayor-bribe-coins">Offering amount · coins</label><input ref={amount} id="mayor-bribe-coins" type="number" min="1" max={Math.max(1, max)} step="1" value={coins || ''} onChange={e => setCoins(Number(e.target.value))} disabled={max < 1 || uncertain} required/><p className="mayor-cost">Cost: {spend} coins · Remaining: {balance - spend} coins</p><label htmlFor="mayor-bribe-wish">Your wish</label><textarea id="mayor-bribe-wish" value={wish} onChange={e => setWish(e.target.value)} maxLength={1000} rows={3} placeholder="A little more sunshine for our town…" required disabled={uncertain}/>{max < 1 && <p>Check in to earn coins before making an offering.</p>}<button className="button primary" disabled={!valid || uncertain}>Review offering</button></form>}
    {error && <p role="alert">{error}</p>}
    {history.map((receipt, index) => <article key={receipt.bribe.id} ref={index === 0 ? receiptCard : undefined} tabIndex={index === 0 ? -1 : undefined} className="mayor-receipt" role={index === 0 ? 'status' : undefined}><h4>Offering received</h4><p>{receipt.receipt}</p><p>{receipt.bribe.wish}</p><strong>{receipt.bribe.coins} coins spent · {receipt.balance} coins after purchase</strong><p>Status at purchase: {receipt.bribe.status}</p><small>{index === 0 ? 'Latest receipt' : 'Earlier receipt'} from this session.</small></article>)}
  </section>;
}
