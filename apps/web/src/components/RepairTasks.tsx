import type { Disaster } from '../api/types';

export function repairFraction(d: Disaster) {
  return d.repair_plan ? Math.min(...d.repair_plan.tasks.map(t => t.progress / t.target), 1)
    : Math.min(d.checkins / d.target_checkins, d.people / d.target_people, 1);
}

export function RepairTasks({disaster: d}: {disaster: Disaster}) {
  if (!d.repair_plan) return <><label>Check-ins · {d.checkins}/{d.target_checkins}<progress max={Math.max(1, d.target_checkins)} value={d.checkins}/></label><label>Neighbors helping · {d.people}/{d.target_people}<progress max={Math.max(1, d.target_people)} value={d.people}/></label></>;
  return <section aria-label="Repair tasks">
    {d.repair_plan.tasks.map(t => <label key={t.kind} style={{display: 'block'}}>{t.title} · {t.progress}/{t.target}<progress aria-label={t.title} value={t.progress} max={t.target}/></label>)}
    <p>Attach a photo and choose a task when you check in. Verified evidence counts toward repairs.</p>
    <details><summary>Why the Mayor chose these</summary><p>{d.repair_plan.reasoning}</p><small>{d.repair_plan.example ? 'Example plan · ' : ''}{d.repair_plan.model}</small></details>
  </section>;
}
