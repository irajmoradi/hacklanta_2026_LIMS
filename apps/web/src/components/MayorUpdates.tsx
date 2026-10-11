import type { FeedItem, Village } from '../api/types';
import { classifyActivity, visibleActivity } from './activityData';
import { CurrencyText } from './Currency';

/** Existing event and feed data only; opening updates never generates content. */
export function MayorUpdates({ village, feed }: { village: Village; feed: FeedItem[] }) {
  const events = [...village.active_events].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const notes = feed.filter(item => visibleActivity(item) && (classifyActivity(item).kind === 'mayor' || (!item.user_id && item.type !== 'agent_decision' && classifyActivity(item).kind === 'system')));
  return <section aria-label="Mayor updates" className="mayor-updates">
    <h3>Mayor updates</h3>
    {!events.length && !notes.length && <p>No Mayor notes yet; post a check-in while you wait.</p>}
    <h4>Available Mayor history</h4>
    {events.map(event => <article key={event.id}><h4>{event.title}</h4><p><CurrencyText text={event.body}/></p></article>)}
    {notes.map(note => <article key={note.id}><time dateTime={note.created_at}>{new Date(note.created_at).toLocaleString()}</time><p><CurrencyText text={classifyActivity(note).text}/></p></article>)}
  </section>;
}
