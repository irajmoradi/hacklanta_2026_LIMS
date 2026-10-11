import { HeadlineTicker } from './Gazette';
import { VillageIcon } from './VillageIcon';
import { CurrencyAmount } from './Currency';
import { useState } from 'react';
import type { Village } from '../api/types';
import { buildings, upcoming } from '../api/world';
import { Dialog, errorText } from './shared';

export function VillagePanel({ village, onClose, refresh, onPhoto, onGazette, onIssue }: { village: Village; onClose: () => void; refresh: () => Promise<void>; onPhoto: () => void; onGazette: () => void; onIssue: (id: string | null) => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const world = village.world;
  const event = [...village.active_events].sort((a, b) => (Date.parse(b.created_at ?? '') || 0) - (Date.parse(a.created_at ?? '') || 0)).find(e => e.kind === 'random_event') ?? village.active_events[0];
  return <Dialog title="Village growth" eyebrow={village.name} onClose={onClose}>
    <div className="village-growth">
      <section aria-label="Village Gazette"><h3>Village Gazette</h3><HeadlineTicker vid={village.id} onOpen={onGazette} onIssue={onIssue}/><button className="button secondary" onClick={onGazette}>Read the Village Gazette</button></section>
      {world ? <><div className="growth-level"><span>Level {world.level}</span><strong><CurrencyAmount amount={world.xp} currency="XP" /> collective</strong></div>
        <progress aria-label="Village level progress" value={Math.max(0, world.xp)} max={Math.max(1, world.next_level_xp ?? world.xp)} />
        <p className="help-text">{world.next_level_xp == null ? 'All current levels unlocked.' : <><CurrencyAmount amount={Math.max(0, world.next_level_xp - world.xp)} currency="XP" /> to the next level</>}</p>
        <p className="world-weather"><VillageIcon name="sun" size={16}/> {world.weather} · {world.time_of_day ?? `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} local time`}</p>
        <h3>Our buildings</h3><ul className="building-list">{buildings(world).map(b => <li key={b.id}><span aria-hidden="true">✦</span> {b.name}<small>Unlocked</small></li>)}</ul>
        {!world.unlocked.length && <p>No buildings unlocked yet; check in to earn village XP.</p>}
        <h3>Growing toward</h3><ul className="building-list">{upcoming(world).map(b => <li key={b.id}>{b.name}<small><CurrencyAmount amount={Math.max(0, b.xp - world.xp)} currency="XP" /> needed</small></li>)}</ul>
        {!world.upcoming.length && <p>All available buildings are built.</p>}
      </> : <p>Village growth is not available on this server yet. Your villagers and check-ins are ready to use.</p>}
      <article className="world-event"><p className="eyebrow">LATEST FROM THE MAYOR</p><h3>{event?.title ?? 'A quiet day in the village'}</h3><p>{event?.body ?? 'Your next shared adventure is on its way.'}</p></article>
      <div className="growth-actions"><button className="button primary" onClick={onPhoto}>Our group photo</button><button className="button secondary" disabled={busy} onClick={() => { setBusy(true); setError(''); void refresh().catch(e => setError(errorText(e))).finally(() => setBusy(false)); }}>{busy ? 'Refreshing…' : 'Refresh village'}</button></div>
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  </Dialog>;
}
