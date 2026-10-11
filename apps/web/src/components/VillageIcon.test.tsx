import {expect, test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {idleActivities} from '../api/idleActivity';
import {ActivityStatus, VillageIcon, activityIcons, feedIcons, feedIcon, feedKindIcons, toastIcons, widgetIcons} from './VillageIcon';
import {ToastCard} from './Toast';

test('every idle activity has its own icon and a readable, emoji-free label', () => {
  expect(Object.keys(activityIcons).sort()).toEqual(Object.keys(idleActivities).sort());
  expect(new Set(Object.values(activityIcons)).size).toBe(9);
  for (const [key, status] of Object.entries(idleActivities)) {
    const html = renderToStaticMarkup(<ActivityStatus status={status}/>);
    expect(html).toContain(`data-icon="${activityIcons[key as keyof typeof activityIcons]}"`);
    expect(html).toContain(status);
    expect(status).not.toMatch(/\p{Extended_Pictographic}/u);
  }
});
test('all widget, feed, actor and toast mappings render the same decorative duotone grammar', () => {
  for (const name of [...Object.values(widgetIcons), ...Object.values(activityIcons), ...Object.values(feedIcons), ...Object.values(feedKindIcons), ...Object.values(toastIcons)]) {
    const html = renderToStaticMarkup(<VillageIcon name={name}/>);
    for (const attribute of ['viewBox="0 0 20 20"','stroke-width="1.75"','stroke-linecap="round"','stroke-linejoin="round"','fill-opacity=".18"','aria-hidden="true"','focusable="false"']) expect(html).toContain(attribute);
  }
  expect(Object.keys(feedKindIcons).sort()).toEqual(['agent','mayor','scheduler','system','villager']);
  for (const type of ['friend_voice','disaster_started','disaster_repaired','pets_away','xp','mayor_message','village_created','village_joined','evidence_uploaded','avatar_queued','voice_line','outbox_sent','checkin','check_in','status','goal_set','goal_completed','purchase','competition_won','badge_earned','weekly_win','level_up','agent_decision','mayor_event','event','event_completed','villagergram','debug','poke','cheer']) expect(feedIcons).toHaveProperty(type);
  expect(feedIcon('future_api_type')).toBe('chat');
  expect(feedIcon('toString')).toBe('chat');
});
test('each toast kind uses its icon without changing the announced message', () => {
  for (const kind of ['reward','success','error','info','event','disaster'] as const) {
    const html = renderToStaticMarkup(<ToastCard item={{id:kind,title:"Saved",kind,duration:0}}/>);
    expect(html).toContain(`data-icon="${toastIcons[kind]}"`);
    expect(html).toContain('Saved</strong>');
    expect(html).toContain(kind === 'error' ? 'role="alert"' : 'role="status"');
  }
});
