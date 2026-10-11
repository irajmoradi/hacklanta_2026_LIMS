import { CurrencyAmount } from './Currency';
import { useRef, useState } from 'react';
import { api } from '../api/client';
import type { BribeReceipt } from '../api/social';
import { errorText } from './shared';
import { sound } from '../sound/engine';
// Session-only receipts: API-010 does not expose a history/status read route.
const receipts = new Map<string, BribeReceipt[]>();
export function clearBribeReceipts(user: string) { for (const key of receipts.keys()) if (key.startsWith(`${user}:`)) receipts.delete(key); }
export function BribePanel({vid, balance, refresh, onBusy}: {onBusy?: (busy: boolean) => void; vid: string; balance: number; refresh: () => Promise<void>}) {
  const key = `${api.user}:${vid}`;
  const [rows, setRows] = useState(() => receipts.get(key) ?? []), [coins, setCoins] = useState(50), [wish, setWish] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false); const max = Math.min(10000, balance), spend = Math.min(coins, max);
  async function submit() {
    if (lock.current || spend < 1) return; lock.current = true; setBusy(true); onBusy?.(true); setError('');
    try { const result = await api.bribe(vid, spend, wish.trim()); const next = [result, ...rows]; receipts.set(key, next); setRows(next); setWish(''); sound.play('coin_purchase'); await refresh().catch(() => setError('Receipt saved. Refresh the village to update your balance.')); }
    catch(e) { setError(`${errorText(e)} A failed connection may still have spent coins; check your balance before trying again.`); }
    finally {lock.current = false; setBusy(false); onBusy?.(false);}
  }
  return <section className="bribe-panel"><h3>Bribe the Mayor</h3><p>A few coins, a hopeful wish. An event outcome is never guaranteed.</p><form onSubmit={e => {e.preventDefault(); void submit();}}><label htmlFor="bribe-coins">Spend <CurrencyAmount amount={spend} currency="coins" /> - <CurrencyAmount amount={balance} currency="coins" /> available</label><input id="bribe-coins" type="range" min="1" max={Math.max(1,max)} value={Math.max(1,spend)} disabled={busy || max < 1} onChange={e => setCoins(Number(e.target.value))} /><label htmlFor="bribe-wish">Your wish</label><textarea id="bribe-wish" maxLength={1000} value={wish} required disabled={busy} onChange={e => setWish(e.target.value)} /><button className="button secondary" disabled={busy || max < 1 || !wish.trim()}>{busy ? 'Offering coins...' : 'Offer coins'}</button></form>{error && <p role="alert">{error}</p>}<p className="help-text">Receipts from this session. Status is recorded at purchase; refreshed pending/consumed history is not available yet.</p>{rows.map(r => <article className="bribe-receipt" key={r.bribe.id}><strong>{r.receipt}</strong><p>{r.bribe.wish}</p><small>{r.bribe.status} - <CurrencyAmount amount={r.bribe.coins} currency="coins" /> - Balance after purchase: <CurrencyAmount amount={r.balance} currency="coins" /></small></article>)}</section>;
}
