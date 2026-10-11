import type { Emote } from '../scene/emotes';

export type Movement = {x: number; z: number; heading: number; moving: boolean; running: boolean; emote?: Emote | null; activity?: 'cafe' | 'attraction' | null};
export type Sample = Movement & {at: number; seq: number; emoteStart: number};
/** Local receive times avoid assuming synchronized browser/server clocks. */
export class MovementBuffer {
  tracks = new Map<string, Sample[]>();
  push(id: string, data: Movement & {seq: number}, now: number) {
    const track = this.tracks.get(id) ?? [];
    const last = track.at(-1);
    if (last && last.seq >= data.seq) return;
    track.push({...data, at: now, emoteStart: last && last.emote === data.emote ? last.emoteStart : now});
    if (track.length > 8) track.shift();
    this.tracks.set(id, track);
  }
  sample(id: string, now: number): Sample | null {
    const track = this.tracks.get(id), last = track?.at(-1);
    if (!track || !last) return null;
    if (now - last.at > 5000) { this.tracks.delete(id); return null; }
    const time = now - 100;
    const b = track.find(p => p.at >= time) ?? last;
    const a = track[Math.max(0, track.indexOf(b) - 1)];
    const state = time < b.at ? a : b;
    if (!state.moving && !state.emote) return null;
    const span = b.at - a.at;
    const t = span > 0 ? Math.max(0, Math.min((time - a.at) / span, 1 + (b.moving ? 200 / span : 0))) : 1;
    const angle = Math.atan2(Math.sin(b.heading-a.heading), Math.cos(b.heading-a.heading));
    return {...state, x: a.x+(b.x-a.x)*t, z: a.z+(b.z-a.z)*t, heading: a.heading+angle*Math.min(1,t)};
  }
}
