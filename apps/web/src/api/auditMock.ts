import {parseSplit} from '../components/payouts';
import { arenaFixtures, standings } from '../components/colosseumData';
import { monday } from './fixtures';
import { levelFor, type FeedItem, type CompetitionDetail, type CompetitionEntry, type Grade, type Profile, type Village, type WeekState } from './types';
type State = { feed: FeedItem[]; village: Village; profiles: Record<string, Profile> };
type Fail = (status: number, message: string) => never;
const uid = () => crypto.randomUUID();
export class AuditMock {
  private seeded = new Set<string>();
  private weeks = new Map<string, WeekState>();
  private assigned = new Map<string, Set<string>>();
  private votes = new Map<string, Set<string>>();
  private competitions = new Map<string, CompetitionDetail & { village_id: string }>();
  constructor(private fail: Fail) {}
  goalEdit(vid: string, gid?: string) {
    const week = this.weeks.get(`${vid}:${monday()}`);
    if (week?.status === 'finalized') this.fail(409, 'Week already finalized.');
    const goal = week?.goals.find(g => g.id === gid);
    if (goal) { goal.grade = null; goal.suggestion = null; }
  }
  route(method: string, parts: string[], user: string, data: Record<string, unknown>, state: State, owns: (key: string) => boolean): unknown {
    const fail = this.fail, vid = state.village.id;
    const text = (v: unknown, max = 2000) => typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : fail(422, 'Text is required and must fit the limit.');
    const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fail(422, `Use an integer from ${min} to ${max}.`);
    const achievement = (user_id: string, type: string, title: string) => state.feed.unshift({id: uid(), created_at: new Date().toISOString(), user_id, type, text: `${state.profiles[user_id].villager.display_name}: ${title}`, payload: {title}});
    const reward = (id: string, xp: number) => { const v = state.profiles[id].villager; const before = v.level; v.xp += xp; v.coins += xp; v.level = levelFor(v.xp); if (v.level > before) achievement(id, 'level_up', `Reached level ${v.level}`); };
    if (parts[2] === 'weekly') {
      const start = parts[3] === 'current' ? monday() : parts[3];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || new Date(start).getUTCDay() !== 1 || start > monday()) return fail(422, 'Use a current or past UTC Monday.');
      const key = `${vid}:${start}`;
      let week = this.weeks.get(key);
      if (!week) {
        if (start !== monday()) return fail(404, 'Week not initialized.');
        const previous = new Date(start); previous.setUTCDate(previous.getUTCDate() - 7);
        const prior = this.assigned.get(`${vid}:${previous.toISOString().slice(0, 10)}`);
        const auditor = state.village.villagers.length > 1 ? state.village.villagers.find(v => !prior?.has(v.user_id))?.user_id ?? null : null;
        week = { id: uid(), village_id: vid, week_start: start, auditor_id: auditor, generation: 1, status: 'open', winner_id: null, finalized_at: null, votes: 0, stars: [], goals: [] };
        this.weeks.set(key, week); this.assigned.set(key, new Set(auditor ? [auditor] : [])); this.votes.set(key, new Set());
      }
      const assigned = this.assigned.get(key)!;
      week.goals = Object.values(state.profiles).flatMap(p => p.goal?.week_start === start ? [{ ...p.goal, excluded: assigned.has(p.goal.user_id), suggestion: week!.goals.find(g => g.id === p.goal!.id)?.suggestion ?? null, grade: week!.goals.find(g => g.id === p.goal!.id)?.grade ?? null }] : []);
      if (method === 'GET' && parts.length === 4) return week;
      if (method !== 'POST') return fail(404, 'Endpoint not found.');
      if (parts[4] === 'insufficient') {
        if (week.status !== 'open') return fail(409, 'Week already finalized.');
        if (data.generation !== week.generation) return fail(409, 'Stale auditor generation; refresh the week.');
        if (!week.auditor_id || user === week.auditor_id) return fail(403, 'Only other villagers may vote.');
        const voters = this.votes.get(key)!;
        const next = new Set([...voters, user]);
        if (next.size > state.village.villagers.length / 2) {
          const replacement = state.village.villagers.find(v => !assigned.has(v.user_id));
          if (!replacement) return fail(409, 'No unused replacement auditor remains.');
          assigned.add(replacement.user_id); week.auditor_id = replacement.user_id; week.generation++; next.clear();
          week.goals.forEach(g => { g.grade = null; g.excluded = assigned.has(g.user_id); });
        }
        this.votes.set(key, next); week.votes = next.size; return week;
      }
      if (week.auditor_id !== user) return fail(403, 'Assigned auditor required.');
      if (parts[4] === 'finalize' && week.status === 'finalized') return week;
      if (week.status !== 'open') return fail(409, 'Week already finalized.');
      if (parts[4] === 'finalize') {
        const eligible = week.goals.filter(g => !g.excluded);
        if (eligible.some(g => !g.grade)) return fail(409, 'Grade all eligible goals before finalizing.');
        const total = (g: Grade) => g.ambition + g.evidence_quality + g.progress;
        const completed = eligible.filter(g => g.grade!.completed).sort((a, b) => (total(b.grade!) + (b.stretch_bonus ?? 0)) - (total(a.grade!) + (a.stretch_bonus ?? 0)) || a.user_id.localeCompare(b.user_id));
        week.winner_id = completed[0]?.user_id ?? null; week.stars = completed.map(g => g.user_id); week.status = 'finalized'; week.finalized_at = new Date().toISOString();
        for (const v of state.village.villagers) { v.has_crown = v.user_id === week.winner_id; if (week.stars.includes(v.user_id)) v.star_badges = [...(v.star_badges ?? []), {week_start: start, kind: 'star'}]; }
        for (const id of week.stars) achievement(id, 'badge_earned', 'Weekly completion star');
        if (week.winner_id) reward(week.winner_id, 100);
        return week;
      }
      const goal = week.goals.find(g => g.id === parts[5]);
      if (!goal) return fail(404, 'Goal not found.');
      if (goal.excluded) return fail(409, 'Auditors sit out this week.');
      if (parts[6] === 'suggestion') {
        goal.suggestion ??= { ambition: 4, evidence_quality: 3, progress: 4, completed: true, rationale: 'Scripted demo: a specific goal and consistent progress. Inspect the evidence before accepting; no AI was called.' };
        return {suggestion: goal.suggestion, model: 'scripted-demo'};
      }
      if (parts[6] === 'grade') {
        if (typeof data.completed !== 'boolean') return fail(422, 'Choose completion status.');
        goal.grade = { ambition: integer(data.ambition, 1, 5), evidence_quality: integer(data.evidence_quality, 1, 5), progress: integer(data.progress, 1, 5), completed: data.completed, rationale: text(data.rationale) }; return goal.grade;
      }
      return fail(404, 'Endpoint not found.');
    }
    if (!this.seeded.has(vid)) {this.seeded.add(vid); for (const c of arenaFixtures(state.village)) this.competitions.set(c.id,c);}
    if (parts.length === 3) {
      if (method === 'GET') return [...this.competitions.values()].filter(c => c.village_id === vid).reverse();
      if (method !== 'POST') return fail(404, 'Endpoint not found.');
      const friendly = data.friendly === true;
      const auditor = friendly ? undefined : typeof data.auditor_id === 'string' ? data.auditor_id : state.village.villagers.find(v => v.user_id !== user)?.user_id;
      if (!friendly && (!auditor || !state.profiles[auditor])) return fail(422, 'Choose a village auditor.');
      const lamports = integer(data.entry_lamports ?? 0, 0, 1e12);
      if (friendly && (lamports || data.auditor_id)) return fail(422, 'Friendly mode has no auditor or stakes.');
      const scoring = data.scoring ?? 'cumulative';
      if (scoring !== 'cumulative' && scoring !== 'scoreboard' && scoring !== 'ordinal') return fail(422,'Unknown scoring mode.');
      const unit = data.unit == null ? null : text(data.unit,40);
      const target = data.target == null ? null : Number(data.target);
      if (target !== null && (!Number.isFinite(target) || target <= 0 || target > 1e12)) return fail(422,'Invalid target.');
      if (scoring === 'scoreboard' && !unit) return fail(422,'Scoreboard requires a unit.');
      if (scoring === 'cumulative' && (unit || target !== null)) return fail(422,'Cumulative uses points.');
      const payout_mode = (data.payout_mode??'winner_take_all') as import('./types').PayoutMode;
      const ranked_bps = Array.isArray(data.ranked_bps)?data.ranked_bps as number[]:[];
      if(!['winner_take_all','proportional','ranked'].includes(payout_mode))return fail(422,'Invalid payout mode');
      if(payout_mode==='ranked'){try{parseSplit(ranked_bps.map(n=>n/100).join('/'));}catch{return fail(422,'Invalid ranked split');}}
      const c: CompetitionDetail & {village_id:string} = {payout_mode,ranked_bps,entry_coins:Number(data.entry_coins??0),deadline:data.deadline as string|undefined,scoring,unit,target,auditor_fee_bps:integer(data.auditor_fee_bps??0,0,10000),id: uid(), village_id: vid, creator_id: user, title: text(data.title, 200), terms: text(data.terms, 4000), friendly, auditor_id: auditor, entry_lamports: lamports, participants: [], entries: [], status: 'open' as const, result: null};
      this.competitions.set(c.id, c); return c;
    }
    const c = this.competitions.get(parts[3]);
    if (!c || c.village_id !== vid) return fail(404, 'Competition not found.');
    if (method === 'GET' && parts.length === 4) return c;
    if (method !== 'POST') return fail(404, 'Endpoint not found.');
    const judge = c.friendly ? c.creator_id : c.auditor_id;
    if (parts[4] === 'settle' && user !== judge) return fail(403, 'Assigned auditor required.');
    if (parts[4] === 'settle' && c.status === 'settled') return c;
    if (c.status !== 'open') return fail(409, 'Competition already settled.');
    if (parts[4] === 'join') {
      if (c.auditor_id === user) return fail(403, 'Auditor cannot enter.');
      if (!c.participants.some(p => p.user_id === user)) c.participants.push({user_id: user, entry_lamports: c.entry_lamports ?? 0}); return c;
    }
    if (parts[4] === 'entries' && parts.length === 5) {
      if (!c.participants.some(p => p.user_id === user)) return fail(403, 'Join this competition first.');
      const key = text(data.idempotency_key, 200);
      const prior = c.entries.find(e => e.user_id === user && e.idempotency_key === key); if (prior) return prior;
      const evidence = typeof data.evidence_asset_id === 'string' ? data.evidence_asset_id : null;
      if (!c.friendly && !evidence) return fail(422, 'Audited entries require a photo.');
      if (evidence && !owns(evidence)) return fail(403, 'Evidence must belong to you and this village.');
      const numeric=c.scoring==='scoreboard'||(c.scoring==='ordinal'&&c.target!=null);
      if(numeric&&(typeof data.value!=='number'||!Number.isFinite(data.value)||data.value<0||data.value>1e12))return fail(422,'Claim a numeric value.');
      if((c.scoring??'cumulative')==='cumulative'&&data.value!=null)return fail(422,'Cumulative uses points.');
      const claimed=numeric?Number(data.value):c.scoring==='ordinal'?1:null;
      const now=new Date().toISOString();
      const e: CompetitionEntry = {created_at:now,confirmed_at:c.friendly?now:null,claimed_value:claimed,value:c.friendly?claimed:null,id: uid(), user_id: user, body: text(data.body, 4000), evidence_asset_id: evidence, idempotency_key: key, decision: c.friendly ? 'confirmed' : 'pending', points: c.friendly ? 1 : 0, reason: null, review: evidence ? {verdict: 'verified', confidence: 1, reason: 'Scripted demo review. No AI was called.', model: 'scripted-demo'} : null}; c.entries.push(e); return e;
    }
    if (parts[6] === 'decision') {
      if (c.friendly || user !== c.auditor_id) return fail(403, 'Assigned auditor required.');
      const e = c.entries.find(e => e.id === parts[5]); if (!e) return fail(404, 'Entry not found.');
      if (!['confirmed', 'rejected'].includes(String(data.decision))) return fail(422, 'Choose confirm or reject.');
      const points = integer(data.points, 0, 500); if (data.decision === 'rejected' && points) return fail(422, 'Rejected entries receive zero points.');
      let value = data.value == null ? null : Number(data.value);
      if(data.decision==='confirmed' && c.scoring==='ordinal' && c.target==null)value=1;
      if(data.decision==='confirmed' && c.scoring && c.scoring!=='cumulative' && (value===null||!Number.isFinite(value)||value<0||value>1e12))return fail(422,'Confirm a numeric value.');
      if(data.decision==='rejected'&&value)return fail(422,'Rejected value must be zero.');
      if((c.scoring??'cumulative')==='cumulative'&&value!==null)return fail(422,'Cumulative uses points.');
      const reason = text(data.reason); Object.assign(e, {decision: data.decision, points, reason,value,confirmed_at:data.decision==='confirmed'?(e.decision==='confirmed'&&e.value===value?(e.confirmed_at??new Date().toISOString()):new Date().toISOString()):null}); return e;
    }
    if (parts[4] === 'settle') {
      if (c.entries.some(e => e.decision === 'pending')) return fail(409, 'Decide all entries before settlement.');
      const scores = standings(c);
      const max = Math.max(0,...scores.map(s=>s.points));
      const winners = c.scoring==='ordinal' ? (scores[0]?.completed_at ? [scores[0].user_id] : []) : scores.filter(s=>s.points>0&&s.points===max).map(s=>s.user_id);
      c.result = {winners,scores,payments_executed:false}; c.status='settled';
      for (const id of c.result.winners) achievement(id, 'competition_won', c.title);
      if (!c.friendly) scores.forEach(s => reward(s.user_id, Math.min(500, Math.floor(s.points)))); return c;
    }
    return fail(404, 'Endpoint not found.');
  }
}
