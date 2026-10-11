import { RepairTasks, repairFraction } from './RepairTasks';
import { VillageIcon } from './VillageIcon';
import { useEffect, useId, useRef, useState } from 'react';
import type { Disaster, MayorEvent } from '../api/types';

export function VillageAlerts({ disaster: d, events, onRepair, onEvents }: {
  disaster?: Disaster | null; events: MayorEvent[]; onRepair: () => void; onEvents: () => void;
}) {
  const active = events.filter(e => ['challenge', 'random_event'].includes(e.kind) && e.status === 'active' && e.id !== d?.repair_event_id);
  const identity = [d?.repair_event_id, ...active.map(e => e.id)].filter(Boolean).join(':');
  const [open, setOpen] = useState(false);
  const badge = useRef<HTMLButtonElement>(null), root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => { setOpen(!!identity); }, [identity]);
  useEffect(() => {
    if (!open) return;
    const minimize = () => {
      if (root.current?.contains(document.activeElement) && document.activeElement !== badge.current) badge.current?.focus();
      setOpen(false);
    };
    const timer = window.setTimeout(minimize, 6000);
    const outside = (e: Event) => { if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') minimize();
      else if (!(e.target instanceof HTMLElement && e.target.closest('input,textarea,select,button,[contenteditable=true]')) && /^(w|a|s|d| |[123]|c|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/i.test(e.key)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('wheel', outside, { capture: true, passive: true });
    document.addEventListener('keydown', key);
    return () => { clearTimeout(timer); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('wheel', outside, true); document.removeEventListener('keydown', key); };
  }, [open, identity]);
  const count = active.length + Number(!!d);
  if (!count) return null;
  const progress = d ? repairFraction(d) : 0;
  return <div ref={root} className="village-alerts">
    <button ref={badge} className="alerts-badge" aria-label={`Alerts, ${count} active${d ? `, repair ${Math.round(progress * 100)}%` : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}>
      <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" className="alerts-track"/><circle cx="22" cy="22" r="19" pathLength="100" strokeDasharray={`${progress * 100} 100`} className="alerts-progress"/></svg>
      <span aria-hidden="true"><VillageIcon name="warning" size={18}/></span><small aria-hidden="true">{count}</small>
    </button>
    {open && <section id={id} className="alerts-dropdown" aria-label="Village alerts">
      <header><strong>Alerts · {count}</strong><button aria-label="Minimize alerts" onClick={() => {setOpen(false); badge.current?.focus();}}>−</button></header>
      {d && <article aria-label="Village disaster" data-disaster={d.kind}>
        <strong><VillageIcon name={d.kind === 'outbreak' ? 'paw' : 'warning'} size={18}/> {({ scorch: 'Meteor scorch', outbreak: 'Shelter outbreak', blackout: 'Storm blackout', blight: 'Garden blight' })[d.kind]}</strong>
        <p>{d.body}</p>
        <RepairTasks disaster={d}/>
        <small title={`First deadline: ${new Date(d.deadline).toLocaleString()}. Photo task progress is kept; legacy check-ins count the last 48 hours.`}>{d.pets_away ? 'Pets away · repair or use a Revival potion.' : 'Late repairs still count.'}</small>
        <button className="button secondary" onClick={() => {setOpen(false); onRepair();}}>Help repair · check in</button>
      </article>}
      {active.map(e => <article key={e.id}><strong>{e.title}</strong><button className="text-button" onClick={() => {setOpen(false); onEvents();}}>View challenge →</button></article>)}
    </section>}
  </div>;
}
