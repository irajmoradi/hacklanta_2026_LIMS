export type BarkTrigger = 'walk' | 'wave' | 'cheer' | 'spin' | 'cafe' | 'attraction' | 'checkin' | 'cheered' | 'house';
export type BarkManifest = Record<string, Partial<Record<BarkTrigger, string[]>>>;
type Spatial = {distance: number; visible: boolean; at: number};
export class BarkPlayer {
  manifest: BarkManifest = {};
  enabled = true;
  private last = -Infinity;
  private avatars = new Map<string, number>();
  private spatial = new Map<string, Spatial>();
  private audio?: HTMLAudioElement;
  private url?: string;
  private busy = false;
  private revision = 0;
  private speaker?: string;
  private watchdog?: ReturnType<typeof setInterval>;
  constructor(private allowed: () => boolean, private volume: () => number, private fetchClip: (url: string) => Promise<Blob>, private clock = () => performance.now()) {}
  locate(id: string, distance: number, visible: boolean) { this.spatial.set(id, {distance, visible, at:this.clock()}); if (id === this.speaker) this.sync(); }
  forget(id: string) { this.spatial.delete(id); if (id === this.speaker) this.stop(); }
  private gain(id: string) {
    const p = this.spatial.get(id);
    return p?.visible && this.clock()-p.at < 500 && p.distance < 100 ? Math.max(0, 1-p.distance/100) : 0;
  }
  async trigger(id: string, trigger: BarkTrigger) {
    const clips = this.manifest[id]?.[trigger], now = this.clock();
    if (!this.enabled || !this.allowed() || !clips?.length || this.busy || !this.gain(id) || now-this.last < 4000 || now-(this.avatars.get(id) ?? -Infinity) < 20000) return;
    this.busy = true; this.last = now; this.avatars.set(id, now);
    this.speaker = id;
    this.watchdog = setInterval(() => { if (this.clock()-now > 15000) this.stop(); else this.sync(); }, 200);
    const revision = ++this.revision;
    try {
      const blob = await this.fetchClip(clips[Math.floor(Math.random()*clips.length)]);
      if (revision !== this.revision) return;
      if (!this.enabled || !this.allowed() || !this.gain(id)) {this.stop(); return;}
      this.url = URL.createObjectURL(blob);
      const audio = new Audio(this.url); this.audio = audio;
      audio.volume = this.volume()*this.gain(id);
      audio.onended = audio.onerror = () => { if (revision === this.revision) this.stop(); };
      await audio.play();
    } catch { if (revision === this.revision) this.stop(); }
  }
  sync() { if (!this.enabled || !this.allowed() || (this.speaker && !this.gain(this.speaker))) this.stop(); else if (this.audio && this.speaker) this.audio.volume=this.volume()*this.gain(this.speaker); }
  stop() { ++this.revision; clearInterval(this.watchdog); this.speaker=undefined; this.audio?.pause(); this.audio = undefined; if (this.url) URL.revokeObjectURL(this.url); this.url = undefined; this.busy = false; }
  reset() { this.stop(); this.manifest = {}; this.spatial.clear(); }
}

export function actionBark(walking: boolean, emote: BarkTrigger | null, activity: string, riding: boolean): BarkTrigger | null {
  return emote ?? (riding ? 'attraction' : walking ? 'walk' : activity === 'cafe' ? 'cafe' : activity === 'dance' ? 'attraction' : null);
}
