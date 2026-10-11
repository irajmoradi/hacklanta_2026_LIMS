import { RepairTasks } from './RepairTasks';
import type { CSSProperties } from 'react';
import type { Village, WeekState } from '../api/types';
import { MayorScenePortrait as Portrait } from './MayorScenePortrait';
import { VillageIcon } from './VillageIcon';

export function MayorSceneDashboard({ village, week }: { village: Village; week: WeekState | null }) {
  const goals = week?.goals.filter(g => !g.excluded) ?? [];
  const done = goals.filter(g => g.status === 'done' || g.grade?.completed).length;
  const leaders = [...village.villagers].sort((a, b) => b.xp - a.xp).slice(0, 3);
  const disaster = village.world?.disaster;
  const challenges = village.active_events.filter(e => e.kind === 'challenge' && e.status === 'active');
  return <section className="mayor-dashboard" aria-label="Village health dashboard">
    <div className="mayor-health-heading"><div><span className="mayor-overline">OUR LITTLE WORLD</span><h3>{village.name}</h3></div><span className="mayor-health-status"><VillageIcon name={disaster ? 'trowel' : 'sprout'}/>{disaster ? 'Rebuilding together' : 'Room to grow'}</span></div>
    <div className="mayor-neighbors" role="group" tabIndex={0} aria-label="Village neighbors">{village.villagers.map(person => <div key={person.user_id}><Portrait person={person}/><span>{person.display_name}</span></div>)}{!village.villagers.length && <p>Your first neighbors are on their way.</p>}</div>
    <div className="mayor-stats">
      <article className="mayor-goal-stat"><div className="mayor-goal-ring" style={{ '--goal-progress': `${goals.length ? done / goals.length * 100 : 0}%` } as CSSProperties} role="img" aria-label={week ? `${done} of ${goals.length} weekly goals completed` : 'Weekly progress unavailable'}><strong>{week ? `${done}/${goals.length}` : '—'}</strong></div><div><h4>Weekly goals</h4><p>{!week ? 'Progress is still arriving.' : !goals.length ? 'A new week, a fresh start.' : 'Completed by our neighbors'}</p></div></article>
      <article><VillageIcon name="sun" size={28}/><strong className="mayor-stat-number">{Math.max(0, ...village.villagers.map(v => v.streak_days))} days</strong><h4>Longest current streak</h4><p>{village.villagers.filter(v => v.streak_days > 0).length} neighbors keeping a streak</p></article>
    </div>
    <section className="mayor-leaders"><h4>Village XP leaders</h4>{leaders.map((person, i) => <div className="mayor-leader" key={person.user_id}><b>{i + 1}</b><Portrait person={person}/><div><div className="mayor-leader-label"><strong>{person.display_name}</strong><span>{person.xp.toLocaleString()} XP</span></div><div className="mayor-xp-track" aria-hidden="true"><i style={{ width: `${leaders[0].xp ? person.xp / leaders[0].xp * 100 : 0}%` }}/></div></div></div>)}{!leaders.length && <p>The first check-in starts the story.</p>}</section>
    <section className="mayor-active-challenges"><h4>{disaster ? 'Our next step: rebuild' : 'Active challenges'}</h4>{disaster ? <><p>{disaster.body}</p><RepairTasks disaster={disaster}/></> : challenges.length ? challenges.map(event => <article key={event.id}><VillageIcon name="flag"/><div><strong>{event.title}</strong><p>{event.body}</p><span>{event.ends_at ? `Through ${new Date(event.ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Open now'} · Progress shared in check-ins</span></div></article>) : <p>No active challenges. A good moment to cheer on a neighbor.</p>}</section>
  </section>;
}
