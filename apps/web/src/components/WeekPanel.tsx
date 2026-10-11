import { Evidence as EvidencePhoto } from './Evidence';
﻿import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import {reviewPage, REVIEW_PAGE_SIZE} from './reviewPage';
import type { Grade, Profile, Review, Suggestion, Village, WeekGoal, WeekState } from '../api/types';
import { PanelSkeleton, EmptyState, Dialog, errorText, Portrait } from './shared';

export { Evidence as EvidencePhoto } from './Evidence';
export function EvidenceReview({ review, photo }: { review: Review | null | undefined; photo: boolean }) {
  return <div className={`audit-review ${review?.verdict ?? 'pending'}`}><strong>{review ? `Evidence: ${review.verdict}` : photo ? 'Evidence: review pending' : 'No photo evidence'}</strong>{review && <><p>{review.reason}</p><small>{review.model || 'Model not supplied'} · {Math.round(review.confidence * 100)}% confidence · AI advice; the auditor decides</small></>}</div>;
}
const emptyGrade: Grade = { ambition: 1, evidence_quality: 1, progress: 1, completed: false, rationale: '' };
function GradeCard({ goal, name, profile, week, vid, judge, busy, run }: { goal: WeekGoal; name: string; profile?: Profile; week: WeekState; vid: string; judge: boolean; busy: boolean; run: (action: () => Promise<void>) => void }) {
  const [draft, setDraft] = useState<Grade>(goal.grade ?? emptyGrade), [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const rubric = [['ambition', 'Ambition'], ['evidence_quality', 'Evidence quality'], ['progress', 'Progress']] as const;
  const checks = profile?.check_ins.filter(c => c.goal_id === goal.id && c.created_at >= week.week_start && c.created_at < new Date(Date.parse(week.week_start) + 7 * 86400000).toISOString()) ?? [];
  return <article className="audit-card weekly-goal-card" aria-label={`${name}'s weekly goal`}>
    <div className="audit-card-heading"><h3>{goal.title}</h3><span className="audit-tag">{goal.grade ? 'Human graded' : 'Awaiting grade'}</span></div>
    <p className="help-text weekly-goal-meta">{name} · {goal.status} · {checks.length} progress updates</p>
    {goal.detail?.trim() && goal.detail.trim() !== 'Small steps count. Share the journey with your people.' && <p className="weekly-goal-detail">{goal.detail}</p>}
    {goal.stretches?.map(s => <p key={s.tier}>Stretch {s.tier}: {s.title} / {s.status} / {checks.filter(c => c.stretch_tier === s.tier).length} progress updates</p>)}
    {!!goal.stretch_bonus && <p className="reward-chip">Above &amp; beyond / +{goal.stretch_bonus} ambition bonus (if completion approved)</p>}
    <details><summary>Progress & evidence ({checks.length})</summary>{checks.map(c => <div key={c.id} className="audit-evidence"><small>{c.stretch_tier ? `Stretch ${c.stretch_tier}` : "Base goal"}</small><p>{c.body}</p><EvidenceReview review={c.review} photo={!!c.evidence_url} />{c.evidence_url && <EvidencePhoto url={c.evidence_url} review={c.review} vid={vid} checkId={c.id} />}</div>)}{!checks.length && <EmptyState>No updates for this goal yet.</EmptyState>}</details>
    {goal.grade && <p className="help-text">Human grade: {goal.grade.ambition} / {goal.grade.evidence_quality} / {goal.grade.progress} · {goal.grade.completed ? 'Completed' : 'Not completed'} · {goal.grade.rationale}</p>}
    {judge && !goal.excluded && week.status === 'open' && <fieldset disabled={busy} className="grade-editor">
      <div className="audit-actions"><button className="button secondary" onClick={() => run(async () => setSuggestion(await api.suggest(vid, week.week_start, goal.id)))}>Load AI pre-grade</button>{suggestion && <button className="text-button" onClick={() => run(async () => setSuggestion(await api.suggest(vid, week.week_start, goal.id, true)))}>Refresh AI suggestion</button>}</div>
      {(suggestion || goal.suggestion) && <div className="ai-suggestion"><span className="eyebrow">AI PRE-GRADE SUGGESTION</span><div className="rubric">{rubric.map(([key, label]) => <div key={key}><strong>{(suggestion?.suggestion ?? goal.suggestion)![key]}<small>/5</small></strong><span>{label}</span></div>)}</div><p>{(suggestion?.suggestion ?? goal.suggestion)!.rationale}</p><small>Model: {suggestion?.model ?? 'Not supplied in weekly state; load to see provenance'}</small><p>Advisory only. Your submitted grade decides the result.</p><button className="button secondary" onClick={() => setDraft({ ...(suggestion?.suggestion ?? goal.suggestion)! })}>Accept suggestion into grade</button></div>}
      <form onSubmit={e => { e.preventDefault(); run(async () => { await api.grade(vid, week.week_start, goal.id, {ambition: draft.ambition, evidence_quality: draft.evidence_quality, progress: draft.progress, completed: draft.completed, rationale: draft.rationale}); }); }}>
        <div className="rubric">{rubric.map(([key, label]) => <label key={key}>{label}<input aria-label={label} type="number" min="1" max="5" step="1" required value={draft[key]} onChange={e => setDraft({...draft, [key]: Number(e.target.value)})} /></label>)}</div>
        <label className="audit-check"><input type="checkbox" checked={draft.completed} onChange={e => setDraft({...draft, completed: e.target.checked})} />Goal completed</label>
        <label>Grading rationale<textarea required maxLength={2000} value={draft.rationale} onChange={e => setDraft({...draft, rationale: e.target.value})} /></label><button className="button secondary" type="submit">Submit human grade</button>
      </form>
    </fieldset>}
  </article>;
}
export function WeekPanel({ village, onClose, refresh, onWeek, celebrate }: { village: Village; onClose: () => void; refresh: () => Promise<void>; onWeek: (week: WeekState) => void; celebrate: (ids: string[], title: string) => void }) {
  const [week, setWeek] = useState<WeekState | null>(null), [profiles, setProfiles] = useState<Profile[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [tick, setTick] = useState(Date.now());
  const locked = useRef(false), revision = useRef(0), alive = useRef(true);
  const [query, setQuery] = useState(''), [page, setPage] = useState(0);
  const large = village.villagers.length > REVIEW_PAGE_SIZE;
  const visible = reviewPage(village.villagers, query, page);
  const visibleIds = visible.people.map(p => p.user_id).join(',');
  const load = async () => { const version = ++revision.current; const [next, people] = await Promise.all([api.week(village.id), Promise.all(visible.people.map(v => api.profile(village.id, v.user_id)))]); if (!alive.current || version !== revision.current) return; setWeek(next); setProfiles(people); onWeek(next); };
  useEffect(() => { alive.current = true; setProfiles([]); const poll = () => { if (!locked.current) void load().catch(e => { if (alive.current) setError(errorText(e)); }); }; poll(); const timer = setInterval(poll, 10000), clock = setInterval(() => setTick(Date.now()), 1000); return () => { alive.current = false; revision.current++; clearInterval(timer); clearInterval(clock); }; }, [village.id, visibleIds]);
  async function run(action: () => Promise<void>) { if (locked.current) return; locked.current = true; revision.current++; setBusy(true); setError(''); try { await action(); await load(); } catch (e) { setError(errorText(e)); await load().catch(() => {}); } finally { locked.current = false; if (alive.current) setBusy(false); } }
  const name = (id: string | null) => village.villagers.find(v => v.user_id === id)?.display_name ?? 'Unassigned';
  const remaining = week ? Math.max(0, Math.ceil((Date.parse(week.week_start) + 7 * 86400000 - tick) / 1000)) : 0;
  const judge = week?.auditor_id === api.user;
  const auditor = village.villagers.find(person => person.user_id === week?.auditor_id);
  return <Dialog title="Weekly review" eyebrow="THIS WEEK’S RESULTS" onClose={onClose} busy={busy} wide>
    {error && <p role="alert">{error} <button className="text-button" disabled={busy} onClick={() => void run(async () => {})}>Retry</button></p>}
    {!week ? <PanelSkeleton label="Loading this week’s goals..." /> : <>
      <div className="audit-banner weekly-summary">{auditor && <div className="weekly-auditor"><Portrait person={auditor} /><strong>{auditor.display_name} is the auditor and sits out this week</strong></div>}<span>{week.week_start} · {week.status}</span><small>{week.status === 'finalized' ? `Crown: ${week.winner_id ? name(week.winner_id) : 'No completed goals'} · ${week.stars.length} completion stars` : `${Math.floor(remaining / 86400)}d ${Math.floor(remaining % 86400 / 3600)}h ${Math.floor(remaining % 3600 / 60)}m ${remaining % 60}s until weekly wrap-up (UTC)`}</small></div>
      {!!week.reading_bonus?.length && <div className="help-text">Reading bonus (outside crown scoring): {week.reading_bonus.map(b => `${name(b.user_id)}: ${b.completed} read, +${b.xp} XP / coins`).join(' ? ')}</div>}
      {!week.auditor_id && <p>No eligible auditor this week. Grading and finalization are unavailable.</p>}
      <p className="help-text">AI helps assess ambition, evidence and progress. The human auditor has the final say. All assigned auditors sit out this week.</p>
      {large && <nav aria-label="Review villagers"><label>Find a villager<input type="search" value={query} disabled={busy} onChange={e => {setQuery(e.target.value);setPage(0);}} /></label><p>{visible.count} villagers · Page {visible.current+1} of {visible.pages}</p><button className="button secondary" disabled={busy || visible.current===0} onClick={()=>setPage(visible.current-1)}>Previous villagers</button><button className="button secondary" disabled={busy || visible.current+1>=visible.pages} onClick={()=>setPage(visible.current+1)}>Next villagers</button></nav>}
      {visible.people.map(person => { const goal = week.goals.find(g => g.user_id === person.user_id); if (goal?.excluded || person.user_id === week.auditor_id) return null; return goal ? profiles.some(p=>p.villager.user_id===person.user_id) ? <GradeCard key={`${goal.id}:${week.generation}`} goal={goal} name={person.display_name} profile={profiles.find(p => p.villager.user_id === person.user_id)} week={week} vid={village.id} judge={judge} busy={busy} run={a => void run(a)} /> : <p key={person.user_id} role="status">Loading {person.display_name}'s progress…</p> : <p key={person.user_id}>{person.display_name} · No weekly goal</p>; })}
      {week.status === 'open' && <div className="audit-footer">{judge && <><p>Finalize after every eligible goal has a human grade. Early finalization is available for the demo.</p><button className="button primary" disabled={busy || week.goals.some(g => !g.excluded && !g.grade)} onClick={() => void run(async () => { const next = await api.finalize(village.id, week.week_start); setWeek(next); onWeek(next); await refresh(); celebrate(next.winner_id ? [next.winner_id] : [], 'Week finalized'); })}>Finalize week</button></>}
        <details><summary>Emergency: auditor insufficient</summary><p role="status">Live tally: {week.votes} / {Math.floor(village.villagers.length / 2) + 1} votes needed · generation {week.generation}</p><p>A strict majority replaces the auditor and clears human grades. All assigned auditors still sit out.</p><button className="button secondary" disabled={busy || judge || !week.auditor_id} onClick={() => void run(async () => { const next = await api.vote(village.id, week.week_start, week.generation); setWeek(next); onWeek(next); })}>Vote auditor insufficient</button></details>
      </div>}
    </>}
  </Dialog>;
}
