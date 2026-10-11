import { useEffect, useState } from 'react';
import { mediaUrl } from './shared';

/** Isolated CV adapter. Supports a video URL, or JSON {video_url?, frames?: string[], fps?}.
 * Unsupported packages intentionally retain the authenticated portrait crop.
 */
export function LamHead({ packageUrl, photo, name }: { packageUrl?: string; photo: string | null; name: string }) {
  const [video, setVideo] = useState(''), [frames, setFrames] = useState<string[]>([]), [index, setIndex] = useState(0), [fps, setFps] = useState(12);
  useEffect(() => {
    let active = true; const objects: string[] = [];
    setVideo(''); setFrames([]); setIndex(0);
    async function resolve(url: string) { const source = await mediaUrl(url); if (source.startsWith('blob:')) { if (!active) URL.revokeObjectURL(source); else objects.push(source); } return source; }
    async function load() {
      if (!packageUrl) return;
      const source = await resolve(packageUrl);
      if (/\.(mp4|webm)(\?|$)/i.test(packageUrl)) { if (active) setVideo(source); return; }
      const response = await fetch(source, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return;
      if (response.headers.get('content-type')?.startsWith('video/')) { if (active) setVideo(source); return; }
      const data = await response.json() as { video_url?: string; frames?: string[]; fps?: number };
      const absolute = (url: string) => new URL(url, new URL(packageUrl, location.origin)).href;
      if (data.video_url) { const src = await resolve(absolute(data.video_url)); if (active) setVideo(src); }
      else if (Array.isArray(data.frames)) { const srcs = await Promise.all(data.frames.slice(0, 120).filter(f => typeof f === 'string').map(f => resolve(absolute(f)))); if (active) { setFrames(srcs); setFps(Math.max(1, Math.min(30, Number(data.fps) || 12))); } }
    }
    void load().catch(() => {});
    return () => { active = false; objects.forEach(URL.revokeObjectURL); };
  }, [packageUrl]);
  useEffect(() => { if (frames.length < 2) return; const timer = setInterval(() => setIndex(i => (i + 1) % frames.length), 1000 / fps); return () => clearInterval(timer); }, [frames, fps]);
  return <>{video ? <video src={video} autoPlay loop muted playsInline aria-label={`${name}'s animated head`} onError={() => setVideo('')} /> : frames.length ? <img src={frames[index]} alt={name} onError={() => setFrames([])} /> : <>{photo ? <img src={photo} alt={name} /> : name.slice(0, 2)}<small className="head-coming">3D head coming</small></>}</>;
}
