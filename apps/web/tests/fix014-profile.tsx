import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { ProfilePanel } from '../src/components/ProfilePanel';
import { api } from '../src/api/client';
import { DEMO_USER_ID, makeFixtures } from '../src/api/fixtures';
import '../src/styles.css';

// Isolated, synthetic fixture: no live API or generation requests.
api.mode = 'mock';
api.user = DEMO_USER_ID;
const { village, profiles } = makeFixtures();
const params = new URLSearchParams(location.search);
const mine = !params.has('peer');
const profile = profiles[village.villagers[mine ? 0 : 1].user_id];
if (params.has('long')) {
  profile.villager.display_name = 'AReallyLongUnbrokenDisplayNameForLayoutTesting';
  profile.goal!.title = 'AnUnbrokenGoalTitleThatMustStayWithinTheProfilePanel';
}
api.accomplishments = async () => [0, 1].map(i => ({
  id: `layout-${i}`, user_id: profile.villager.user_id, display_name: profile.villager.display_name,
  type: 'goal_completed', title: i ? 'Made time for a creative project with the whole village' : 'Learned something new',
  created_at: '2026-10-01T12:00:00Z', target_kind: 'goal', target_id: `past-${i}`,
  reactions: [{ emoji: '🎉', count: 12, mine: false }],
}));
function Fixture() {
  const [settings, setSettings] = useState(false);
  return <div className="app has-profile"><ProfilePanel profile={profile} loading={false} error="" onRetry={() => {}}
    onClose={() => {}} onCheckIn={() => {}} mine={mine} vid={village.id} owner={mine} refresh={async () => {}}
    onSettings={() => setSettings(true)} onShopItem={() => {}} />{settings && <div role="status">Settings opened</div>}</div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
