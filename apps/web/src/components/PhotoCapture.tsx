import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from './shared';
import './photoCapture.css';

function Thumbnail({file, alt}: {file: File; alt: string}) {
  const [url, setUrl] = useState('');
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  return <img src={url} alt={alt} />;
}
export function PhotoCapture({title = 'Take a photo', maxMB = 10, onConfirm, onClose}: {title?: string; maxMB?: number; onConfirm: (photo: File) => void; onClose: () => void}) {
  const [draft, setDraft] = useState<File | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user'), [camera, setCamera] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0), [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), generation = useRef(0), locked = useRef(false);
  const stop = () => { generation.current++; stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  useEffect(() => () => stop(), []);
  useEffect(() => { if (camera && !draft && video.current) video.current.srcObject = stream.current; }, [camera, draft, facing]);
  async function open(next = facing) {
    stop(); const token = generation.current; setBusy(true); setReady(false); setCamera(false); setError('');
    try {
      // Shared with FaceCheck; permission only on an explicit camera action.
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const media = await navigator.mediaDevices.getUserMedia({video: {facingMode: next, width: {ideal: 1280}}, audio: false});
      if (token !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media; setFacing(next); setCamera(true);
    } catch { if (token === generation.current) setError('Camera unavailable or permission declined. Upload a photo instead.'); }
    finally { if (token === generation.current) setBusy(false); }
  }
  function choose(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > maxMB * 1024 * 1024) { setError(`Choose a nonempty JPG, PNG or WebP up to ${maxMB} MB.`); return; }
    stop(); setCamera(false); setReady(false); setDraft(file); setError('');
  }
  async function capture() {
    if (locked.current || !ready) return; locked.current = true; setBusy(true);
    const token = generation.current;
    try {
      for (let n = 3; n > 0; n--) { setCount(n); await new Promise(resolve => setTimeout(resolve, 1000)); if (token !== generation.current) return; }
      setCount(0); const el = video.current; if (!el?.videoWidth) throw new Error();
      const canvas = document.createElement('canvas'); canvas.width = el.videoWidth; canvas.height = el.videoHeight;
      // Mirror only the CSS preview. Canvas stores the original camera frame.
      canvas.getContext('2d')!.drawImage(el, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
      canvas.width = canvas.height = 0;
      if (!blob) throw new Error('No camera frame');
      if (blob && token === generation.current) choose(new File([blob], 'photo.jpg', {type: 'image/jpeg'}));
    } catch { setError('Could not capture this frame. Try again or upload a photo.'); }
    finally { locked.current = false; setCount(0); setBusy(false); }
  }
  function confirm() {
    if (!draft) return;
    stop(); onConfirm(draft);
  }
  // Keep dialog controls outside the check-in/evidence forms that open this sheet.
  return createPortal(<Dialog title={title} eyebrow="CAMERA OR UPLOAD" onClose={onClose} className="capture-sheet">
    <h3>Find your frame</h3>
    <div className="capture-preview">
      {draft ? <Thumbnail file={draft} alt="Photo to confirm" /> : <><video ref={video} autoPlay muted playsInline className={facing === 'user' ? 'mirrored' : ''} onLoadedData={() => setReady(true)} aria-label="Live camera preview" />{!camera && <span className="capture-placeholder">Your camera preview appears here</span>}<svg className="capture-guide" viewBox="0 0 300 300" role="img" aria-label="Face oval guide"><ellipse cx="150" cy="127" rx="72" ry="91"/><path d="M40 300 Q40 226 105 222 M260 300 Q260 226 195 222"/></svg></>}
      {!!count && <strong className="capture-count" role="status">{count}</strong>}
    </div>
    <p className="capture-copy">Face a window, keep the camera at eye level, and avoid strong shadows. For a group or item, fit the whole subject in the frame.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="capture-actions">
      {draft ? <><button type="button" className="button secondary" onClick={() => setDraft(null)}>Retake</button><button type="button" className="button primary" onClick={confirm}>Confirm photo</button></> : <><button type="button" className="button primary" disabled={busy || !!count || (camera && !ready)} onClick={() => void (camera ? capture() : open())}>{busy ? (camera ? 'Preparing photo...' : 'Opening camera...') : camera ? 'Take photo' : 'Open camera'}</button>{camera && <button type="button" className="button secondary" disabled={busy || !!count} onClick={() => void open(facing === 'user' ? 'environment' : 'user')}>Switch camera</button>}<label className="button secondary">Upload photo<input aria-label="Upload capture photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !!count} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) choose(file); }} /></label></>}
    </div>
  </Dialog>, document.body);
}
export function CameraButton({onPhoto, maxMB = 5}: {onPhoto: (file: File) => void; maxMB?: number}) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="button secondary" onClick={() => setOpen(true)}>Take a photo</button>{open && <PhotoCapture maxMB={maxMB} onClose={() => setOpen(false)} onConfirm={photo => { onPhoto(photo); setOpen(false); }} />}</>;
}
