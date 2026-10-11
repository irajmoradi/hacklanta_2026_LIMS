import { DisasterContext } from './DisasterBanner';
import { useContext, useEffect, useId, useState } from 'react';
import { api } from '../api/client';
import { idleActivities } from '../api/idleActivity';
import type { IdleActivity, Villager } from '../api/types';
import { errorText } from './shared';

export function IdleActivityPicker({ value, hasPet, onChange, disabled = false }: {
  value: IdleActivity; hasPet: boolean; onChange: (value: IdleActivity) => void; disabled?: boolean;
}) {
  const hint = useId();
  const blight = useContext(DisasterContext)?.kind === "blight";
  return <div className="idle-picker"><label>Idle activity
    <select value={value} disabled={disabled} aria-describedby={!hasPet ? hint : undefined}
      onChange={e => onChange(e.target.value as IdleActivity)}>
      {Object.entries(idleActivities).map(([id, label]) => <option key={id} value={id} disabled={id === 'walk_pet' && !hasPet || id === 'gardening' && blight}>{label}</option>)}
    </select></label>
    {blight && <p className="help-text">Gardening is paused until the village repairs the blight.</p>}
    {!hasPet && <p className="help-text" id={hint}>Equip a pet in your wardrobe to choose Walking Pet.</p>}
  </div>;
}

export function ProfileIdleActivity({ person, refresh }: { person: Villager; refresh: () => Promise<void> }) {
  const [value, setValue] = useState(person.idle_activity ?? 'home');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => setValue(person.idle_activity ?? 'home'), [person.idle_activity]);
  return <><IdleActivityPicker value={value} hasPet={person.equipped.some(i => i.slot === 'pet')} disabled={busy}
    onChange={async next => {
      setBusy(true); setError('');
      try { await api.updateSettings({idle_activity: next}); setValue(next); void refresh().catch(() => setError('Activity saved; the village could not refresh.')); }
      catch (e) { setError(errorText(e)); }
      finally { setBusy(false); }
    }} />{busy && <p role="status">Saving activity…</p>}{error && <p role="alert">{error}</p>}</>;
}
