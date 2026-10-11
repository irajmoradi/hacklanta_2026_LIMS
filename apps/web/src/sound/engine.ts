import { AmbienceMixer } from './ambience';
export type SoundEntry = {name: string; file: string; loop: boolean; volume: number; fallback?: string; ambience?: boolean};
export type SoundSettings = {muted: boolean; volume: number; reduced: boolean};
export class SoundEngine {
  settings: SoundSettings = {muted: false, volume: .65, reduced: false};
  private clips = new Map<string, HTMLAudioElement>();
  private entries: SoundEntry[] = [];
  private unlocked = false;
  readonly ambience = new AmbienceMixer();
  private listeners = new Set<() => void>();
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => {this.listeners.delete(fn);}; };
  snapshot = () => this.settings;
  private initialization?: Promise<void>;
  init() { return this.initialization ??= this.load(); }
  private async load() {
    try { const saved = JSON.parse(localStorage.getItem('village:sound') ?? 'null'); if (saved) this.settings = {muted: saved.muted === true, reduced: saved.reduced === true, volume: typeof saved.volume === 'number' ? Math.max(0,Math.min(1,saved.volume)) : .65}; } catch { /* Storage is optional. */ }
    this.listeners.forEach(fn => fn());
    try { const response = await fetch('/sfx/manifest.json'); if (!response.ok) return; const entries: unknown = await response.json();
      if (!Array.isArray(entries)) return;
      this.entries = entries.filter((entry): entry is SoundEntry => typeof entry?.name === 'string' && typeof entry.file === 'string' && entry.file.startsWith('/sfx/') && typeof entry.loop === 'boolean' && typeof entry.volume === 'number' && Number.isFinite(entry.volume) && entry.volume >= 0 && entry.volume <= 1);
      this.ambience.setAssets(this.entries.filter(e => e.ambience));
      for (const entry of this.entries.filter(e => !e.ambience)) { const clip = new Audio(entry.file); clip.preload = 'auto'; clip.loop = entry.loop; this.clips.set(entry.name, clip); }
      this.sync();
    } catch { /* Missing assets never block the village. */ }
  }
  unlock = () => {this.unlocked = true; this.ambience.unlock(); this.sync();};
  private reduced() { return this.settings.reduced || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  effectsEnabled() { return this.unlocked && !this.settings.muted && !this.reduced() && this.settings.volume > 0 && !(typeof document !== 'undefined' && document.hidden); }
  configure(next: Partial<SoundSettings>) { this.settings = {...this.settings, ...next, volume: Number.isFinite(next.volume) ? Math.max(0, Math.min(1, next.volume!)) : this.settings.volume}; try {localStorage.setItem('village:sound', JSON.stringify(this.settings));} catch { /* Optional storage. */ } this.sync(); this.listeners.forEach(fn => fn()); }
  play(name: string) {
    if (!this.unlocked || this.settings.muted || this.reduced() || (typeof document !== 'undefined' && document.hidden)) return;
    const clip = this.clips.get(name), entry = this.entries.find(e => e.name === name); if (!clip || !entry) return;
    clip.volume = entry.volume * this.settings.volume; if (!entry.loop) clip.currentTime = 0;
    void clip.play().catch(() => {});
  }
  setAmbient(name: string | null) { this.ambience.setBed(name); this.sync(); }
  sync = () => {
    const enabled = this.unlocked && !this.settings.muted && !this.reduced() && !(typeof document !== 'undefined' && document.hidden);
    for (const entry of this.entries) { const clip = this.clips.get(entry.name); if (!clip) continue;
      clip.volume = entry.volume * this.settings.volume;
      if (!enabled || entry.loop) clip.pause();
    }
    this.ambience.configure(enabled, this.settings.volume);
  };
  stop() {this.unlocked=false;this.clips.forEach(c => c.pause()); this.ambience.stop();}

}
export const sound = new SoundEngine();
export function ambientFor(weather = '', time = '', hour = new Date().getHours()) {
  if (/rain|storm/i.test(weather)) return 'rain_soft';
  if (/night|evening/i.test(time) || /night/i.test(weather) || (!time && (hour >= 20 || hour < 6))) return 'night_soft';
  return 'day_birds_breeze';
}
