import { orderCompetitions, emptyCompetition } from './competitionOrder';
import { parseSplit, payoutLabel, allocate } from './payouts';
import { PayoutSummary } from './PayoutSummary';
import type {PayoutMode} from '../api/types';
import { ModalHeader } from './ModalHeader';
import { ArenaTip } from './ArenaTip';
import { CurrencyAmount } from './Currency';
import { Colosseum, ReviewEntry } from './Colosseum';
import { CameraButton } from './PhotoCapture';
import { potIntent, modeLabel, scoringHelp } from './colosseumData';
import { SolanaPot } from './SolanaPot';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Competition, CompetitionDetail, Scoring, Village } from '../api/types';
import { Portrait, Dialog, errorText } from './shared';
import { EvidencePhoto, EvidenceReview } from './WeekPanel';
function EntryForm({ vid, competition, busy, run }: {vid: string; competition: CompetitionDetail; busy: boolean; run: (action: () => Promise<void>) => void}) {
  const [value,setValue] = useState('');
  const numeric = competition.scoring === 'scoreboard' || (competition.scoring === 'ordinal' && competition.target != null);
  const [body, setBody] = useState(''), [file, setFile] = useState<File | null>(null), [photoError, setPhotoError] = useState('');
  const retry = useRef({key: crypto.randomUUID(), asset: undefined as string | undefined});
  function reset() {retry.current = {key: crypto.randomUUID(), asset: undefined};}
  return <form onSubmit={e => {e.preventDefault(); run(async () => {if (file && !retry.current.asset) retry.current.asset = (await api.evidence(vid, file)).evidence_asset_id; await api.enterCompetition(vid, competition.id, {body, ...(numeric ? {value:Number(value)} : {}), evidence_asset_id: retry.current.asset, idempotency_key: retry.current.key}); setBody(''); reset(); });}}><fieldset disabled={busy} className="grade-editor"><h3>Submit your entry</h3>{numeric && <label>Claimed value ({competition.unit ?? "progress"})<input type="number" required min="0" max="1000000000000" step="any" value={value} onChange={e=>{setValue(e.target.value);reset();}} /></label>}<label>Entry description<textarea required maxLength={4000} value={body} onChange={e => {setBody(e.target.value); reset();}} /></label><CameraButton onPhoto={next => {reset(); setFile(next); setPhotoError('');}} />{file && <p>Selected: {file.name}</p>}<label>Entry evidence photo<input type="file" accept="image/png,image/jpeg,image/webp" required={!competition.friendly && !file} onChange={e => {const f = e.target.files?.[0]; reset(); if (f && (!['image/png','image/jpeg','image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024)) {setPhotoError('Choose JPG, PNG or WebP under 5 MB.'); setFile(null); } else {setPhotoError(''); setFile(f ?? null);}}} /></label><p className="help-text">Photo shared with village · AI reviewed on submit.</p>{photoError && <p role="alert">{photoError}</p>}<button className="button primary" disabled={!!photoError || (!competition.friendly && !file)}>Submit entry</button></fieldset></form>;
}
export function CompetitionsPanel({ village, onClose, refresh, celebrate, active = true, warmAllowed = true, challenge }: {warmAllowed?: boolean; active?: boolean; challenge?: {name: string; request: number} | null; village: Village; onClose: () => void; refresh: () => Promise<void>; celebrate: (ids: string[], title: string) => void}) {
  const [ready, setReady] = useState(false), [visibleArena, setVisibleArena] = useState(false);
  const warmed = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (!active || !ready) {setVisibleArena(false); return;}
    performance.mark('arena-town-paused');
    // Commit the town's frameloop pause before starting the arena swoop.
    let second = 0;
    const first = requestAnimationFrame(() => {second = requestAnimationFrame(() => {
      performance.mark('arena-enter'); setVisibleArena(true);
    });});
    return () => {cancelAnimationFrame(first); cancelAnimationFrame(second);};
  }, [active, ready]);
  const [list, setList] = useState<Competition[]>([]), [detail, setDetail] = useState<CompetitionDetail | null>(null), [creating, setCreating] = useState(false), [loaded, setLoaded] = useState(false);
  const [payoutMode,setPayoutMode]=useState<PayoutMode>('winner_take_all'),[split,setSplit]=useState('60/30/10'),[coins,setCoins]=useState('0'),[deadline,setDeadline]=useState(''),[feePercent,setFeePercent]=useState('0');
  let splitError='';let rankedBps:number[]=[];try{if(payoutMode==='ranked')rankedBps=parseSplit(split);}catch(e){splitError=String(e);}
  const [scoring,setScoring] = useState<Scoring>('cumulative'), [unit,setUnit] = useState(''), [target,setTarget] = useState('');
  const [title, setTitle] = useState(''), [terms, setTerms] = useState(''), [friendly, setFriendly] = useState(false), [auditor, setAuditor] = useState(village.villagers.find(v => v.user_id !== api.user)?.user_id ?? ''), [sol, setSol] = useState('0');
  const previewEntry=Number(sol)>0?Number(sol)*1e9:Number(coins)||0;
  const previewTotal=BigInt(Number.isFinite(previewEntry)?Math.max(0,Math.round(previewEntry*3)):0);
  const previewFee=BigInt(Math.min(2000,Math.max(0,Math.round((Number(feePercent)||0)*100))));
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [closing, setClosing] = useState(false);
  const [listView, setListView] = useState<'open' | 'current' | 'mine' | 'past'>('current');
  const [previews, setPreviews] = useState<Record<string, CompetitionDetail>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const visible = orderCompetitions(list, previews).filter(c => {
    const data = previews[c.id];
    if (listView === 'past') return c.status === 'settled';
    if (listView === 'mine') return c.creator_id === api.user || c.auditor_id === api.user || data?.participants.some(p => p.user_id === api.user);
    if (listView === 'open') return c.status === 'open';
    return c.status === 'open';
  });
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  function closeArena() { if (busy || closing) return; setClosing(true); closeTimer.current = setTimeout(onClose, 160); }
  useEffect(() => {if (!active) {setClosing(false); setCreating(false); setDetail(null); setHovered(null); selected.current = null; setListView('current');}}, [active]);
  useEffect(() => {if (active && challenge) {setCreating(true); setTitle(`Challenge with ${challenge.name}`); setFriendly(true); setSol('0');}}, [active, challenge]);
  const displayed = creating ? null : hovered ? previews[hovered] ?? null : detail;
  function clearSelection() { revision.current++; selected.current = null; setDetail(null); setHovered(null); }
  const selected = useRef<string | null>(null), locked = useRef(false), revision = useRef(0), alive = useRef(true);
  const name = (id?: string) => village.villagers.find(v => v.user_id === id)?.display_name ?? 'Unassigned';
  async function load() {
    const version = ++revision.current, cid = selected.current;
    const items = await api.competitions(village.id);
    const results = await Promise.allSettled(items.map(c => api.competition(village.id, c.id)));
    if (!alive.current || version !== revision.current) return;
    const details = Object.fromEntries(results.flatMap(r => r.status === 'fulfilled' ? [[r.value.id, r.value]] : []));
    setList(items); setPreviews(previous => ({...previous, ...details}));
    if (!cid) setDetail(null);
    else if (details[cid]) setDetail(details[cid]);
    else throw new Error('Could not load this competition. Please retry.');
    setLoaded(true);
  }
  useEffect(() => {alive.current = true; const poll = () => {if (!locked.current) void load().catch(e => {if (alive.current) setError(errorText(e));});}; poll(); const timer = setInterval(poll, 5000); return () => {alive.current = false; revision.current++; clearInterval(timer);};}, [village.id]);
  async function run(action: () => Promise<void>) {if (locked.current) return; locked.current = true; revision.current++; setBusy(true); setError(''); try {await action(); await load();} catch (e) {setError(errorText(e)); await load().catch(() => {});} finally {locked.current = false; if (alive.current) setBusy(false);}}
  const judge = detail && (detail.friendly ? detail.creator_id : detail.auditor_id) === api.user;
  return <Dialog active={visibleArena} title="Competitions" eyebrow="A LITTLE FRIENDLY MOTIVATION" onClose={onClose} busy={busy} wide className={`arena-modal ${closing ? 'arena-leaving' : ''}`}>
    {error && <p role="alert">{error} <button className="text-button" disabled={busy} onClick={() => void run(async () => {})}>Retry</button></p>}
    <aside className="arena-browser" aria-label="Competition banners" onMouseLeave={() => setHovered(null)}>
      <ModalHeader title="Challenges" eyebrow="CHOOSE YOUR CHALLENGE" onClose={closeArena} closeLabel="Close competitions" disabled={busy} />
      <nav aria-label="Competition list filters">{(['open','current','mine','past'] as const).map(view => <button key={view} aria-pressed={listView === view} disabled={busy} onClick={() => {setListView(view); setHovered(null); setCreating(false); if(detail && ((view==='past'&&detail.status!=='settled') || ((view==='open'||view==='current')&&detail.status==='settled') || (view==='mine'&&detail.creator_id!==api.user&&detail.auditor_id!==api.user&&!detail.participants.some(p=>p.user_id===api.user))))clearSelection();}}>{view[0].toUpperCase()+view.slice(1)}</button>)}</nav>
      <button className="arena-create-banner" disabled={busy} onClick={() => {clearSelection(); setCreating(true);}}>+ Create<span>New competition</span></button>
      {!loaded && <p role="status">Gathering the challenges...</p>}
      {loaded && !visible.length && <p>No competitions yet.</p>}
      <div className="arena-banner-list">{visible.map(c => {
        const data = previews[c.id];
        return <button className={'arena-banner' + (emptyCompetition(data) ? ' is-empty' : '')} key={c.id} data-competition-id={c.id} disabled={busy} aria-pressed={detail?.id === c.id} onMouseEnter={() => {if (!busy && !creating) setHovered(c.id);}} onFocus={() => {if (!busy && !creating) setHovered(c.id);}} onBlur={() => setHovered(null)} onClick={() => {setHovered(null); setCreating(false); void run(async () => {selected.current = c.id; setDetail(data ?? null);});}}>
          <strong>{c.title}</strong><span>{modeLabel(c)} <i className={`banner-status ${c.status}`}>{c.status === 'settled' ? 'settled' : data?.entries.length ? 'active' : 'open'}</i></span>
          <span className="banner-portraits">{data?.participants.slice(0,4).map(p => {const person = village.villagers.find(v => v.user_id === p.user_id); return person && <Portrait key={p.user_id} person={person}/>;})}<small>{data?.participants.length ?? '...'} contenders</small></span>
          <small title="Devnet SOL stake">{data ? potIntent(data) : 0} ◎ pot · {(c.entry_lamports ?? 0)/1e9} ◎ entry</small>
        </button>;
      })}</div>
    </aside>
    {creating && <form className="arena-scroll arena-card arena-manage" aria-label="Create competition" onSubmit={e => {e.preventDefault(); void run(async () => {if(splitError)throw new Error(splitError); const lamports = Math.round(Number(sol) * 1e9); if (!friendly && (!Number.isFinite(lamports) || lamports < 0 || lamports > 1e12)) throw new Error('Enter a devnet SOL stake between 0 and 1000.'); const c = await api.createCompetition(village.id, {title, terms, friendly, scoring, payout_mode:payoutMode, ranked_bps:rankedBps, entry_coins:friendly?0:Number(coins), auditor_fee_bps:friendly?0:Math.round(Number(feePercent)*100), ...(deadline?{deadline:new Date(deadline).toISOString()}:{}), ...(scoring !== 'cumulative' ? {unit:unit.trim() || null,target:target ? Number(target) : null} : {}), ...(!friendly ? {auditor_id: auditor || undefined, entry_lamports: lamports} : {})}); selected.current = c.id; setCreating(false); setListView('current'); setDetail(c);});}}><ModalHeader title="Write the next challenge" eyebrow="NEW COMPETITION" onClose={() => setCreating(false)} closeLabel="Close create competition" disabled={busy} /><fieldset className="grade-editor" disabled={busy}>
      <div className="scoring-picker" role="group" aria-label="Scoring mode">{(['cumulative','scoreboard','ordinal'] as const).map(mode=><button type="button" key={mode} aria-pressed={scoring===mode} onClick={()=>setScoring(mode)}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}</div><ArenaTip label="Scoring details" text={scoringHelp[scoring]}/>{scoring!=='cumulative'&&<><label>Unit<input required={scoring==='scoreboard'} maxLength={40} placeholder="hours, km, pages" value={unit} onChange={e=>setUnit(e.target.value)} /></label><label>Optional target<input type="number" min="0.000001" max="1000000000000" step="any" value={target} onChange={e=>setTarget(e.target.value)} /></label></>}<label>Competition title<input autoFocus required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label><label>Terms<textarea required maxLength={4000} value={terms} onChange={e => setTerms(e.target.value)} /></label><label className="audit-check"><input type="checkbox" checked={friendly} onChange={e => setFriendly(e.target.checked)} />Friendly mode (self-reported; no XP, stakes or auditor)</label>
      {!friendly && <><label>Auditor<select aria-label="Auditor" value={auditor} onChange={e => setAuditor(e.target.value)}>{village.villagers.map(v => <option key={v.user_id} value={v.user_id}>{v.display_name}</option>)}</select></label><label>Devnet SOL entry<input type="number" min="0" max="1000" step="0.000000001" value={sol} onChange={e => setSol(e.target.value)} /></label><label>Auditor fee (%)<input type="number" min="0" max="20" step="0.01" value={feePercent} onChange={e=>setFeePercent(e.target.value)}/></label><label>Coin entry (use coins or SOL)<input type="number" min="0" max="1000000" step="1" value={coins} onChange={e=>setCoins(e.target.value)}/></label><label>Entry deadline<input type="datetime-local" required={Number(sol)>0} value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><p className="help-text">SOL stakes need a confirmed devnet pot. XP is never staked.</p></>}
      <label>Payout mode<select value={payoutMode} onChange={e=>setPayoutMode(e.target.value as PayoutMode)}>{(['winner_take_all','proportional','ranked'] as const).map(m=><option key={m} value={m}>{payoutLabel(m)}</option>)}</select></label>{payoutMode==='ranked'&&<label>Ranked percentages<input value={split} onChange={e=>setSplit(e.target.value)} placeholder="60/30/10"/></label>}{splitError&&<p role="alert">{splitError}</p>}<p>Projected payouts with 3 entrants scoring 3 / 2 / 1: {allocate(previewTotal-previewTotal*previewFee/10000n,[3n,2n,1n],payoutMode,rankedBps).map(n=>Number(sol)>0?String(Number(n)/1e9):String(n)).join(' / ')} {Number(sol)>0?'devnet SOL':'coins'} after the fee.</p><p>Equal scores favor earlier joins. Terms cannot change after creation.</p>
      <h3>Participants</h3><p className="help-text">Village members opt in{!friendly && ' · auditor sits out'}.</p><div className="audit-actions"><button className="button primary" disabled={!!splitError || (Number(sol)>0&&Number(coins)>0)}>Create competition with these terms</button><button className="button secondary" type="button" onClick={() => setCreating(false)}>Cancel</button></div>
    </fieldset></form>}
    <Colosseum warmAllowed={warmAllowed} active={visibleArena} onWarmed={warmed} previewing={!!hovered || creating} onOpenTerms={()=>setListView('open')} initialView={listView === 'open' ? 'open' : 'current'} village={village} detail={displayed} busy={busy} onBack={clearSelection} onClose={closeArena} run={a => void run(a)}>{openTerms => detail && <><h3>{detail.title}</h3><p>{modeLabel(detail)} <ArenaTip label="Scoring details" text={scoringHelp[detail.scoring??'cumulative']}/></p><p className="competition-terms">{detail.terms}</p><div className="audit-banner"><strong>{detail.friendly ? 'Friendly · scoreboard only, no XP' : `Auditor: ${name(detail.auditor_id)} · sits out`}</strong><span>{detail.status}</span>{!detail.friendly && <small><CurrencyAmount amount={(detail.entry_lamports ?? 0) / 1e9} currency="SOL" /> entry · confirmed payment required.</small>}</div>
      <PayoutSummary competition={detail} village={village}/><SolanaPot key={detail.id} competition={detail} vid={village.id} /><h3>Participants ({detail.participants.length})</h3><p>{detail.participants.map(p => name(p.user_id)).join(', ') || 'No one has opted in yet.'}</p>
      <h3>Entries ({detail.entries.length})</h3>{[...detail.entries].sort((a, b) => Number(b.decision === 'pending') - Number(a.decision === 'pending')).map(entry => <article key={entry.id} className="audit-card" aria-label={`Entry by ${name(entry.user_id)}`}><div className="entry-heading"><span className="eyebrow">{name(entry.user_id)}</span><span className={`entry-status ${entry.decision}`}>{detail.friendly ? 'Self-reported' : entry.decision}</span></div><p>{entry.body}</p><EvidenceReview review={entry.review} photo={!!entry.evidence_asset_id} />{entry.evidence_asset_id && <EvidencePhoto url={`/api/assets/${entry.evidence_asset_id}`} review={entry.review} />}<p>Human decision: {detail.friendly ? 'Self-reported' : entry.decision} · {detail.scoring&&detail.scoring!=='cumulative'?entry.value??0:entry.points} {detail.unit??'points'}</p>{entry.reason && <p>{entry.reason}</p>}{judge && !detail.friendly && detail.status === 'open' && <ReviewEntry entry={entry} busy={busy} numeric={detail.scoring==='scoreboard'||(detail.scoring==='ordinal'&&detail.target!=null)} decide={(decision, points, reason, value) => void run(async () => {await api.decideEntry(village.id, detail.id, entry.id, {decision, points, reason, value});})} />}</article>)}
      {detail.status === 'open' && detail.auditor_id !== api.user && (!detail.participants.some(p => p.user_id === api.user) ? <button className="button secondary" disabled={busy} onClick={openTerms}>Read terms & join</button> : <EntryForm key={detail.id} vid={village.id} competition={detail} busy={busy} run={a => void run(a)} />)}
      {detail.status === 'open' && judge && !detail.entry_lamports && <><p className="help-text">Settle after review · results are final.</p><button className="button primary" disabled={busy || detail.entries.some(e => e.decision === 'pending')} onClick={() => void run(async () => {const result = await api.settleCompetition(village.id, detail.id); await refresh(); celebrate(result.result?.winners ?? [], `${detail.title} settled`);})}>Settle competition</button></>}
      {detail.result && <div className="audit-banner"><strong>Winners: {detail.result.winners.map(name).join(', ') || 'No positive scores'}</strong>{detail.result.scores.map(s => <span key={s.user_id}>{name(s.user_id)} · {s.points} {detail.unit??'points'}</span>)}<small>{detail.result.payments_executed?'Payouts confirmed.':'No payments executed.'}</small></div>}
    </>}</Colosseum>
  </Dialog>;
}
