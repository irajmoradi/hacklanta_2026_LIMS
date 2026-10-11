import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../src/api/client';
import { CinematicScene } from '../src/components/CinematicScene';
import '../src/styles.css';

await api.initialize();
if (api.mode !== 'mock') throw new Error('WEB-042 harness requires mock mode.');
const identity = await api.me();
const vid = identity.villages[0].id;
const initial = await Promise.all([api.village(vid), api.profile(vid, api.user), api.week(vid)]);
function Harness() {
  const [village, setVillage] = useState(initial[0]), [profile, setProfile] = useState(initial[1]), [week, setWeek] = useState(initial[2]);
  const [open, setOpen] = useState(false), [play, setPlay] = useState(false);
  async function refresh() {
    const [nextVillage, nextProfile, nextWeek] = await Promise.all([api.village(vid), api.profile(vid, api.user), api.week(vid)]);
    setVillage(nextVillage); setProfile(nextProfile); setWeek(nextWeek);
  }
  return <><button onClick={() => setOpen(true)}>Mayor</button>{play && <p>Colosseum selected</p>}{open && <CinematicScene kind="mayor" village={village} profile={profile} week={week} reward={null} onClose={() => setOpen(false)} refresh={refresh} onPlay={() => { setOpen(false); setPlay(true); }} onGoal={() => {}} submit={async () => {}}/>}</>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
