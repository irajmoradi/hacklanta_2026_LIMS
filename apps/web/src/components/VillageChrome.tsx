import { useState, useSyncExternalStore } from 'react';
import { Users, Volume2, VolumeOff } from 'lucide-react';
import type { Villager } from '../api/types';
import { sound } from '../sound/engine';
import { Dialog, Portrait } from './shared';
import { PresenceDot, usePresence } from './Presence';

export function SoundButton() {
  const settings = useSyncExternalStore(sound.subscribe, sound.snapshot);
  return <button className="button secondary sound-toggle" aria-label="Sound" title={settings.muted ? 'Sound muted — click to unmute' : 'Sound on — click to mute'} aria-pressed={!settings.muted} onClick={() => sound.configure({muted: !settings.muted})}>
    {settings.muted ? <VolumeOff size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
  </button>;
}

export function NeighborsStrip({villagers, onSelect}: {villagers: Villager[]; onSelect: (id: string) => void}) {
  const [open, setOpen] = useState(false);
  const {online, connected} = usePresence();
  const moving = villagers.length > 5;
  const portraits = () => <span className="neighbor-belt-group" aria-hidden="true">{villagers.map((person, i) => <span className={`neighbor-portrait ${i >= 5 ? 'neighbor-overflow' : ''}`} key={person.user_id}>
    <Portrait person={person} /><PresenceDot user={person.user_id} />
  </span>)}</span>;
  return <>
    <button className={`neighbors-strip members-strip ${moving ? 'has-marquee' : ''}`} aria-label={`Members, ${villagers.length} neighbors`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <span className="neighbor-count"><Users size={14} aria-hidden="true" />{villagers.length} neighbors</span>
      <span className="neighbor-window"><span className="neighbor-belt">{portraits()}{moving && portraits()}</span></span>
      {moving && <span className="neighbor-more">+{villagers.length - 5}</span>}
    </button>
    {open && <Dialog title="Members" eyebrow="YOUR PEOPLE" onClose={() => setOpen(false)}><ul className="members-list">{villagers.map(person => {
      const presence = online.find(p => p.user_id === person.user_id);
      return <li key={person.user_id}><button onClick={() => {setOpen(false); onSelect(person.user_id);}}><Portrait person={person} /><span><strong>{person.display_name}</strong><small>{presence ? `Online · ${presence.activity}` : connected ? 'Offline' : 'Presence unavailable'}</small></span><span>Level {person.level}</span></button></li>;
    })}</ul></Dialog>}
  </>;
}
