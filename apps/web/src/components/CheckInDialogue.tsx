import { RepairTaskPicker, useRepairTasks } from './RepairTaskPicker';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Send, Flag } from 'lucide-react';
import { api } from '../api/client';
import type { CheckInInput, Profile } from '../api/types';
import { EmbeddedDialog, errorText } from './shared';
import { Reward } from './Currency';
import { CameraButton } from './PhotoCapture';

/** Committed cinematic branch; transport and reward semantics match the standard check-in. */
export function CheckInDialogue({ vid, profile, onClose, submit, initialKind = 'status', onBusy }: { onBusy?: (busy: boolean) => void; initialKind?: 'status' | 'progress'; vid: string; profile: Profile; onClose: () => void; submit: (body: CheckInInput) => Promise<void> }) {
  const {tasks, repairTask, setRepairTask} = useRepairTasks(vid);
  const activeTier = profile.goal?.stretches?.find(s => s.status === 'active');
  const kind = initialKind;
  const [body, setBody] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
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
  return <section className="checkin-letter" aria-label={kind === 'progress' ? 'Goal progress' : 'Daily note'}>
    <div className="checkin-branch"><h2>{kind === 'progress' ? 'Goal progress' : 'Daily note'}</h2><span className="checkin-token"><Reward amount={kind === 'progress' ? 25 : 10} />{kind === 'status' && <small> / day</small>}</span></div>
    <form onSubmit={send}><fieldset disabled={busy}><RepairTaskPicker tasks={tasks} value={repairTask} onChange={setRepairTask}/>
      {kind === 'progress' && <div className="goal-context"><Flag size={15} /> {activeTier ? `Stretch ${activeTier.tier}: ${activeTier.title}` : profile.goal?.title}</div>}
      <label htmlFor="checkin-body">{kind === 'progress' ? 'What did you make progress on?' : 'What’s on your mind today?'}</label><textarea id="checkin-body" required maxLength={1000} value={body} onChange={e => setBody(e.target.value)} placeholder="Today I…" rows={3} autoFocus /><div className="character-count">{body.length} / 1000</div>
      <div className="checkin-proof" role="group" aria-label="Optional proof">
      <h3>Add proof <small>Optional</small></h3>
      <label className="upload-label checkin-polaroid"><Camera size={17} />{preview && <img className="checkin-photo" src={preview} alt="Photo attached to this check-in" />}<span>{file ? file.name : 'Add a photo'}<small>Optional · JPG, PNG, WebP · up to 5 MB</small></span><input ref={photoInput} aria-label="Upload evidence photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const next = e.target.files?.[0] ?? null; if (next && (!next.size || next.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(next.type))) { setError('Choose a JPG, PNG, or WebP image up to 5 MB (not empty).'); e.target.value = ''; return; } setFile(next); setUploaded(false); setError(''); }} /></label>
      <EmbeddedDialog.Provider value={false}><CameraButton onPhoto={next => {setFile(next); setUploaded(false); setError('');}} /></EmbeddedDialog.Provider>
      {file && <p className="help-text">{uploaded ? 'Photo uploaded. ' : ''}Your photo will be attached to this check-in for AI evidence review.</p>}
      {file && <button type="button" className="text-button" onClick={() => { setFile(null); if (photoInput.current) photoInput.current.value = ''; upload.current = null; setUploaded(false); setError(''); }}>Remove photo</button>}
      </div>
      {error && <p role="alert" className="form-error">{error} Your note is kept here; retrying will not award XP twice.</p>}
      <button className="button primary full checkin-send" type="submit" aria-describedby={!body.trim() ? "checkin-send-hint" : undefined} disabled={!body.trim() || busy}><Send size={16} /> {busy ? 'Sharing with the village…' : error ? 'Retry check-in' : 'Share check-in'}</button>
      {!body.trim() && <p id="checkin-send-hint" className="help-text">Write a little note to share your check-in.</p>}
    </fieldset></form>
    <p className="modal-footnote">A daily note counts once per day.</p>
  </section>;
}
