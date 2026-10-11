import { VillageIcon } from './VillageIcon';
import { ToastNotice } from './Toast';
import { PhotoCapture } from './PhotoCapture';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ApiError } from '../api/mock';
import type { AvatarManifest, Job, Me, Villager } from '../api/types';
import { errorText, Portrait } from './shared';

const rememberedJobs = new Map<string, string>();
export function AvatarStep({ uid, person, displayName = 'You', onChanged, initialJobId }: { initialJobId?: string; uid: string; person?: Villager; displayName?: string; onChanged?: () => Promise<void> }) {
  const [consent, setConsent] = useState(false), [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState(() => initialJobId ?? rememberedJobs.get(uid) ?? ''), [job, setJob] = useState<Job | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [avatar, setAvatar] = useState<AvatarManifest | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!jobId) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const [next, manifest] = await Promise.all([api.job(jobId), api.avatar(uid)]);
        if (!active) return;
        setJob(next); setAvatar(manifest); setError('');
        // Segment completion may precede head completion. Keep polling the manifest too.
        const pending = Object.values(manifest.generation).some(s => s === 'queued' || s === 'running');
        if (next.status === 'failed') { rememberedJobs.delete(uid); return; }
        if ((next.status === 'ready' || next.status === 'completed') && !pending) { rememberedJobs.delete(uid); await onChanged?.(); return; }
        timer = setTimeout(() => void poll(), 3000);
      } catch (e) { if (active) { setError(errorText(e)); timer = setTimeout(() => void poll(), 10000); } }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [jobId, uid, onChanged]);
  async function upload() {
    if (!file || !consent || busy) return;
    setBusy(true); setError(''); setJob(null); setJobId('');
    try { const result = await api.photo(uid, file); rememberedJobs.set(uid, result.job_id); setJobId(result.job_id); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  const failedStage = Object.entries(avatar?.generation ?? {}).find(([, state]) => state === 'failed')?.[0];
  const stages = ['segment', 'head', 'stylized head'];
  const stageStatus = (stage: string) => {
    if (job?.stage.replace(/_/g, ' ') === stage) return job.status;
    const value = avatar?.generation[stage.replace(/ /g, '_') as keyof AvatarManifest['generation']];
    if (value && value !== 'none') return value;
    return job && stages.indexOf(stage) < stages.indexOf(job.stage.replace(/_/g, ' ')) ? 'ready' : 'waiting';
  };
  const constructing = !!jobId && !failedStage && job?.status !== 'failed' && (!job || !['ready', 'completed'].includes(job.status) || (avatar && Object.values(avatar.generation).some(s => s === 'queued' || s === 'running')));
  const portraitPerson = person ?? (avatar ? { user_id: uid, display_name: displayName, avatar, coins: 0, xp: 0, level: 1, house_slot: 0, house_level: 1, streak_days: 0, equipped: [], equipped_ids: [], status_line: null, has_crown: false } : null);
  return <section className="avatar-step" aria-label="Build your avatar"><h3>{initialJobId ? 'Your villager' : 'Add your face'}</h3><p>Your preset works right away. A photo is optional.</p>
    {portraitPerson && <Portrait person={{ ...portraitPerson, avatar: avatar ?? portraitPerson.avatar }} large />}
    {!initialJobId && <><label>Avatar photo<input aria-label="Avatar photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !!constructing} onChange={e => { const next = e.target.files?.[0] ?? null; if (next && (next.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(next.type))) { setError('Choose a JPG, PNG, or WebP under 10 MB.'); setFile(null); return; } setError(''); setFile(next); setConsent(false); }} /></label>
    <button type="button" className="button secondary" disabled={busy || !!constructing} onClick={() => setCaptureOpen(true)}>Take a photo</button>{file && <p>Selected: {file.name}</p>}{captureOpen && <PhotoCapture title="Capture your avatar" onClose={() => setCaptureOpen(false)} onConfirm={next => {setFile(next); setConsent(false); setError(''); setCaptureOpen(false);}} />}
    <p className="help-text">One clear, front-facing photo drives your animated face.</p><label className="checkbox-line"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />my photo and voice may be used to build my avatar; AI messages will be labeled</label>
    <button className="button primary" disabled={!file || !consent || busy || !!constructing} onClick={() => void upload()}>{busy ? 'Uploading…' : 'Build my avatar'}</button></>}
    {initialJobId && <ol className="avatar-stages" aria-label="Avatar stages">{stages.map(stage => <li key={stage} aria-current={stageStatus(stage) === 'running' ? 'step' : undefined}>{stage} - {stageStatus(stage)}</li>)}</ol>}
    {constructing && <p className="construction" role="status"><VillageIcon name="house"/> Your villager is being built. {job?.stage ?? 'Preparing'} · {job?.status ?? 'queued'}. You can keep exploring with your preset.</p>}
    {(job?.status === 'failed' || failedStage) && <p role="status">{job?.error || (failedStage ? `${failedStage.replace(/_/g, ' ')} construction failed.` : 'Avatar construction failed.')} Your preset is still available.</p>}
    {job && ['ready', 'completed'].includes(job.status) && !constructing && !failedStage && <p role="status">{initialJobId && api.mode === 'mock' ? 'Demo build complete. Your preset is ready; no avatar was generated.' : 'Your avatar is ready.'}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}

export function Onboarding({ identity, onJoined }: { identity: Me; onJoined: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(identity.user.display_name), [invite, setInvite] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [joined, setJoined] = useState(false);
  return <main className="onboarding"><div className="onboarding-card"><p className="eyebrow">WELCOME TO VILLAGE</p><h1>Your friends live here.</h1>
    {!joined ? <form onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setError(''); void (async () => {
      try {
        if (name.trim() !== identity.user.display_name) {
          try { await api.updateName(name.trim()); }
          catch (e) { if (e instanceof ApiError && [404, 405, 501].includes(e.status)) setNotice('Display-name updates are not available on this server yet. Your account name will be used.'); else throw e; }
        }
        if (creating) await api.createVillage(invite.trim()); else await api.joinVillage(invite.trim().toUpperCase()); setJoined(true);
      } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
    })(); }}><fieldset disabled={busy}><label htmlFor="display-name">Display name</label><input id="display-name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} /><label htmlFor="invite-code">{creating ? 'Village name' : 'Invite code'}</label><input id="invite-code" required maxLength={32} placeholder={creating ? 'Our village' : 'HACKLANTA'} value={invite} onChange={e => setInvite(e.target.value)} /><button className="button primary full" disabled={!name.trim() || !invite.trim()}>{busy ? 'Opening...' : creating ? 'Create village' : 'Join village'}</button><button type="button" className="text-button" onClick={() => {setCreating(!creating); setInvite('');}}>{creating ? 'Have an invite? Join a village' : 'Create a new village'}</button></fieldset></form>
      : <><p>You’re in. Add an avatar, or use your preset.</p><AvatarStep uid={identity.user.id} displayName={name} /><button className="button secondary full" onClick={() => void onJoined().catch(e => setError(errorText(e)))}>Enter village</button></>}
    <ToastNotice message={notice} kind="info"/>{error && <p role="alert" className="form-error">{error}</p>}
  </div></main>;
}
