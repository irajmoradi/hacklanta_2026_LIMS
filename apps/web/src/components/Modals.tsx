import { RepairTaskPicker, useRepairTasks } from './RepairTaskPicker';
import { Treasury } from './Treasury';
import { VillageIcon } from './VillageIcon';
import type { ToastInput } from './toastStore';
import { GoalStretch } from './GoalStretch';
import { Reward } from './Currency';
import type { Department } from '../scene/ShopInterior';
import './shopInterior.css';
import { PhotoItems } from './PhotoItems';
import { CameraButton } from './PhotoCapture';
import { Villagergram } from './Villagergram';
import { EquipmentPanel } from './Wardrobe';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Send, Flag } from 'lucide-react';
import { api } from '../api/client';
import type { CheckInInput, Profile, Shop, ShopItem, Villager } from '../api/types';
import { Dialog, errorText } from './shared';

type Common = { vid: string; onClose: () => void; refresh: () => Promise<void>; toast: (text: string | ToastInput) => void };
export function CheckInModal({ vid, profile, onClose, submit, onGoal, initialKind = 'status', proof = false, onBusy }: { onBusy?: (busy: boolean) => void; initialKind?: 'status' | 'progress'; proof?: boolean; onGoal: () => void; vid: string; profile: Profile; onClose: () => void; submit: (body: CheckInInput) => Promise<void> }) {
  const {tasks, repairTask, setRepairTask} = useRepairTasks(vid);
  const activeTier = profile.goal?.stretches?.find(s => s.status === 'active');
  const progressOpen = profile.goal?.status === 'active' || !!activeTier;
  const [kind, setKind] = useState<'status' | 'progress'>(initialKind);
  useEffect(() => { if (proof) document.querySelector<HTMLInputElement>('input[aria-label="Upload evidence photo"]')?.focus(); }, [proof]);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  useEffect(() => { onBusy?.(busy); }, [busy, onBusy]);
  const attempt = useRef({ signature: '', key: '' });
  const upload = useRef<{file: File; id: string} | null>(null);
  async function send(event: FormEvent) {
    event.preventDefault(); if (busy || !body.trim()) return;
    if (repairTask && !file) {setError("Attach a photo for this repair task."); return;}
    const signature = JSON.stringify([repairTask, kind, body.trim(), profile.goal?.id, activeTier?.tier, file?.name, file?.size, file?.lastModified]);
    if (attempt.current.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      if (file && upload.current?.file !== file) { const result = await api.evidence(vid, file); upload.current = { file, id: result.evidence_asset_id }; setUploaded(true); }
      await submit({ ...(repairTask ? {repair_task: repairTask} : {}), ...(file && upload.current ? { evidence_asset_id: upload.current.id } : {}), kind, body: body.trim(), ...(kind === 'progress' ? { goal_id: profile.goal?.id, stretch_tier: activeTier?.tier } : {}), idempotency_key: attempt.current.key });
      onClose();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <Dialog title="What’s new?" eyebrow="CHECK IN" onClose={onClose} busy={busy}>
    <p className="modal-intro">Post an update for your neighbors.</p>
    <form onSubmit={send}><fieldset disabled={busy}><RepairTaskPicker tasks={tasks} value={repairTask} onChange={setRepairTask}/>
      <div className="segmented"><button type="button" aria-pressed={kind === 'status'} onClick={() => setKind('status')}><VillageIcon name="sun" size={16}/> Daily note <small><Reward amount={10} /> / day</small></button><button type="button" aria-pressed={kind === 'progress'} aria-describedby={!progressOpen ? 'goal-progress-hint' : undefined} disabled={!profile.goal || !progressOpen} onClick={() => setKind('progress')}>↗ Goal progress <small><Reward amount={25} /></small></button></div>
      {!progressOpen && <p className="help-text" id="goal-progress-hint">{profile.goal?.status === 'done' ? 'Your base goal is complete. Ready to go further?' : !profile.goal ? 'Set a weekly goal first' : 'Your goal is no longer active. Set a new one?'} <button type="button" className="text-button" onClick={onGoal}>{profile.goal?.status === 'done' ? '\u{1F680} Go beyond' : 'Set a weekly goal'}</button></p>}
      {kind === 'progress' && <div className="goal-context"><Flag size={15} /> {activeTier ? `Stretch ${activeTier.tier}: ${activeTier.title}` : profile.goal?.title}</div>}
      <label htmlFor="checkin-body">{kind === 'progress' ? 'What did you make progress on?' : 'What’s on your mind today?'}</label><textarea id="checkin-body" required maxLength={1000} value={body} onChange={e => setBody(e.target.value)} placeholder="Today I…" rows={4} autoFocus /><div className="character-count">{body.length} / 1000</div>
      <label className="upload-label"><Camera size={17} /><span>{file ? file.name : 'Add a photo'}<small>Optional · JPG, PNG, WebP · up to 5 MB</small></span><input aria-label="Upload evidence photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const next = e.target.files?.[0] ?? null; if (next && (next.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(next.type))) { setError('Choose a JPG, PNG, or WebP image under 5 MB.'); e.target.value = ''; return; } setFile(next); setUploaded(false); setError(''); }} /></label>
      <CameraButton onPhoto={next => {setFile(next); setUploaded(false); setError('');}} />
      {file && <p className="help-text">{uploaded ? 'Photo uploaded. ' : ''}Your photo will be attached to this check-in for AI evidence review.</p>}
      {error && <p role="alert" className="form-error">{error} Your note is kept here; retrying will not award XP twice.</p>}
      <button className="button primary full" type="submit" disabled={!body.trim() || busy}><Send size={16} /> {busy ? 'Sharing with the village…' : error ? 'Retry check-in' : 'Share check-in'}</button>
    </fieldset></form>
    <p className="modal-footnote">A daily note counts once per day.</p>
  </Dialog>;
}
export function GoalModal({ vid, profile, onClose, refresh, toast }: Common & { profile: Profile }) {
  const [title, setTitle] = useState(profile.goal?.title ?? '');
  const [detail, setDetail] = useState(profile.goal?.detail ?? '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await api.goal(vid, title.trim(), detail.trim()); toast('Goal saved.'); onClose(); void refresh().catch(() => toast({kind:'error',title:'Goal saved; village could not refresh',action:{label:'Retry',onClick:refresh}})); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  if (profile.goal && ['done', 'stretch'].includes(profile.goal.status)) return <Dialog title="My goal" eyebrow="THIS WEEK" onClose={onClose}><GoalStretch vid={vid} profile={profile} editable refresh={refresh} /></Dialog>;
  return <Dialog title="My goal" eyebrow="THIS WEEK" onClose={onClose} busy={busy}><GoalStretch vid={vid} profile={profile} editable refresh={refresh} /><p className="modal-intro">Pick a goal your friends can follow.</p><form onSubmit={save}><fieldset disabled={busy}><label htmlFor="goal-title">This week, I want to…</label><input id="goal-title" autoFocus required maxLength={140} value={title} onChange={e => setTitle(e.target.value)} placeholder="Run three times this week" /><label htmlFor="goal-detail">What counts as done?</label><textarea id="goal-detail" maxLength={1000} rows={3} value={detail} onChange={e => setDetail(e.target.value)} placeholder="Three runs of at least 20 minutes." />{error && <p role="alert" className="form-error">{error}</p>}<button type="submit" className="button primary full" disabled={busy || !title.trim()}><Flag size={16} /> {busy ? 'Saving…' : 'Save my goal'}</button></fieldset></form><p className="modal-footnote"><Reward amount={20} /> for your first goal each week. You can edit it later.</p></Dialog>;
}
const ShopInterior = lazy(() => import('../scene/ShopInterior'));

export function ShopModal({ vid, onClose, refresh, toast, focusItem, initialSection = 'general', onSettings, active = true, person }: Common & {focusItem?: string | null; initialSection?: Department; onSettings?: () => void; active?: boolean; person?: Villager}) {
  const [shopRevision, setShopRevision] = useState(0), [balanceRevision, setBalanceRevision] = useState(0);
  const [section,setSection] = useState<Department>(initialSection), [purchase,setPurchase] = useState(0);
  const [preview, setPreview] = useState<Villager | null>(null);
  useEffect(() => { if (!active) setPreview(null); }, [active]);
  const [shopper,setShopper] = useState(person), [items,setItems] = useState<ShopItem[]>([]);
  useEffect(() => { if (active) setSection(initialSection); },[active,initialSection]);
  useEffect(() => { setShopper(person); },[person]);
  const loaded=useCallback((data:{shop:Shop;person:Villager})=>{setShopper(data.person);setItems(data.shop.items);},[]);
  const bought=useCallback((item:ShopItem)=>{setPurchase(n=>n+1);},[]);
  return <Dialog active={active} title={section==='farm'?'The little farm & pet store':'The little clothing shop'} eyebrow="COME ON IN" onClose={onClose} className="walk-shop" wide>
    <div className="shop-room" data-testid="shop-interior" data-department={section} data-shopper={shopper?.user_id}>
      <Suspense fallback={<p className="shop-3d-fallback">Opening the shop...</p>}><ShopInterior active={active} section={section} person={preview ?? shopper} trying={!!preview} purchase={purchase} items={items}/></Suspense>
      <div className="shop-room-caption"><strong>{section==='farm'?'Pets, paddocks & little companions':'Thread & Thistle'}</strong><span>{shopper?.display_name ?? 'You'} {preview ? section === 'farm' ? 'meeting a companion' : 'at the fitting mirror' : 'at checkout'}</span></div>
    </div>
    <button className="button shop-back" onClick={onClose}>Back to town</button>
    <div className="shop-overlay">{active&&<>
      <EquipmentPanel initialSection={initialSection} focusItem={focusItem} key={`${shopRevision}:${initialSection}`} vid={vid} onSection={setSection} onLoaded={loaded} onPreview={setPreview} onPurchase={bought} refresh={async()=>{setBalanceRevision(n=>n+1);await refresh();}} toast={toast}/>
      <Treasury vid={vid} refresh={refresh}/><details><summary>Photo gifts & villager-grams</summary><PhotoItems vid={vid} revision={balanceRevision} refresh={async()=>{await refresh();setShopRevision(n=>n+1);}}/><Villagergram onSettings={onSettings} vid={vid} refresh={async()=>{await refresh();setShopRevision(n=>n+1);}}/></details>
      <p className="modal-footnote">Outfits equip immediately. Esc returns to town.</p>
    </>}</div>
  </Dialog>;
}
export { MayorModal } from './MayorModal';
