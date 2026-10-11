import { useState } from 'react';
import { api } from '../api/client';
import type { Me } from '../api/types';
import { Dialog, errorText } from './shared';

export function VillagePicker({ memberships, current, busy, onSelect, onJoined }: { memberships: Me['villages']; current: string; busy: boolean; onSelect: (id: string) => Promise<void>; onJoined: (id: string) => Promise<void> }) {
  const [creating, setCreating] = useState(false), [created, setCreated] = useState<string | null>(null), [name, setName] = useState(''), [joining, setJoining] = useState(false), [code, setCode] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  return <>
    <select className="village-picker" aria-label="Village" value={current} disabled={busy} onChange={e => { if (e.target.value === '__join') { setError(''); setJoining(true); } else void onSelect(e.target.value); }}>
      {memberships.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
      <option value="__join">Join with invite code</option>
    </select>
    <button className="button secondary create-village" disabled={busy} onClick={() => { setError(''); setCreated(null); setName(''); setCreating(true); }}>Create new village</button>
    {creating && <Dialog title="Create new village" eyebrow="A PLACE FOR YOUR PEOPLE" busy={saving} onClose={() => setCreating(false)}>
      <form onSubmit={e => { e.preventDefault(); if (saving || !name.trim()) return; setSaving(true); setError(''); void (async () => {
        const id = created ?? (await api.createVillage(name.trim())).village.id;
        setCreated(id); await onJoined(id); setCreating(false);
      })().catch(e => setError(errorText(e))).finally(() => setSaving(false)); }}>
        <label htmlFor="new-village-name">Village name</label><input id="new-village-name" autoFocus required maxLength={80} value={name} disabled={saving || !!created} onChange={e => setName(e.target.value)} />
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="button primary full" disabled={saving || !name.trim()}>{saving ? 'Opening village...' : created ? 'Retry opening village' : 'Create village'}</button>
      </form>
    </Dialog>}
    {joining && <Dialog title="Join another village" eyebrow="A PLACE FOR YOUR PEOPLE" busy={saving} onClose={() => setJoining(false)}>
      <form onSubmit={e => { e.preventDefault(); if (saving || !code.trim()) return; setSaving(true); setError(''); void api.joinVillage(code.trim()).then(result => onJoined(result.village.id)).then(() => { setJoining(false); setCode(''); }).catch(e => setError(errorText(e))).finally(() => setSaving(false)); }}>
        <label htmlFor="join-invite">Invite code</label><input id="join-invite" required autoFocus value={code} disabled={saving} onChange={e => setCode(e.target.value)} />
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="button primary full" disabled={saving || !code.trim()}>{saving ? 'Joining…' : 'Join village'}</button>
      </form>
    </Dialog>}
  </>;
}
