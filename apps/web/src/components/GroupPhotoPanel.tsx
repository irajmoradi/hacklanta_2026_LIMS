import { CameraButton } from './PhotoCapture';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { api } from '../api/client';
import type { GroupCrop, GroupPhoto, Village } from '../api/types';
import { isOwner } from './AgentPanel';
import { AvatarStep } from './Onboarding';
import { Dialog, errorText, mediaUrl } from './shared';

const remembered = new Map<string, string>();
function savedJob(scope: string) { try { return sessionStorage.getItem(`group-photo:${scope}`) ?? remembered.get(scope) ?? ''; } catch { return remembered.get(scope) ?? ''; } }

export function bboxStyle(bbox: GroupCrop['bbox'], width: number, height: number): CSSProperties | undefined {
  if (!width || !height || bbox.length !== 4 || !bbox.every(Number.isFinite)) return;
  const [x, y, right, bottom] = bbox;
  if (right <= x || bottom <= y) return;
  return { left: `${Math.max(0, x) / width * 100}%`, top: `${Math.max(0, y) / height * 100}%`, width: `${(Math.min(width, right) - Math.max(0, x)) / width * 100}%`, height: `${(Math.min(height, bottom) - Math.max(0, y)) / height * 100}%` };
}
function Photo({ url, alt, onSize }: { url: string; alt: string; onSize?: (w: number, h: number) => void }) {
  const [src, setSrc] = useState(''), [error, setError] = useState(false);
  useEffect(() => {
    let active = true, owned = '';
    setSrc(''); setError(false);
    void mediaUrl(url).then(value => { owned = value; if (active) setSrc(value); else if (value.startsWith('blob:')) URL.revokeObjectURL(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (owned.startsWith('blob:')) URL.revokeObjectURL(owned); };
  }, [url]);
  return error ? <p>Photo unavailable. Try reopening this panel.</p> : src ? <img src={src} alt={alt} onError={() => setError(true)} onLoad={e => onSize?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} /> : <p>Loading photo…</p>;
}

export function GroupPhotoPanel({ village, onClose, refresh }: { village: Village; onClose: () => void; refresh: () => Promise<void> }) {
  const scope = `${api.user}:${village.id}`;
  const [jobId, setJobId] = useState(village.group_photo_job_id ?? savedJob(scope));
  const [lookup, setLookup] = useState(''), [photo, setPhoto] = useState<GroupPhoto | null>(null);
  const [file, setFile] = useState<File | null>(null), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [avatarJob, setAvatarJob] = useState(''), [size, setSize] = useState([0, 0]);
  const [preview, setPreview] = useState('');
  const previewRef = useRef('');
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!jobId) return;
    remembered.set(scope, jobId);
    try { sessionStorage.setItem(`group-photo:${scope}`, jobId); } catch { /* Memory fallback. */ }
    let alive = true, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api.groupPhoto(village.id, jobId);
        if (!alive) return;
        setPhoto(next); setError('');
        const own = next.crops.find(c => c.claimed_by === api.user);
        if (own?.avatar_job_id) setAvatarJob(own.avatar_job_id);
        // Ready photos still poll so other members' claims appear.
        if (next.status !== 'failed') timer = setTimeout(() => void poll(), ['ready', 'done'].includes(next.status) ? 5000 : 2000);
      } catch (e) { if (alive) setError(errorText(e)); }
    };
    void poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [jobId, village.id, scope, attempt]);
  async function upload() {
    if (!file || !consent || busy) return;
    setBusy(true); setError('');
    try {
      const result = await api.uploadGroupPhoto(village.id, file, consent);
      if (!active.current) return;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = URL.createObjectURL(file); setPreview(previewRef.current);
      setPhoto(null); setAvatarJob(''); setSize([0, 0]); setJobId(result.job_id); setAttempt(n => n + 1);
      void refresh().catch(() => {});
    } catch (e) { if (active.current) setError(errorText(e)); } finally { if (active.current) setBusy(false); }
  }
  async function claim(crop: GroupCrop) {
    if (busy || crop.claimed_by || avatarJob) return;
    setBusy(true); setError('');
    try {
      const result = await api.claimGroupPhoto(village.id, jobId, crop.crop_id);
      if (!active.current) return;
      setAvatarJob(result.job_id);
      setPhoto(current => current && ({ ...current, crops: current.crops.map(c => c.crop_id === crop.crop_id ? { ...c, claimed_by: api.user, claimed_name: village.villagers.find(v => v.user_id === api.user)?.display_name } : c) }));
      setAttempt(n => n + 1);
    } catch (e) { if (active.current) { setError(errorText(e)); } } finally { if (active.current) setBusy(false); }
  }
  const owner = isOwner(village), claimed = photo?.crops.some(c => c.claimed_by === api.user);
  const cropName = (c: GroupCrop) => c.claimed_name ?? village.villagers.find(v => v.user_id === c.claimed_by)?.display_name ?? 'Claimed';
  return <Dialog title="Our group photo" eyebrow="A VILLAGE STARTS WITH YOUR PEOPLE" onClose={onClose} busy={busy} wide>
    <div className="group-photo-panel">
      <p>Find yourself in the group, then choose “This is me” to build your villager. Your preset works while you wait.</p>
      {api.mode === 'mock' && <p className="construction">Demo: synthetic people, fixed sample boxes, and simulated build progress. No photo is processed.</p>}
      {owner ? <fieldset disabled={busy}><CameraButton onPhoto={next => {setFile(next); setConsent(false); setError('');}} />{file && <p>Selected: {file.name}</p>}<label>Group photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
        const next = e.target.files?.[0] ?? null; setConsent(false);
        if (next && (!next.size || next.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(next.type))) { setFile(null); setError('Choose a nonempty JPG, PNG, or WebP under 5 MB.'); return; }
        setFile(next); setError('');
      }} /></label><label className="checkbox-line"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Everyone in this group photo consents to its use to build their avatar.</label><button className="button primary" disabled={!file || !consent || busy} onClick={() => void upload()}>{busy ? 'Working…' : jobId ? 'Replace group photo' : 'Find our people'}</button></fieldset> : <p>The village owner uploads the shared photo. Each person claims only themselves.</p>}
      <details><summary>Open a shared photo job</summary><form onSubmit={e => { e.preventDefault(); if (!lookup.trim() || busy) return; setPhoto(null); setPreview(''); setAvatarJob(''); setSize([0, 0]); setJobId(lookup.trim()); setAttempt(n => n + 1); }}><label>Photo job ID<input value={lookup} onChange={e => setLookup(e.target.value)} maxLength={100} /></label><button className="button secondary" disabled={!lookup.trim() || busy}>Open photo</button></form></details>
      {jobId && <p className="help-text">Share this photo job ID with your village: <code>{jobId}</code></p>}
      {jobId && !photo && !error && <p role="status">Loading shared photo…</p>}
      {photo && !['ready', 'done', 'completed', 'failed'].includes(photo.status) && <p role="status">Finding your people · {photo.status}. You can keep exploring.</p>}
      {photo?.status === 'failed' && <p role="alert">{photo.error || 'Could not find people in this photo.'} Your preset is still available. Ask the owner to upload another photo.</p>}
      {photo && ['ready', 'done', 'completed'].includes(photo.status) && <>
        {(photo.photo_url || preview) && <div className="group-photo-overview">{photo.photo_url ? <Photo url={photo.photo_url} alt="Shared group photo" onSize={(w, h) => setSize([w, h])} /> : <img src={preview} alt="Shared group photo" onLoad={e => setSize([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight])} />}{photo.crops.map((c, i) => {
          const style = bboxStyle(c.bbox, photo.width ?? size[0], photo.height ?? size[1]);
          return style && <span key={c.crop_id} className={`crop-outline ${c.claimed_by ? 'claimed' : ''}`} style={style}><span>{c.claimed_by ? cropName(c) : `Person ${i + 1}`}</span></span>;
        })}</div>}
        {!photo.crops.length && <p>No people were found. Try a clearer group photo, or keep your preset.</p>}
        <div className="crop-grid">{photo.crops.map((crop, i) => <article key={crop.crop_id}><Photo url={crop.url} alt={`Person ${i + 1}`} /><strong>Person {i + 1}</strong>{crop.claimed_by ? <p>Claimed by {cropName(crop)}</p> : <button className="button primary" disabled={busy || claimed || !!avatarJob} onClick={() => void claim(crop)} aria-label={`This is me: person ${i + 1}`}>This is me</button>}</article>)}</div>
      </>}
      {avatarJob && <AvatarStep key={avatarJob} uid={api.user} initialJobId={avatarJob} onChanged={refresh} />}
      {error && <div role="alert" className="form-error">{error}{jobId && <button className="button secondary" onClick={() => setAttempt(n => n + 1)}>Refresh photo</button>}</div>}
    </div>
  </Dialog>;
}
