import type { CompetitionDetail, Village } from '../api/types';

// Optional presentation metadata is fixture-only until the API contract supports it.
export type ArenaCompetition = CompetitionDetail & {
  mode?: 'ordinal' | 'team'; starts_at?: string; ends_at?: string; created_at?: string;
  team_by_user?: Record<string, string>; entry_xp?: number; auditor_fee_bps?: number;
};
export type Standing = { user_id: string; points: number; rank: number; completed_at?: string; submitted_at?: string; team?: string; percent: number };
export function potIntent(c: CompetitionDetail): number {
  // The deployed API uses entry_lamports_intent; older fixtures use entry_lamports.
  return c.participants.reduce((sum,p)=>{
    const value=(p as typeof p & {entry_lamports_intent?:number}).entry_lamports_intent ?? p.entry_lamports ?? c.entry_lamports ?? 0;
    return sum+(Number.isFinite(value)&&value>=0?value:0);
  },0)/1e9;
}
export function standings(c: ArenaCompetition): Standing[] {
  const mode = c.scoring ?? 'cumulative';
  const rows = c.participants.map(p => {
    let points = 0, completed_at: string | undefined, submitted_at: string | undefined;
    const accepted = c.entries.filter(e => e.user_id === p.user_id && e.decision === 'confirmed').sort((a,b) =>
      (a.confirmed_at ?? a.created_at ?? '').localeCompare(b.confirmed_at ?? b.created_at ?? '') ||
      (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id));
    for (const e of accepted) {
      points += mode === 'cumulative' ? Math.max(0,e.points) : e.value ?? 0;
      if (mode === 'ordinal' && !completed_at && points >= (c.target ?? 1)) {
        completed_at = e.confirmed_at ?? e.created_at; submitted_at = e.created_at;
      }
    }
    return {user_id:p.user_id,points,completed_at,submitted_at,team:c.team_by_user?.[p.user_id]};
  });
  rows.sort((a,b) => mode === 'ordinal'
    ? Number(!a.completed_at)-Number(!b.completed_at) || (a.completed_at ?? '~').localeCompare(b.completed_at ?? '~') || (a.submitted_at ?? '~').localeCompare(b.submitted_at ?? '~') || a.user_id.localeCompare(b.user_id)
    : b.points-a.points || a.user_id.localeCompare(b.user_id));
  return rows.map((r,i) => {
    const total = rows.filter(p => p.team === r.team).reduce((n,p) => n+p.points,0);
    return {...r, rank: mode === 'ordinal' ? i+1 : rows.findIndex(p => p.points === r.points)+1,
      percent: c.target ? Math.min(100,r.points/c.target*100) : total ? r.points/total*100 : 0};
  });
}
export function modeLabel(c: Pick<CompetitionDetail,'scoring'|'unit'>): string {
  const mode = c.scoring ?? 'cumulative';
  return `${mode[0].toUpperCase()+mode.slice(1)}${c.unit ? ` / ${c.unit}` : ''}`;
}
export const scoringHelp = {
  cumulative: 'Sum of confirmed entry points; highest total wins.',
  scoreboard: 'Track confirmed values in your unit; highest total wins.',
  ordinal: 'First confirmed completion or target reached wins; submission time breaks ties.',
};

export function arenaPosition(index: number, rank: number, open: boolean): [number,number,number] {
  if (open) return [(index%7-3)*1.35, .16, 11.3+Math.floor(index/7)*1.7];
  // Tied scores share a badge, but use unique physical slots.
  if (index < 3 && rank <= 3) return [[0,1.21,0],[-2,.86,0],[2,.56,0]][index] as [number,number,number];
  const angle = (index-3)*2.399963;
  const radius = 3.4+Math.sqrt(Math.max(0,index-3))*.45;
  return [Math.cos(angle)*radius,.16,Math.sin(angle)*radius];
}
export const entryState = (decision: string) => decision === 'confirmed' ? '✓ verified' : decision === 'rejected' ? '✗ rejected' : '⏳ pending';

export function arenaFixtures(village: Village): (ArenaCompetition & {village_id: string})[] {
  const ids = village.villagers.map(v => v.user_id);
  if (ids.length < 3) return [];
  const fixtures: (ArenaCompetition & {village_id:string})[] = ['ordinal', 'team'].map((mode,k) => {
    const id=`arena-demo-${village.id}-${mode}`, people=ids.slice(1,5);
    return {id, village_id:village.id, title:k ? 'Race to the summit' : 'The seven-day sprint', terms:k ? 'Each confirmed point counts toward your team score.' : 'One focused session per day. Submit evidence; your auditor confirms points. Highest score wins.', friendly:false, creator_id:ids[0], auditor_id:ids[0], entry_lamports:0, status:'open', result:null, mode:mode as 'ordinal'|'team', starts_at:'2026-10-01T00:00:00Z', ends_at:'2027-10-31T23:59:59Z', team_by_user:Object.fromEntries(people.map((uid,i)=>[uid,i%2?'Sage':'Terracotta'])), participants:people.map(user_id=>({user_id,entry_lamports:0})), entries:people.flatMap((user_id,i)=>[0,1,2].map((j)=>({id:`${id}-${i}-${j}`,user_id,body:['Focused session completed.','Progress submitted for review.','Incomplete evidence; please resubmit.'][j],evidence_asset_id:'arena-demo-evidence.svg',idempotency_key:`demo-${i}-${j}`,review:null,decision:(['confirmed','pending','rejected'] as const)[j],points:j===0 ? 30-i*7:0,reason:j===0?'Session and result checked.':j===2?'Missing completion evidence.':null,created_at:`2026-10-0${j+2}T18:00:00Z`})))};
  });
  fixtures.push({...fixtures[0],id:`arena-demo-${village.id}-open`,title:'The next chapter',terms:'Join the next reading challenge. One chapter, one evidence photo, one step forward.',auditor_id:ids.at(-1),participants:[{user_id:ids[1],entry_lamports:10000000}],entries:[],entry_lamports:10000000,starts_at:'2026-10-11T00:00:00Z'});
  return fixtures;
}
