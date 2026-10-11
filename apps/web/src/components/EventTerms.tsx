import { CurrencyText } from './Currency';
import type { MayorEvent } from '../api/types';

export function EventTerms({ event }: { event: MayorEvent }) {
  if (!event.tier && event.kind !== 'challenge') return null;
  const min = event.reward_xp_min ?? event.reward_xp, max = event.reward_xp_max ?? event.reward_xp;
  return <dl className="event-terms">{event.tier && <div><dt>Tier</dt><dd>{event.tier}</dd></div>}{event.effort_hours != null && <div><dt>Effort</dt><dd>{event.effort_hours} hours</dd></div>}<div><dt>{min === max ? 'Reward' : 'Reward range'}</dt><dd><CurrencyText text={`${min === max ? min : `${min}–${max}`} XP`} /> + <CurrencyText text={`${min === max ? min : `${min}–${max}`} coins`} /></dd></div><div><dt>If missed</dt><dd>{event.repairs_event_id ? 'Repair stays open; late help still counts' : ['challenge','random_event'].includes(event.kind) ? 'A recoverable village disaster' : event.penalty ?? 'No penalty'}</dd>{event.penalty && <dd>Recovery: {event.recovery ?? 'Recovery details not supplied by the Mayor yet.'}</dd>}</div></dl>;
}
