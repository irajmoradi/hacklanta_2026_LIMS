import { RepairTasks } from '../components/RepairTasks';
import { askMayor } from './repairPlan';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { VillageScene } from '../scene/VillageScene';
import { Celebration } from '../components/Celebration';
import { newBuildings } from '../api/world';
import type { Disaster, Village } from '../api/types';
import { buildingName, LabSandbox, LEVELS, MAX_LEVEL, POPULATIONS } from './sandbox';

const SandboxScene = memo(VillageScene);
const noop = () => {};
const descriptions = {
  town: ['A little place. A lot of life.', 'Meet a growing neighborhood, with everyday routines happening all around you.'],
  disasters: ['A town that pulls together.', 'When things go wrong, small contributions bring the village back to life.'],
  futures: ['Every level opens a future.', 'Start with the essentials. See what your friends can build together.'],
};
export default function WorldDemo({mode}: {mode: keyof typeof descriptions}) {
  const [client] = useState(() => new LabSandbox(mode === 'town' ? 50 : 10, mode === 'futures' ? 1 : MAX_LEVEL));
  const [village, setVillage] = useState(() => client.snapshot());
  const [fps, setFps] = useState(0), [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false), [celebration, setCelebration] = useState('');
  const clearCelebration = useCallback(() => setCelebration(''), []);
  const [asking, setAsking] = useState(false), [steps, setSteps] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function ask() {
    if (!disaster || asking) return;
    const controller = new AbortController(); request.current = controller;
    setAsking(true); setSteps([]);
    try {
      const plan = await askMayor(disaster.kind, text => setSteps(old => [...old, text]), controller.signal);
      if (!controller.signal.aborted) setVillage(client.plan(plan));
    } catch { /* Unmount cancels the rehearsal. */ } finally {setAsking(false);}
  }
  const world = village.world!, disaster = world.disaster;
  const changeLevel = useCallback((level: number) => {
    const before = client.snapshot(), next = client.level(level);
    const unlocked = newBuildings(before, next);
    setCelebration(unlocked.length ? `New building unlocked: ${unlocked.map(b => b.name).join(', ')}` : '');
    setVillage(next);
  }, [client]);
  useEffect(() => {
    if (!playing) return;
    if (world.level >= MAX_LEVEL) {setPlaying(false); return;}
    const timer = setTimeout(() => changeLevel(world.level + 1), 4500);
    return () => clearTimeout(timer);
  }, [playing, world.level, changeLevel]);
  const update = (next: Village) => {setSelected(null); setVillage(next);};
  const title = descriptions[mode];
  const ready = !!disaster && (disaster.repair_plan ? disaster.repair_plan.tasks.every(t => t.progress >= t.target) : disaster.checkins >= disaster.target_checkins && disaster.people >= disaster.target_people);
  return <article className="lab-demo">
    <header className="lab-heading"><span className="lab-eyebrow">{mode === 'town' ? '01 / THE NEIGHBORHOOD' : mode === 'disasters' ? '02 / RESILIENCE' : '03 / SHARED PROGRESS'}</span><h2>{title[0]}</h2><p>{title[1]}</p></header>
    <section className="lab-controls" aria-label="Simulation controls">
      {mode === 'town' && <><label className="lab-range">Neighbors <strong>{village.villagers.length}</strong><input aria-label="Population" type="range" min="0" max="3" step="1" value={POPULATIONS.indexOf(village.villagers.length as 10 | 25 | 50 | 100)} onChange={e => update(client.population(POPULATIONS[Number(e.target.value)]))}/><span className="lab-ticks">{POPULATIONS.map(n => <span key={n}>{n}</span>)}</span></label><p>Walk, read, visit, unwind.<br/>Synthetic neighbors with their own daily routines.</p></>}
      {mode === 'disasters' && <><div className="lab-actions">{(['scorch', 'outbreak', 'blackout', 'blight'] as Disaster['kind'][]).map(kind => <button disabled={asking} key={kind} aria-pressed={disaster?.kind === kind} onClick={() => {setSteps([]); setCelebration(''); update(client.disaster(kind));}}>{kind}</button>)}</div><div className="lab-actions"><button disabled={asking || !disaster || ready || !!disaster.repair_plan} onClick={() => update(client.checkins())}>Simulate check-ins +3</button><button disabled={asking || !ready} onClick={() => {update(client.repair()); setCelebration('Village rebuilt — together!');}}>Repair</button><button disabled={asking} onClick={() => {setSteps([]); update(client.clear()); setCelebration('');}}>Clear</button></div></>}
      {mode === 'futures' && <><div className="lab-actions"><button aria-label="Previous level" disabled={world.level === 1} onClick={() => {setPlaying(false); changeLevel(world.level - 1);}}>−</button><strong>Level {world.level} / {MAX_LEVEL}</strong><button aria-label="Next level" disabled={world.level === MAX_LEVEL} onClick={() => {setPlaying(false); changeLevel(world.level + 1);}}>+</button><button onClick={() => {if (!playing && world.level === MAX_LEVEL) changeLevel(1); setPlaying(!playing);}}>{playing ? 'Pause' : 'Autoplay'}</button></div><label className="lab-range">Village level<input aria-label="Village level" type="range" min="1" max={MAX_LEVEL} value={world.level} onChange={e => {setPlaying(false); changeLevel(Number(e.target.value));}}/><span className="lab-ticks">{LEVELS.map(row => <span key={row.level}>{row.level}</span>)}</span></label></>}
    </section>
    {mode === 'disasters' && <section className="lab-controls lab-repair" aria-label="Mayor repair rehearsal">
      <button disabled={!disaster || asking} onClick={() => void ask()}>{asking ? 'The Mayor is choosing…' : 'Ask the Mayor'}</button>
      <p>Uses an example group. This rehearsal never changes a village.</p>
      <ol aria-live="polite">{steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
      {disaster?.repair_plan && <><RepairTasks disaster={disaster}/><div className="lab-actions">{disaster.repair_plan.tasks.map(t => <button key={t.kind} disabled={asking || t.progress >= t.target} onClick={() => update(client.task(t.kind))}>Simulate {t.title}</button>)}</div></>}
    </section>}
    <div className="lab-stage"><SandboxScene sandbox townShape={mode === 'town' ? 'lab-square' : undefined} village={village} selected={selected} onSelect={setSelected} onShop={noop} onMayor={noop} onGazette={noop} onReading={noop} onFps={setFps}/><div className="lab-meter" data-testid="lab-fps">{fps || '…'} FPS <span>· {village.villagers.length} neighbors</span></div></div>
    <footer className="lab-status" aria-live="polite">
      {mode === 'town' && <><strong>{selected ? village.villagers.find(p => p.user_id === selected)?.display_name : 'A living neighborhood'}</strong><span>Drag to explore · Scroll to zoom · Click a neighbor to follow</span></>}
      {mode === 'disasters' && (disaster ? <><strong>{disaster.title}</strong><span>{disaster.closed_building ? `${buildingName(disaster.closed_building)} closed · ` : 'Town lights out · '}{disaster.pets_away ? 'Shelter pets away · ' : ''}{disaster.repair_plan ? `${disaster.repair_plan.tasks.filter(t => t.progress >= t.target).length}/${disaster.repair_plan.tasks.length} tasks complete` : `${disaster.checkins}/${disaster.target_checkins} check-ins / ${disaster.people}/${disaster.target_people} people`}</span><progress aria-label="Repair progress" value={disaster.repair_plan ? disaster.repair_plan.tasks.reduce((n,t) => n+t.progress,0) : disaster.checkins} max={disaster.repair_plan ? disaster.repair_plan.tasks.reduce((n,t) => n+t.target,0) : disaster.target_checkins}/></> : <><strong>The village is thriving.</strong><span>Choose a disaster to begin a local rehearsal.</span></>)}
      {mode === 'futures' && <><strong>{world.xp.toLocaleString()} shared XP · Level {world.level}</strong><span>Unlocked this level: {LEVELS.find(row => row.level === world.level)!.buildings.map(buildingName).join(', ')}</span></>}
    </footer>
    {celebration && <Celebration aboveDialog title={celebration} onDone={clearCelebration}/ >}
  </article>;
}
