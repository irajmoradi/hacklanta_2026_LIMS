import { VillageIcon } from './VillageIcon';
import { debugProbeEnabled } from './chromePreferences';
import { CurrencyAmount, Reward } from './Currency';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { savedSeat, saveSeat, seatClient } from '../api/seat';
import type { Village } from '../api/types';
import { Dialog, Portrait, errorText } from './shared';

export function DemoTools({ onSignIn, village, user, switchUser, refresh }: { onSignIn?: () => void; village: Village; user: string; switchUser: (id: string) => Promise<void>; refresh: () => Promise<void> }) {
  const [picker, setPicker] = useState(() => !savedSeat(api.mode));
  const [enabled, setEnabled] = useState(false), [panel, setPanel] = useState(false);
  const [conflict, setConflict] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [reason, setReason] = useState('Rehearsal');
  const [retry, setRetry] = useState<{ action: string; body: object } | null>(null);
  const person = village.villagers.find(p => p.user_id === user)!;
  useEffect(() => {
    let active = true;
    setEnabled(false); setPanel(false); setRetry(null);
    if (debugProbeEnabled(import.meta.env.VITE_DEMO_DEBUG)) void api.request<{enabled: boolean}>('GET', '/demo/debug').then(r => { if (active) setEnabled(r.enabled); }).catch(() => {});
    if (picker) return () => { active = false; };
    const beat = () => void api.request<{conflict: boolean}>('POST', '/demo/seat', {user_id: user, client_id: seatClient()}).then(r => { if (active) setConflict(r.conflict); }).catch(() => {});
    beat(); const timer = setInterval(beat, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [user, picker]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (enabled && !picker && e.ctrlKey && e.shiftKey && e.code === 'KeyD') { e.preventDefault(); setPanel(p => !p); } };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, [enabled, picker]);
  async function choose(id: string) {
    setBusy(true); setError('');
    try { await switchUser(id); saveSeat(api.mode, id); setPicker(false); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function guest(remove = false) {
    setBusy(true); setError('');
    try {
      if (remove) {
        const result = await api.request<{seat: string}>('DELETE', '/demo/guests');
        localStorage.removeItem(`village:guest:${api.mode}`);
        await switchUser(result.seat); await refresh();
      } else {
        const result = await api.request<{id: string}>('POST', '/demo/guests');
        localStorage.setItem(`village:guest:${api.mode}`, result.id);
        await switchUser(result.id);
      }
      setPanel(false);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function run(action: string, amount?: number) {
    if (action === 'reset' && !window.confirm('Reset the whole demo village? All five seats will lose their current progress.')) return;
    const body = {idempotency_key: crypto.randomUUID(), amount: amount ?? 100, reason, confirm: action === 'reset' ? 'RESET' : ''};
    await send(action, body);
  }
  async function send(action: string, body: object) {
    setBusy(true); setError(''); setRetry({action, body});
    try { await api.request('POST', `/demo/debug/${action}`, body); setRetry(null); await refresh(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <>
    <button className="text-button demo-seat-switch" onClick={() => setPicker(true)}>Testing as {person.display_name}{user === localStorage.getItem(`village:guest:${api.mode}`) ? ' (demo guest)' : ''} · switch{conflict && <span role="status" className="demo-seat-conflict" title={`Another tester chose ${person.display_name} in the last 10 minutes.`} aria-label={`Another tester chose ${person.display_name} in the last 10 minutes.`}>Shared seat</span>}</button>
    {enabled && <button className="button secondary demo-debug-toggle" aria-label="Debug menu" onClick={() => setPanel(true)}>{<VillageIcon name="info" size={16}/>}</button>}
    {picker && <Dialog title="Who are you testing as?" eyebrow="Demo seats" busy={busy || !savedSeat(api.mode)} onClose={() => setPicker(false)}>
      {onSignIn && <button className="button secondary" onClick={onSignIn}>Sign in with your account</button>}
      <p>Choose your own teammate to try goals and check-ins. Your browser remembers this choice.</p>
      <div className="demo-seat-grid">{village.villagers.filter(p => ['Iraj','Lance','Stefanny','Maya','Mario'].includes(p.display_name)).map(p => <button className="button secondary" key={p.user_id} disabled={busy} onClick={() => void choose(p.user_id)}><Portrait person={p} large />{p.display_name}</button>)}</div>
      {error && <p role="alert">{error}</p>}
    </Dialog>}
    {enabled && panel && <Dialog title={`Debug · ${person.display_name}`} eyebrow="Demo rehearsal" busy={busy} onClose={() => setPanel(false)}>
      <a className="text-button" href="/lab">Demo Lab</a>
      <p>Actions affect this seat. Events, weather and village reset affect everyone.</p>
      <label>Reason<input value={reason} maxLength={200} onChange={e => setReason(e.target.value)} /></label>
      <div className="demo-debug-grid"><button className="button secondary" disabled={busy} onClick={() => void guest()}>Start as a new person</button><button className="button secondary" disabled={busy} onClick={() => void guest(true)}>Remove guest users</button>{[100,500,2000].map(n => <button className="button secondary" disabled={busy || !reason.trim() || !!retry} key={n} onClick={() => void run('xp', n)}><Reward amount={n} /></button>)}
      {[100,500,2000].map(n => <button className="button secondary" disabled={busy || !reason.trim() || !!retry} key={`coins-${n}`} onClick={() => void run('coins', n)}><CurrencyAmount amount={n} currency="coins" signed /></button>)}
      {Object.entries({'inventory':'Clear my inventory', 'week':'Reset my week', 'goal-done':'Mark my goal done', 'event':'Random Mayor event', 'weather':'Toggle festival night', 'reset':'Reset whole demo village'}).map(([action, label]) => <button className="button secondary" disabled={busy || !reason.trim() || !!retry} key={action} onClick={() => void run(action)}>{label}</button>)}</div>
      <details><summary>Trigger disaster ▸</summary><div className="demo-debug-grid">{['scorch','outbreak','blackout','blight'].map(disaster => <button className="button secondary" key={disaster} disabled={busy || !!retry || !!village.world?.disaster} onClick={() => void send('disaster', {idempotency_key:crypto.randomUUID(),reason,disaster})}>{disaster}</button>)}</div></details>
      <button className="button secondary" disabled={busy || !!retry || !village.world?.disaster} onClick={() => void run('repair')}>Repair now</button>
      {error && <p role="alert">{error}</p>}
      {retry && !busy && <><button className="button secondary" onClick={() => void send(retry.action, retry.body)}>Retry same action</button><button className="text-button" onClick={() => setRetry(null)}>Dismiss retry</button></>}
    </Dialog>}
  </>;
}
