import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Profile, Village } from '../api/types';
import type { Accomplishment } from '../api/reactions';
import { Dialog, Portrait, errorText } from './shared';
import { usePresence } from './Presence';
import { friendSummary } from './friendsData';
import { toast } from './toastStore';
import './friends.css';

export function Friends({village, user, onClose, onProfile, onMessage, onChallenge}: {
  village: Village; user: string; onClose: () => void;
  onProfile: (id: string, section?: 'house' | 'accomplishments') => void;
  onMessage: (id: string) => void; onChallenge: (name: string) => void;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]), [awards, setAwards] = useState<Accomplishment[]>([]);
  const [awardsAvailable, setAwardsAvailable] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null), [sent, setSent] = useState<Record<string,string>>({});
  const lock = useRef(false);
  const {online, connected} = usePresence();
  useEffect(() => {
    let alive = true; setLoading(true); setError('');
    void Promise.all([Promise.allSettled(village.villagers.filter(p => p.user_id !== user).map(p => api.profile(village.id, p.user_id))), api.accomplishments(village.id).then(rows => ({rows, failed:false}), () => ({rows:[] as Accomplishment[], failed:true}))]).then(([results, accomplishments]) => {
      if (!alive) return;
      setProfiles(results.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])); setAwards(accomplishments.rows); setAwardsAvailable(!accomplishments.failed);
      if (results.some(r => r.status === 'rejected') || accomplishments.failed) setError('Some friend updates could not load. Try again to see the rest.');
    }).finally(() => {if (alive) setLoading(false);});
    return () => {alive = false;};
  }, [village.id, user, attempt, village.villagers]);
  async function send(id: string, wave = false) {
    if (lock.current) return; lock.current = true; setBusy(id);
    try { await api.sendMessage(village.id, id, wave ? 'Sending you a wave!' : 'Cheering you on!', wave ? 'poke' : 'cheer'); setSent(s => ({...s,[id]:wave ? 'Wave sent!' : 'Cheer sent!'})); }
    catch(e) {toast({kind:'error',title:errorText(e)});} finally {lock.current = false; setBusy(null);}
  }
  const friends = profiles.map(profile => ({profile,...friendSummary(profile, awards)})).sort((a,b) => Number(b.needsCheer)-Number(a.needsCheer) || Number(b.justFinished)-Number(a.justFinished) || a.profile.villager.display_name.localeCompare(b.profile.villager.display_name));
  return <Dialog title="Friends" eyebrow="YOUR PEOPLE" onClose={onClose} wide className="friends-dialog">
    <p>Needs a cheer comes first: friends who just finished something or haven't checked in today. Today uses UTC.</p>
    {error && <p role="alert">{error} <button className="text-button" onClick={() => setAttempt(n => n+1)}>Retry friends</button></p>}
    {loading ? <p role="status">Catching up with your friends...</p> : <div className="friends-grid">{friends.map(({profile,checkIn,latest,needsCheer,justFinished,progress}) => {
      const p = profile.villager, presence = online.find(o => o.user_id === p.user_id);
      return <article className="friend-card" key={p.user_id} aria-label={p.display_name}>
        <header><Portrait person={p}/><div><h3>{p.display_name}</h3><small>{presence ? `Online · ${presence.activity}` : connected ? 'Offline' : 'Presence unavailable'}</small></div></header>
        {needsCheer && <span className="reward-chip">{justFinished ? 'Something to celebrate' : 'Needs a cheer'}</span>}
        <p><strong>Today:</strong> {checkIn?.body ?? `${p.display_name} hasn't checked in today. Send a wave?`}</p>
        <p><strong>Goal:</strong> {profile.goal?.title ?? 'No goal yet. Ask what they are working on.'}</p>
        {profile.goal && <p>{profile.goal.status} · {progress} progress check-ins</p>}
        <button className="text-button" onClick={() => onProfile(p.user_id, 'accomplishments')}>See their accomplishments</button>
        <p><strong>Latest accomplishment:</strong> {!awardsAvailable ? 'Accomplishments could not load. Try again above.' : latest?.title ?? 'No accomplishments yet. Cheer them on.'}</p>
        <p>{p.streak_days} day streak</p>
        <div className="friend-actions"><button className="button primary" disabled={busy !== null} onClick={() => void send(p.user_id)}>Cheer</button>{!checkIn && <button className="button secondary" disabled={busy !== null} onClick={() => void send(p.user_id,true)}>Send a wave</button>}<button className="button secondary" onClick={() => onMessage(p.user_id)}>Message</button><button className="button secondary" onClick={() => onProfile(p.user_id,'house')}>Visit house</button><button className="button secondary" onClick={() => onChallenge(p.display_name)}>Challenge</button></div>
        {sent[p.user_id] && <p role="status">{sent[p.user_id]}</p>}
      </article>;
    })}</div>}
    {!loading && !village.villagers.some(p => p.user_id !== user) && <p>Your friends will appear here when they join. Open Village to share an invitation.</p>}
  </Dialog>;
}
