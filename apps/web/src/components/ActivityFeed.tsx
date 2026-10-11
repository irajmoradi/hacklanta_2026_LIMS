import { createContext, useContext } from 'react';
import { ChevronRight } from 'lucide-react';
import type { CheckIn, FeedItem, Villager } from '../api/types';
import { activityName, activityCopy, classifyActivity, groupCopy, reactionEligible, relativeTime, type ActivityGroup } from './activityData';
import { Portrait } from './shared';
import { ItemThumbnail } from './ItemThumbnail';
import { ReactionBar } from './ReactionBar';
import { Evidence } from './Evidence';
import { CurrencyText } from './Currency';
import { VillageIcon, feedIcon, feedKindIcons } from './VillageIcon';
import './ActivityFeed.css';

export const ActivityEvidence = createContext<CheckIn[]>([]);
export const ActivityTitles = createContext<Record<string,string>>({});
export const ActivityNavigation = createContext<(item: FeedItem) => void>(() => {});
export function ActivityFeed({groups, vid, people = [], compact = false, onOpen}: {groups: ActivityGroup[]; vid: string; people?: Villager[]; compact?: boolean; onOpen?: (item: FeedItem) => void}) {
  const checkins = useContext(ActivityEvidence);
  const titles = useContext(ActivityTitles);
  const navigate = useContext(ActivityNavigation), open = onOpen ?? navigate;
  const checkId = (item: FeedItem) => (item.payload as {check_in_id?: string; checkin_id?: string}).check_in_id ?? (item.payload as {checkin_id?: string}).checkin_id;
  const titled = (item: FeedItem) => {
    const data = item.payload as {competition_id?: string; title?: string};
    return !data.title && data.competition_id && titles[data.competition_id] ? {...item,payload:{...item.payload,title:titles[data.competition_id]}} : item;
  };
  function evidence(item: FeedItem) {
    const data = item.payload as {evidence_asset_id?: string; evidence_url?: string; check_in_id?: string; checkin_id?: string};
    const url = data.evidence_asset_id ? `/api/assets/${data.evidence_asset_id}` : data.evidence_url ?? checkins.find(c => c.id === (data.check_in_id ?? data.checkin_id))?.evidence_url;
    return url ? <div className="activity-evidence"><Evidence url={url} vid={vid}/></div> : null;
  }
  return <div className={`activity-feed ${compact ? 'compact' : ''}`}>{groups.map(group => {
    const first = group.items[0], row = classifyActivity(first), person = people.find(p => p.user_id === first.user_id);
    const reactionCount = group.items.filter(reactionEligible).reduce((sum, item) => sum + (item.reactions ?? []).reduce((n, r) => n + r.count, 0), 0);
    const name = person?.display_name ?? activityName(first), copy = groupCopy({...group,items:group.items.map(titled)}, name);
    return <article className="activity-row" key={group.id} data-testid="activity-group" data-activity-id={first.id} data-checkin-id={checkId(first)}>
      {row.kind !== 'villager' ? <span className={`activity-avatar activity-avatar-${row.kind}`} role="img" aria-label={row.label ?? 'Village'}><VillageIcon name={feedKindIcons[row.kind]} size={18}/></span> : person ? <Portrait person={person}/> : <span className="activity-avatar" aria-label={name}>{name.slice(0,1)}</span>}
      <div className="activity-content">
      <button type="button" className="activity-link" onClick={() => open(first)}>
        <span className="activity-summary"><VillageIcon name={feedIcon(first.type)} size={14}/><span className="activity-title">{copy.title}</span><time dateTime={first.created_at} title={new Date(first.created_at).toLocaleString()}>{relativeTime(first.created_at)}</time><ChevronRight className="activity-chevron" size={14} aria-hidden="true"/></span>
        {copy.subtitle && <span className="activity-subtitle" title={copy.subtitle}><CurrencyText text={copy.subtitle}/></span>}
      </button>
      {first.type === 'stretch_completed' && <span className="reward-chip">Above &amp; beyond</span>}
      {!compact && first.type === 'purchase' && <div className="activity-thumbs">{group.items.slice(0, 4).map(item => {const data = item.payload as {item_id?: string}; return data.item_id && <ItemThumbnail key={item.id} id={data.item_id} staticFallback fallback={<VillageIcon name="bag"/>}/>;})}</div>}
      {group.items.length > 1 && reactionCount > 0 && <span className="activity-reaction-count"><VillageIcon name="chat" size={14}/> {reactionCount}</span>}
      {!compact && group.items.length > 1 ? <details><summary>Show {group.items.length} events</summary>{group.items.map(item => {const detail = activityCopy(titled(item),name); return <div className="activity-event" data-activity-id={item.id} data-checkin-id={checkId(item)} key={item.id}>
        <button type="button" className="activity-link" onClick={() => open(item)}><span className="activity-title">{detail.title}<ChevronRight size={14} aria-hidden="true"/></span>{detail.subtitle && <span className="activity-subtitle" title={detail.subtitle}>{detail.subtitle}</span>}</button>
        <time dateTime={item.created_at}>{relativeTime(item.created_at)}</time>{evidence(item)}{reactionEligible(item) && <ReactionBar vid={vid} target_kind="activity" target_id={item.id} reactions={item.reactions}/>}</div>;})}</details> : !compact && reactionEligible(first) && <ReactionBar vid={vid} target_kind="activity" target_id={first.id} reactions={first.reactions}/>}
      {evidence(first)}
      </div></article>;
  })}</div>;
}
