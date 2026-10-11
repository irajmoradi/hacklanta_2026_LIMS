import { VillageIcon } from './VillageIcon';
import { useEffect, useId, useState } from 'react';
import { CameraButton } from './PhotoCapture';
import { ItemThumbnail } from './ItemThumbnail';
import { api } from '../api/client';
import { ApiError } from '../api/mock';
import { itemState } from '../api/shopState';
import type { EquippedItem, Shop } from '../api/types';
import { errorText, mediaUrl } from './shared';

type Item = EquippedItem & {id: string};
type Job = {id: string; status: string; kind?: string; stage?: string; progress?: string; refunded?: boolean; error?: string; item: Item | null};
export function PhotoItems({vid, refresh, revision = 0}: {vid: string; refresh: () => Promise<void>; revision?: number}) {
  const lockId = useId();
  const key = `village:photo-job:${api.mode}:${vid}:${api.user}`;
  const [tokens, setTokens] = useState(0), [shop, setShop] = useState<Shop | null>(null);
  const [file, setFile] = useState<File | null>(null), [kind, setKind] = useState('outfit'), [slot, setSlot] = useState('torso');
  const [consent, setConsent] = useState(false), [prompt, setPrompt] = useState('');
  const [jobId, setJobId] = useState(() => sessionStorage.getItem(key) ?? ''), [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [placed, setPlaced] = useState(false), [preview, setPreview] = useState('');
  const token = shop?.items.find(i => i.id === 'photo_token');
  const price = token?.price_coins ?? null;
  const tokenState = token && shop ? itemState(token, shop) : null;
  const lockReason = tokenState?.reasons.join('. ') || (!token ? 'Photo tokens are unavailable.' : '');
  const pending = !!jobId && (!job || !['done','failed'].includes(job.status));
  async function balance() { const result = await api.photoItems(vid); setTokens(result.photo_item_tokens); }
  useEffect(() => { let active = true; void balance().catch(e => { if (active) setError(errorText(e)); }); void api.shop(vid).then(next => { if (active) setShop(next); }).catch(e => { if (active) setError(errorText(e)); }); return () => { active = false; }; }, [vid, revision]);
  useEffect(() => {
    if (!jobId) return;
    let active = true; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await api.request<Job>('GET', `/villages/${vid}/items/jobs/${jobId}`);
        if (!active) return;
        setJob(result); setError('');
        if (['done','failed'].includes(result.status)) { await balance(); await refresh(); return; }
      } catch (e) { if (active) { setError(errorText(e)); if (e instanceof ApiError && e.status === 404) { setJobId(''); setJob(null); sessionStorage.removeItem(key); return; } } }
      if (active) timer = setTimeout(() => void poll(), 2000);
    };
    void poll(); return () => { active = false; clearTimeout(timer); };
  }, [jobId, vid]);
  useEffect(() => {
    let active = true, url = ''; setPreview('');
    if (job?.item?.preview) void mediaUrl(job.item.preview).then(value => { url = value; if (active) setPreview(value); else if (value.startsWith('blob:')) URL.revokeObjectURL(value); }).catch(() => {});
    return () => { active = false; if (url.startsWith('blob:')) URL.revokeObjectURL(url); };
  }, [job?.item?.preview]);
  async function buy() {
    if (busy || !token || tokenState?.state !== 'buyable') return;
    setBusy(true); setError('');
    try { await api.request('POST', `/villages/${vid}/items/token`); setTokens(n => n + 1); setShop(current => current ? {...current, balance: current.balance - token.price_coins} : current); void Promise.all([refresh(), api.shop(vid).then(setShop)]).catch(() => setError('Token bought; refresh the shop to update your balance.')); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function create() {
    if (!file || !consent || pending || busy) return;
    setBusy(true); setError(''); setPlaced(false);
    const data = new FormData(); data.set('file',file); data.set('kind',kind); data.set('consent','true');
    if (kind === 'outfit') data.set('slot',slot); if (prompt.trim()) data.set('prompt',prompt.trim());
    try { const next = await api.request<Job>('POST', `/villages/${vid}/items/from-photo`, data); setJob(next); setJobId(next.id); sessionStorage.setItem(key,next.id); await balance(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  const choose = (next?: File) => { setError(''); if (next && (!['image/jpeg','image/png','image/webp'].includes(next.type) || next.size > 10*1024*1024 || !next.size)) { setFile(null); setError('Choose a JPG, PNG or WebP under 10 MB.'); } else setFile(next ?? null); };
  return <section className="photo-creator" aria-label="Make it real">
    <div style={{width: 80, height: 80}}><ItemThumbnail id="photo_token" staticFallback fallback={<VillageIcon name="camera" size={32}/>} /></div>
    <div><span className="eyebrow">FROM YOUR WORLD TO OURS</span><h3>Make it real</h3><p>Turn a photo into a wearable or a decoration for your home.</p></div>
    <p><strong>{tokens} photo {tokens === 1 ? 'token' : 'tokens'}</strong> · One per creation. Failed jobs refund automatically.</p>
    <button className="button secondary" disabled={busy || tokenState?.state !== 'buyable'} aria-describedby={lockReason ? lockId : undefined} onClick={() => void buy()}>Buy photo token{price !== null ? ` · ${price} coins` : ' (unavailable)'}</button>
    {lockReason && <p id={lockId} className="help-text">{lockReason}</p>}
    <fieldset disabled={busy || pending}>
      <div className="photo-fields"><label>Upload photo<input aria-label="Item photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => choose(e.target.files?.[0])}/></label><CameraButton maxMB={10} onPhoto={next => {choose(next); setConsent(false);}} /></div>
      {file && <p>{file.name}</p>}
      <div className="photo-fields"><label>Make a<select aria-label="Make a" value={kind} onChange={e => setKind(e.target.value)}><option value="outfit">Wearable</option><option value="object">3D decoration</option></select></label>
      {kind === 'outfit' && <label>Wear it on<select aria-label="Wear it on" value={slot} onChange={e => setSlot(e.target.value)}><option value="torso">Torso</option><option value="head">Head</option></select></label>}
      <label>Object description (optional)<input value={prompt} maxLength={40} placeholder="potted plant" pattern="[A-Za-z][A-Za-z -]{0,39}" onChange={e => setPrompt(e.target.value)}/></label></div>
      <label className="checkbox-line"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>I have permission to use this photo and consent to processing it.</label>
      <button className="button primary" disabled={!file || !consent || tokens < 1 || (!!prompt.trim() && !/^[A-Za-z][A-Za-z -]{0,39}$/.test(prompt.trim()))} onClick={() => void create()}>Create</button>
    </fieldset>
    {pending && <div role="status"><p>{job?.status === 'running' ? 'Building' : 'Queued'} · {job?.progress ?? job?.stage ?? 'waiting for worker'}</p><p>{(job?.kind ?? kind).startsWith('object') ? 'Queued → Segment → Stylize → 3D' : 'Queued → Segment → Wearable'}</p><small>Building can take several minutes. If photo processing is offline, your job waits here. You can leave and return.</small></div>}
    {job?.status === 'failed' && <p role="alert">{job.error || 'Creation failed.'} {job.refunded ? 'Your token was refunded.' : 'Check your token balance before retrying.'}</p>}
    {job?.item && <div className="photo-result">{preview && <img src={preview} alt="Created photo item"/>}<p>Your {job.item.slot === 'decoration' ? 'decoration' : 'wearable'} is ready.</p><button className="button primary" disabled={busy || placed} onClick={() => { setBusy(true); void api.equip(vid,job.item!.id).then(async () => { await refresh(); setPlaced(true); }).catch(e => setError(errorText(e))).finally(() => setBusy(false)); }}>{placed ? 'In your village' : job.item.slot === 'decoration' ? 'Place at my house' : 'Equip wearable'}</button></div>}
    {api.mode === 'mock' && <small>Demo simulation: no photo is sent to a worker.</small>}{error && <p role="alert">{error}</p>}
  </section>;
}
