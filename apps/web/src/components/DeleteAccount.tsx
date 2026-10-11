import { ShieldAlert } from 'lucide-react';
import { clearBribeReceipts } from './BribePanel';
import { useRef, useState } from 'react';
import { api } from '../api/client';
import { errorText } from './shared';
export function DeleteAccount({onDeleted, onBusy, disabled = false}: {disabled?: boolean; onDeleted: () => void; onBusy?: (busy: boolean) => void}) {
  const [confirm, setConfirm] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''); const lock = useRef(false);
  return <section className="delete-account settings-card"><h3><ShieldAlert aria-hidden="true" />Danger zone</h3><p>Permanently remove your Village account, messages, progress and generated assets.</p><form onSubmit={e => { e.preventDefault(); if (disabled || confirm !== 'DELETE' || lock.current) return; lock.current = true; setBusy(true); onBusy?.(true); setError(''); void api.deleteAccount().then(r => {if (!r.deleted) throw new Error('Deletion was not confirmed.'); clearBribeReceipts(api.user);
      try { localStorage.removeItem(`village:last:${api.user}`); for (const key of Object.keys(sessionStorage)) if (key.startsWith(`village:mayor-response:${api.user}:`)) sessionStorage.removeItem(key); } catch { /* Storage may be blocked. */ }
      onDeleted();}).catch(e => setError(errorText(e))).finally(() => {lock.current = false; setBusy(false); onBusy?.(false);}); }}><label htmlFor="delete-confirm">Type DELETE to confirm</label><input id="delete-confirm" autoComplete="off" value={confirm} disabled={busy || disabled} onChange={e => setConfirm(e.target.value)} /><button className="button danger" disabled={disabled || busy || confirm !== 'DELETE'}>{busy ? 'Deleting...' : 'Delete my account'}</button></form>{error && <p role="alert">{error}</p>}</section>;
}
