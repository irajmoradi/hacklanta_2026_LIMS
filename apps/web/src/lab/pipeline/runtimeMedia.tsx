import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { AvatarManifest } from '../../api/types';

export const IRAJ = '13370000-0000-4000-8000-000000000001';
export const PLACEHOLDER = '/lab/placeholder.svg';
export const SAMPLE_COLORS = { skin: '#d5ae88', hair: '#655647', shirt: '#658d7a', pants: '#2f3640', shoes: '#222222' };
export type DemoMedia = { runtime: boolean; photo: string; chibi?: string; crop?: string; head?: string; headHeaders?: Record<string, string>; audio?: string; masks: Record<string, string>; derivedMask?: boolean; colors: AvatarManifest['body']['colors'] };
const fallback: DemoMedia = { runtime: false, photo: PLACEHOLDER, masks: {}, colors: SAMPLE_COLORS };

/** Only metadata for joined villages and Iraj's own assets; never generation. */
export async function loadDemoMedia(keep: (blob: Blob) => string): Promise<DemoMedia> {
  // Demo seats (X-Demo-User) and Auth0 tokens both authorize these member-only GETs (R-190).
  if (api.mode !== 'live') return fallback;
  const me = await api.me();
  for (const membership of me.villages) {
    const village = await api.village(membership.id);
    if (!village.villagers.some(p => p.user_id === me.user.id)) continue;
    const person = village.villagers.find(p => p.user_id === IRAJ && p.avatar.user_id === IRAJ);
    if (!person) continue;
    const asset = async (value?: string) => {
      if (!value) return undefined;
      const url = new URL(value, location.origin);
      if (![location.origin, 'http://localhost:8010', 'http://127.0.0.1:8010'].includes(url.origin) || !url.pathname.startsWith('/api/assets/')) return undefined;
      // URLs come only from this villager's manifest or the scoped worker layout.
      return keep(await api.request<Blob>('GET', url.pathname.slice(4) + url.search));
    };
    const optional = (value?: string) => asset(value).catch(() => undefined);
    const base = `/api/assets/avatars/${IRAJ}`;
    const [photo, head, crop, chibi, ...masks] = await Promise.all([
      optional(person.avatar.portrait.asset_url), optional(person.avatar.portrait.head_package_url), optional(`${base}/full_body.png`),
      optional(`${base}/body/stylized_head.png`),
      ...['person', 'hair', 'shirt'].map(part => optional(`${base}/segment/person_0/masks/${part}.png`)),
    ]);
    let derivedMask = false;
    if (crop && !masks[0]) {
      // SAM's full_body.png replaces the background with white. This is a visual
      // approximation (white clothing may be omitted), never labeled an exact mask.
      try {
        const img = new Image(); img.src = crop; await img.decode();
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const foreground = Math.min(pixels.data[i], pixels.data[i+1], pixels.data[i+2]) < 245 && pixels.data[i+3] > 0;
          pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = foreground ? 255 : 0;
          pixels.data[i+3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
        masks[0] = canvas.toDataURL(); derivedMask = true;
      } catch { /* Unusable crop retains the illustrated segmentation. */ }
    }
    let audio: string | undefined;
    // Existing read-only cache manifest; select only Iraj, never fetch neighbors' audio.
    try {
      const manifest = await api.request<Record<string, Record<string, string[]>>>('GET', `/villages/${membership.id}/barks`);
      const url = Object.values(manifest[IRAJ] ?? {}).flat().find(url => url.startsWith(`/api/barks/${IRAJ}/`));
      if (url) {
        const response = await fetch(url, { method: 'GET', headers: await api.authHeaders() });
        if (response.ok) audio = keep(await response.blob());
      }
    } catch { /* Voice is optional; never request synthesis. */ }
    return { runtime: !!photo, photo: photo ?? PLACEHOLDER, chibi, head: head ? new URL(person.avatar.portrait.head_package_url!, location.origin).pathname : undefined, headHeaders: head ? await api.authHeaders() : undefined, crop, audio, derivedMask,
      masks: Object.fromEntries(['person', 'hair', 'shirt'].flatMap((part, i) => masks[i] ? [[part, masks[i]!]] : [])), colors: person.avatar.body.colors };
  }
  return fallback;
}

export function useDemoMedia() {
  const [media, setMedia] = useState(fallback);
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    setMedia(fallback);
    void loadDemoMedia(blob => {
      const url = URL.createObjectURL(blob);
      if (active) urls.push(url); else URL.revokeObjectURL(url);
      return url;
    }).then(value => { if (active) setMedia(value); }).catch(() => {});
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [api.user, api.mode, api.tokenProvider]);
  return media;
}

export function DemoPhoto({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} onError={event => { event.currentTarget.src = PLACEHOLDER; }} />;
}
