import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Review } from '../api/types';
import { Dialog, errorText, mediaUrl } from './shared';

export function Evidence({ url, review, vid, checkId }: { url: string; review?: Review | null; vid?: string; checkId?: string }) {
  const [src, setSrc] = useState(''), [error, setError] = useState(''), [open, setOpen] = useState(false), [attempt, setAttempt] = useState(0);
  const [verdict, setVerdict] = useState(review), [reviewError, setReviewError] = useState('');
  useEffect(() => {
    let active = true, source = ''; setSrc(''); setError('');
    void mediaUrl(url).then(value => { source = value; if (active) setSrc(value); else if (value.startsWith('blob:')) URL.revokeObjectURL(value); }).catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; if (source.startsWith('blob:')) URL.revokeObjectURL(source); };
  }, [url, attempt]);
  useEffect(() => { setVerdict(review); }, [review]);
  useEffect(() => {
    if (!open || !vid || !checkId) return;
    let active = true; setReviewError('');
    void api.review(vid, checkId).then(value => { if (active) setVerdict(value); }).catch(e => { if (active) setReviewError(errorText(e)); });
    return () => { active = false; };
  }, [open, review, vid, checkId]);
  return <>
    {src ? <button className="evidence-thumbnail" onClick={() => setOpen(true)} aria-label="View evidence"><img className="evidence-image" src={src} alt="Check-in evidence" onError={() => { setSrc(''); setError('Evidence image could not load.'); }} /><span>View evidence ↗</span></button> : <p className="help-text">{error || 'Loading evidence…'}{error && <button className="text-button" onClick={() => setAttempt(n => n + 1)}>Retry evidence</button>}</p>}
    {open && <Dialog title="Evidence review" eyebrow="CHECK-IN EVIDENCE" wide onClose={() => setOpen(false)}>
      <img className="evidence-full" src={src} alt="Full check-in evidence" />
      <div className={`audit-review ${verdict?.verdict ?? 'pending'}`}><strong>AI verdict: {verdict?.verdict ?? 'Pending / unavailable'}</strong><p>{verdict?.reason || reviewError || 'The review has not arrived yet.'}</p><small>Model: {verdict?.model ?? 'Not supplied'} · AI advice; human decides</small></div>
    </Dialog>}
  </>;
}
