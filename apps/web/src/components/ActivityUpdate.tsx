import type { FeedItem, Village } from '../api/types';
import { activityCopy, classifyActivity } from './activityData';
import { EventTerms } from './EventTerms';
import { Dialog } from './shared';

export function selectedUpdate(item: FeedItem, village: Village) {
  const payload = item.payload as Record<string, unknown>;
  const eventId = payload.event_id ?? payload.mayor_event_id;
  const event = village.active_events.find(event => event.id === eventId);
  const text = (key: string) => typeof payload[key] === 'string' ? payload[key] as string : undefined;
  return { event, summaryOnly: !!eventId && !event && !text('body'), title: event?.title ?? text('title') ?? activityCopy(item, village.villagers.find(person => person.user_id === item.user_id)?.display_name).title,
    body: event?.body ?? text('body') ?? text('text') ?? classifyActivity(item).text };
}

/** A feed link opens that exact snapshot even after an event leaves active history. */
export function ActivityUpdate({ item, village, onClose }: {item: FeedItem; village: Village; onClose: () => void}) {
  const update = selectedUpdate(item, village);
  return <Dialog title={update.title} eyebrow="VILLAGE UPDATE" onClose={onClose}>
    <article data-activity-id={item.id}>
      <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
      <p style={{whiteSpace:'pre-wrap'}}>{update.body}</p>
      {update.summaryOnly && <p className="help-text">This is the saved event summary. Full terms are no longer available in the active village history.</p>}
      {update.event && <EventTerms event={update.event}/>}
    </article>
  </Dialog>;
}
