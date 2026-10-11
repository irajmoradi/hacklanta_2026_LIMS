import { useState } from 'react';
import { api } from '../api/client';
import { errorText } from './shared';

export function ClaimVillager({ onClaimed, onSkip, onSignOut }: { onClaimed: () => Promise<void>; onSkip: () => void; onSignOut?: () => void }) {
  const [code, setCode] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <main className="boot-screen"><h1>Claim your villager</h1><p>Have a team seat? Enter the single-use code from your operator.</p>
    <form style={{width: 'min(100%, 360px)', display: 'grid', gap: 12}} onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await api.claimSeat(code.trim()); setCode(''); await onClaimed(); }
      catch (e) { setError(errorText(e)); } finally { setBusy(false); }
    }}><label htmlFor="claim-code">Claim code</label><input id="claim-code" type="password" autoComplete="off" value={code} maxLength={200} required disabled={busy} onChange={e => setCode(e.target.value)} />
      {error && <p role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Claiming…' : 'Claim villager'}</button>
      <button className="button secondary" type="button" disabled={busy} onClick={onSkip}>No code? Create or join a village</button>
      {onSignOut && <button className="text-button" type="button" disabled={busy} onClick={onSignOut}>Sign out</button>}
    </form></main>;
}
