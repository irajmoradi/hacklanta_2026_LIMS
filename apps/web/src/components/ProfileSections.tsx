import { useEffect, useState } from 'react';
import { LockKeyhole, Trophy } from 'lucide-react';
import { api } from '../api/client';
import { catalog } from '../api/equipment';
import type { Profile, FeedItem, ShopItem, Villager } from '../api/types';
import type { Accomplishment } from '../api/reactions';
import { ItemThumbnail } from './ItemThumbnail';
import { ReactionBar } from './ReactionBar';
import { ActivityFeed } from './ActivityFeed';
import { groupActivity } from './activityData';
import { EmptyState, errorText, when } from './shared';

const requirements: Record<string, string> = {
  weekly_crown: 'Win a weekly crown', perfect_week: 'Check in every day Monday-Sunday (UTC)',
  streak_28: 'Check in 28 days in a row', auditor: 'Finalize a weekly audit as the assigned auditor',
  festival_vip: 'Complete a Mayor game-night event, confirmed by the village owner', mayor_event: 'Complete a rewarded Mayor event, confirmed by the village owner', competition_win: 'Win a competition',
};
export function ProfileRewards({profile, mine, vid}: {profile: Profile; mine: boolean; vid: string}) {
  const [owned, setOwned] = useState<ShopItem[]>([]), [error, setError] = useState('');
  const [loaded, setLoaded] = useState(!mine), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (mine) { setLoaded(false); setError(''); void api.shop(vid).then(s => {if (active) {setOwned(s.items.filter(i => i.owned)); setLoaded(true);}}).catch(e => {if (active) setError(errorText(e));}); }
    return () => {active = false;};
  }, [vid, mine, profile.villager.user_id, attempt]);
  const person = profile.villager;
  const rewards = catalog.filter(i => i.source?.startsWith('earned:'));
  const has = (id: string) => (mine && owned.some(i => i.id === id)) || person.equipped_ids.includes(id);
  return <section aria-label="Rewards"><h3>{mine ? 'Earn your next signature' : `${person.display_name}'s trophies`}</h3>
    <p className="help-text">{mine ? 'Earned rewards stay in your collection.' : 'Only equipped rewards are public. More may be hidden; private ownership is not shown.'}</p>
    {error ? <p role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Retry rewards</button></p> : mine && !loaded ? <p role="status">Loading rewards...</p> : <>{[true, false].map(earned => <section key={String(earned)} aria-label={earned ? 'Earned rewards' : 'Still to earn'}><h4>{earned ? 'Earned' : 'Still to earn'}</h4>
      {!mine && !earned && <p className="help-text">Public progress only; some of these trophies may already be privately owned.</p>}
      {earned && !rewards.some(i => has(i.id)) && <p>No {mine ? '' : 'public '}trophies yet.</p>}
      <div className="reward-grid">{rewards.filter(i => has(i.id) === earned).map(item => {
        const rule = item.source!.split(':')[1];
        const equipped = person.equipped.find(i => i.item_id === item.id);
        const date = equipped?.acquired_at ?? (mine ? owned.find(i => i.id === item.id)?.acquired_at : null);
        const target = rule === 'streak_28' ? 28 : null;
        const value = Math.min(28, Math.max(0, person.streak_days));
        return <article className={`reward-card ${!earned ? 'locked' : ''}`} key={item.id} data-item-id={item.id}>
          <div className="reward-art"><ItemThumbnail staticFallback id={item.id} assetKey={item.asset_key} rarity={item.rarity} fallback={<span className="neutral-item"/>}/>{!earned && <LockKeyhole size={16} aria-label="Locked"/>}</div>
          <div><span className="eyebrow">{item.rarity}</span><h4>{item.name}</h4>
          {earned && <span className="reward-chip">Earned {date ? new Date(date).toLocaleDateString() : '· date unavailable'}</span>}
          {person.equipped_ids.includes(item.id) && <span className="reward-chip">Showcase equipped</span>}
          <p>How it's earned: {requirements[rule] ?? item.description}</p>
          {!earned && target && <><progress aria-label={`${person.display_name}: ${item.name} progress`} max={target} value={value}/><small>{value} / {target} days</small></>}
          {!earned && !target && <small>{mine ? 'Progress' : `${person.display_name}'s progress`}: not available</small>}</div>
        </article>;
      })}</div></section>)}</>}
  </section>;
}

export function ProfileNews({vid, uid, person, accomplishments = false}: {vid: string; uid: string; person?: Villager; accomplishments?: boolean}) {
  const [rows, setRows] = useState<(FeedItem | Accomplishment)[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const request = accomplishments ? api.accomplishments(vid) : api.feed(vid);
    void request.then(items => {if (active) setRows(accomplishments ? items.filter(i => i.user_id === uid) : items);}).catch(e => {if (active) setError(errorText(e));}).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [vid, uid, accomplishments, attempt]);
  return <section className={`profile-section profile-news${accomplishments ? ' profile-accomplishments' : ''}`} aria-label={accomplishments ? 'Accomplishments' : 'Personal activity'}><h3>{accomplishments ? 'Accomplishments' : 'Activity'}</h3>
    {loading ? <p role="status">Catching up...</p> : error ? <p role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Retry activity</button></p> : <>{(accomplishments ? rows : []).map(item => <article className="profile-accomplishment" key={item.id}><Trophy size={16} aria-hidden="true" /><div className="accomplishment-copy"><p>{'title' in item ? item.title : item.text}</p><time dateTime={item.created_at}>{when(item.created_at)}</time></div><ReactionBar vid={vid} target_kind={'target_kind' in item ? item.target_kind : 'activity'} target_id={'target_id' in item ? item.target_id : item.id} reactions={item.reactions}/></article>)}{!accomplishments && <ActivityFeed groups={groupActivity(rows as FeedItem[]).filter(g => g.items[0].user_id === uid)} vid={vid} people={person ? [person] : []}/>}{!(accomplishments ? rows : groupActivity(rows as FeedItem[]).filter(g => g.items[0].user_id === uid)).length && <EmptyState>{accomplishments ? 'No accomplishments yet.' : 'No recent activity from this villager.'}</EmptyState>}</>}
  </section>;
}
