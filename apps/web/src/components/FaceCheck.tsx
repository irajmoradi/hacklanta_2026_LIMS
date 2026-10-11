import { PhotoCapture } from './PhotoCapture';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Dialog } from './shared';

export function selfieError(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPEG, PNG or WebP selfie.';
  if (!file.size || file.size > 8 * 1024 * 1024) return 'Choose a nonempty selfie up to 8 MiB.';
  return null;
}
export function faceError(error: unknown): string {
  const status = (error as {status?: number})?.status;
  if (status === 429) return 'Five tries per minute. Take a breather and try again in a minute.';
  if (status === 404) return 'Add an avatar photo in your profile first, then refresh your face check.';
  if (status === 422) return 'No usable face found. Try a clear, well-lit photo with just your face.';
  return 'The face-check worker is taking a break. You can skip this and enjoy the village.';
}
export function FaceCheck({name, onClose, onRecognized}: {name: string; onClose: () => void; onRecognized: () => void}) {
  const [busy, setBusy] = useState(false), [camera, setCamera] = useState(false);
  const [message, setMessage] = useState(''), [success, setSuccess] = useState(false);
  const [outcome, setOutcome] = useState('match');
  const alive = useRef(true), lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function verify(file: File) {
    if (lock.current) return;
    const invalid = selfieError(file); if (invalid) { setMessage(invalid); return; }
    lock.current = true; setBusy(true); setMessage(''); setCamera(false);
    try {
      // Demo outcomes are explicit and never sent to the live endpoint.
      const sample = api.mode === 'mock' ? new File([file], `${outcome}.jpg`, {type: file.type}) : file;
      const result = await api.faceVerify(sample);
      if (!alive.current) return;
      if (!result.face_found) setMessage('No face found. Face the camera in good light and try again.');
      else if (!result.match) setMessage(`Hmm, that doesn't look like ${name}. Try again with a clear selfie.`);
      else { setSuccess(true); setMessage(`Welcome back, ${name}!`); onRecognized(); }
    } catch (e) { if (alive.current) setMessage(faceError(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function enroll() {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage(''); setCamera(false);
    try { const result = await api.faceEnroll(); if (alive.current) setMessage(result.enrolled && result.face_found ? 'Your existing avatar photo is ready. Now check your selfie!' : 'No face found in your avatar photo. Update it in your profile first.'); }
    catch (e) { if (alive.current) setMessage(faceError(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <Dialog title="Say cheese — is it really you?" eyebrow="OPTIONAL FACE CHECK" onClose={onClose} className="face-check">
    <p>A fun second step for {name}. No liveness check: a photo can pass. This does not secure your account.</p>
    <p className="help-text">Only opening the camera asks permission. Capture sends one frame for comparison; the selfie is never saved. You can skip anytime. Five attempts per minute.</p>
    {api.mode === 'mock' && <label>Demo result<select value={outcome} onChange={e => setOutcome(e.target.value)} disabled={busy}><option value="match">Match</option><option value="mismatch">Different face</option><option value="no-face">No face</option><option value="offline">Worker offline</option><option value="limited">Rate limited</option></select></label>}
    {message && <p role="status" className="face-result">{message}</p>}
    {success ? <><button className="button primary" onClick={onClose}>Back to the village</button></> : <>
      {camera && <PhotoCapture maxMB={8} title="Face-check selfie" onClose={() => setCamera(false)} onConfirm={photo => void verify(photo)} />}
      <div className="face-actions"><button className="button primary" disabled={busy} onClick={() => setCamera(true)}>Open camera</button></div>
      <label>Upload a selfie<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => {const file = e.target.files?.[0]; e.target.value = ''; if (file) void verify(file);}} /></label>
      <button className="text-button" disabled={busy} onClick={() => void enroll()}>Refresh from my avatar photo</button>
    </>}
    <button className="button secondary" onClick={onClose}>Skip for now</button>
  </Dialog>;
}
