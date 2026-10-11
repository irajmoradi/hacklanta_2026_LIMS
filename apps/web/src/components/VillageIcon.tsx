import type { IdleActivity } from '../api/types';
import { idleActivities } from '../api/idleActivity';

// Original 20px drawings. The first path is a tinted silhouette, the second
// supplies the rounded ink lines; currentColor lets each surface own its accent.
const drawings = {
  crown: ['m3 5 4 4 3-6 3 6 4-4-1 11H4Z', 'm3 5 4 4 3-6 3 6 4-4-1 11H4ZM4 13h12'],
  hat: ['M5 14 4 4Q10 2 16 4L15 14Z', 'M5 14 4 4Q10 2 16 4L15 14M5 11h10M2 14q8 4 16 0'],
  paper: ['M4 3h9l4 4v10H4Z', 'M4 3h9l4 4v10H4ZM13 3v5h4M7 10h6M7 13h6'],
  chat: ['M3 4h14v10H8l-5 3Z', 'M3 4h14v10H8l-5 3ZM6 9h.1M10 9h.1M14 9h.1'],
  sprout: ['M10 11Q3 12 3 5q7 0 7 6M10 8q0-6 7-5 0 6-7 5', 'M10 17V8M10 11Q3 12 3 5q7 0 7 6M10 8q0-6 7-5 0 6-7 5M6 17h8'],
  flag: ['M5 3q4-2 7 0t5 0v8q-3 2-5 0t-7 0Z', 'M5 18V3q4-2 7 0t5 0v8q-3 2-5 0t-7 0'],
  trowel: ['M9 9l4 4-6 4-4-1 1-4Z', 'm9 9 4 4-6 4-4-1 1-4Zm2 2 4-4M13 5l2-2 3 3-2 2Z'],
  music: ['M8 4l8-2v5L8 9Z', 'M8 14V4l8-2v10M8 7l8-2M8 14c0 4-6 4-6 1 0-2 4-3 6-1M16 12c0 4-6 4-6 1 0-2 4-3 6-1'],
  book: ['M10 5Q6 2 2 4v12q4-2 8 1 4-3 8-1V4q-4-2-8 1', 'M10 5Q6 2 2 4v12q4-2 8 1 4-3 8-1V4q-4-2-8 1v12'],
  house: ['M3 9l7-6 7 6v8H3Z', 'm2 10 8-7 8 7M4 9v8h12V9M8 17v-5h4v5'],
  food: ['M13 6c0-5 5-5 5 0s-5 5-5 0', 'M5 3v14M2 3v4q3 3 6 0V3M15.5 10v7M13 6c0-5 5-5 5 0s-5 5-5 0'],
  paw: ['M6 12q4-7 8 0c6 6-3 5-4 4-2 1-10 2-4-4', 'M6 12q4-7 8 0c6 6-3 5-4 4-2 1-10 2-4-4ZM4 7v1M8 3v2M12 3v2M16 7v1'],
  dumbbell: ['M3 5h4v10H3ZM13 5h4v10h-4Z', 'M3 5h4v10H3ZM13 5h4v10h-4ZM7 10h6M1 8v4M19 8v4'],
  game: ['M5 6h10q3 0 3 9l-2 1-3-3H7l-3 3-2-1Q2 6 5 6', 'M5 6h10q3 0 3 9l-2 1-3-3H7l-3 3-2-1Q2 6 5 6ZM6 8v4M4 10h4M13 9h.1M15 11h.1'],
  lamp: ['m10 3 6 2-1 6-8-5Z', 'm10 3 6 2-1 6-8-5ZM8 6 4 11l5 6M5 17h9M12 11l-1 2'],
  bell: ['M5 8q0-7 10 0v5l2 2H3l2-2Z', 'M5 8q0-7 10 0v5l2 2H3l2-2ZM8 18h4M10 2v1'],
  check: ['M3 3h14v14H3Z', 'm5 10 3 3 7-7'],
  warning: ['m10 2 8 15H2Z', 'm10 2 8 15H2ZM10 7v4M10 14h.1'],
  info: ['M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16', 'M10 9v5M10 6h.1'],
  bag: ['M4 6h12l1 11H3Z', 'M4 6h12l1 11H3ZM7 7V5a3 3 0 0 1 6 0v2'],
  star: ['m10 2 2.5 5 5.5 1-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1Z', 'm10 2 2.5 5 5.5 1-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1Z'],
  clock: ['M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16', 'M10 5v5l4 2'],
  sun: ['M10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M10 1v2M10 17v2M1 10h2M17 10h2M4 4l1 1M15 15l1 1M4 16l1-1M15 5l1-1'],
  camera: ['M2 6h4l1-3h6l1 3h4v11H2Z', 'M2 6h4l1-3h6l1 3h4v11H2ZM10 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  lock: ['M4 9h12v8H4Z', 'M4 9h12v8H4ZM6 9V6a4 4 0 0 1 8 0v3M10 12v2'],
  walk: ['M11 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3', 'm6 10 3-3 3 1 2 3h3M10 8l-2 5-4 4M8 13l5 1v4'],
  cup: ['M3 7h11v7q-5 6-11 0Z', 'M3 7h11v7q-5 6-11 0ZM14 8h2q4 3-2 5M6 2v2M10 2v2'],
} as const;
export type VillageIconName = keyof typeof drawings;
export function VillageIcon({name, size = 20, className = ''}: {name: VillageIconName; size?: number; className?: string}) {
  const [fill, ink] = drawings[name];
  return <svg className={`village-icon ${className}`} data-icon={name} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false" style={{flexShrink:0, verticalAlign:'middle'}}>
    <path d={fill} fill="currentColor" fillOpacity=".18"/>
    <path d={ink} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
export const widgetIcons = {feed:'chat', corner:'sprout', mayor:'hat', gazette:'paper', goal:'flag'} as const;
export const activityIcons = {gardening:'trowel', dancing:'music', reading:'book', home:'house', food:'food', walk_pet:'paw', working_out:'dumbbell', gaming:'game', studying:'lamp'} satisfies Record<IdleActivity, VillageIconName>;
export const feedIcons = {
  friend_voice:'chat', disaster_started:'warning', disaster_repaired:'check', pets_away:'paw', xp:'sprout', mayor_message:'hat',
  village_created:'house', village_joined:'house', evidence_uploaded:'camera', avatar_queued:'camera', voice_line:'chat', outbox_sent:'paper',
  checkin:'check', check_in:'check', status:'chat', goal_set:'flag', goal_completed:'star', purchase:'bag', competition_won:'star', badge_earned:'star', weekly_win:'star', level_up:'sprout', agent_decision:'hat', mayor_event:'hat', event:'bell', event_completed:'check', villagergram:'chat', debug:'info', poke:'chat', cheer:'star'} satisfies Record<string, VillageIconName>;
export const feedKindIcons = {mayor:'hat', scheduler:'clock', agent:'lamp', system:'sprout', villager:'chat'} as const;
// The feed contract permits new type strings; unknown types retain a neutral icon.
export const feedIcon = (type: string): VillageIconName => Object.hasOwn(feedIcons, type) ? feedIcons[type as keyof typeof feedIcons] : 'chat';
export const toastIcons = {reward:'sprout', success:'check', error:'warning', info:'info', event:'bell', disaster:'warning'} as const;
export type ToastKind = keyof typeof toastIcons;
export function ActivityStatus({status}: {status: string}) {
  const activity = (Object.keys(idleActivities) as IdleActivity[]).find(key => idleActivities[key] === status);
  const name = activity ? activityIcons[activity] : /caf[eé]|sip/i.test(status) ? 'cup' : /walk|mov/i.test(status) ? 'walk' : /mayor/i.test(status) ? 'hat' : 'chat';
  return <><VillageIcon name={name} size={12}/> {status}</>;
}
