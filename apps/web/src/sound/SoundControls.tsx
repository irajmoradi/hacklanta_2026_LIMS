import { Volume2 } from 'lucide-react';
import { SettingToggle } from '../components/SettingToggle';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { ambientFor, sound } from './engine';
export function SoundLifecycle({weather, time, arena = false}: {weather?: string; time?: string; arena?: boolean}) {
  useEffect(() => {void sound.init(); const unlock = (event: Event) => {if (event.isTrusted) sound.unlock();};
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', sound.sync); const preference = matchMedia('(prefers-reduced-motion: reduce)'); preference.addEventListener('change', sound.sync);
    return () => {window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); document.removeEventListener('visibilitychange', sound.sync); preference.removeEventListener('change', sound.sync); sound.stop();};
  }, []);
  useEffect(() => {const update = () => sound.setAmbient(arena ? 'arena_crowd_murmur' : ambientFor(weather, time)); update(); const timer = setInterval(update, 60000); return () => clearInterval(timer);}, [weather, time, arena]);
  return null;
}
export function SoundToggle() {const settings = useSyncExternalStore(sound.subscribe, sound.snapshot); return <button className="text-button sound-toggle" aria-label={settings.muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={settings.muted} onClick={() => sound.configure({muted: !settings.muted})}>{settings.muted ? 'Sound off' : 'Sound on'}</button>;}
export function SoundSettings({children}: {children?: ReactNode}) {
  const settings = useSyncExternalStore(sound.subscribe, sound.snapshot);
  return <section className="settings-card"><h3><Volume2 aria-hidden="true" />Sound</h3>
    <SettingToggle label="Sound on" help="Village effects and ambience. Sounds start after you interact." checked={!settings.muted} onChange={on => sound.configure({muted: !on})} />
    {children}
    <div className="volume-setting"><label htmlFor="sound-volume">Sound volume</label><output htmlFor="sound-volume">{Math.round(settings.volume * 100)}%</output>
      <input id="sound-volume" type="range" min="0" max="1" step="0.05" aria-describedby="volume-help" aria-valuetext={`${Math.round(settings.volume * 100)} percent`} value={settings.volume} onChange={e => sound.configure({volume: Number(e.target.value)})} />
      <p id="volume-help" className="help-text">Sound preferences save immediately on this device.</p>
    </div>
    <SettingToggle label="Reduced sound" help="Silence effects and ambience. Your device's reduced motion preference also silences them." checked={settings.reduced} onChange={reduced => sound.configure({reduced})} />
  </section>;
}
