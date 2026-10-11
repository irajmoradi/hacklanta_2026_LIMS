import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { RepairKind, RepairPlan, Village } from '../api/types';

export function useRepairTasks(vid: string) {
  const [tasks, setTasks] = useState<RepairPlan['tasks']>([]);
  const [repairTask, setRepairTask] = useState<RepairKind | ''>('');
  useEffect(() => {
    let active = true;
    setTasks([]); setRepairTask('');
    void api.request<Village>('GET', `/villages/${vid}`).then(v => {
      if (active) setTasks(v.world?.disaster?.repair_plan?.tasks ?? []);
    }).catch(() => {});
    return () => {active = false;};
  }, [vid]);
  return {tasks, repairTask, setRepairTask};
}

export function RepairTaskPicker({tasks, value, onChange}: {tasks: RepairPlan['tasks']; value: RepairKind | ''; onChange: (v: RepairKind | '') => void}) {
  return tasks.length ? <label>Repair task<select aria-label="Repair task" value={value} onChange={e => onChange(e.target.value as RepairKind | '')}><option value="">No repair task</option>{tasks.map(t => <option key={t.kind} value={t.kind}>{t.title} ({t.progress}/{t.target})</option>)}</select><small>Photo evidence required. Shared activities need a photo showing at least two people taking part.</small></label> : null;
}
