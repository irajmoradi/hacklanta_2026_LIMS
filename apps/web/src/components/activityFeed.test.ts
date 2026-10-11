import {expect, test} from 'bun:test';
import {classifyActivity, activityName, groupActivity, reactionEligible, visibleActivity, cleanVillager, groupLabel} from './activityData';
import type {FeedItem} from '../api/types';
const event = (id: string, type = 'purchase', user = 'a', date = '2026-10-10T12:00:00Z'): FeedItem => ({id,type,user_id:user,created_at:date,text:'Stefanny bought Goat Kid.',payload:{name:'Goat Kid'}});

test('legacy agents have readable labels, normalized copy and distinct identities', () => {
 for (const [prefix, kind, label] of [['Mayor','mayor','Mayor'],['Scheduler','scheduler','Scheduler'],['Helper','agent','Helper']]) {
  const item = {...event(prefix,'agent_decision'), user_id:null, text:` • [AI ${prefix}]: • A new week begins.`};
  expect(classifyActivity(item)).toMatchObject({kind,label,text:'A new week begins.',debug:false,noop:false});
  expect(activityName(item)).toBe(label);
  expect(groupLabel({id:item.id,items:[item]},label)).toBe(`${label}: A new week begins.`);
 }
 expect(classifyActivity({...event('system'),user_id:null,text:'Festival starts today'}).kind).toBe('system');
 expect(classifyActivity(event('person')).kind).toBe('villager');
});

test('ordinary feeds hide debug and scheduler no-ops but retain meaningful scheduler decisions', () => {
 const hidden = [
  {...event('noop','agent_decision'),text:'[AI Scheduler] none: Nothing due'},
  {...event('case','agent_decision'),text:'[AI scheduler]: NONE: Nothing due'},
  {...event('debug','debug'),text:'Added XP'},
  {...event('legacy'),text:'🐞 debug: xp - testing'},
 ];
 for (const item of hidden) { expect(visibleActivity(item)).toBe(false); expect(visibleActivity(item,true)).toBe(true); }
 expect(groupActivity(hidden)).toEqual([]);
 expect(groupActivity(hidden,true).flatMap(g=>g.items)).toHaveLength(4);
 expect(visibleActivity({...event('scheduled'),text:'[AI Scheduler] event: Festival starts today'})).toBe(true);
 expect(visibleActivity({...event('human'),text:'Stefanny checked in: none: of my plans changed'})).toBe(true);
});
test('groups only consecutive same-person/type/UTC-day events, without mutation', () => {
 const rows = [event('1'),event('2'),event('3','purchase','b'),event('4'),event('5','goal_set'),event('6','purchase','a','2026-10-09T23:59:00Z')];
 expect(groupActivity(rows).map(g => g.items.length)).toEqual([2,1,1,1,1]);
 expect(rows).toHaveLength(6);
 expect(groupLabel(groupActivity(rows)[0], 'Stefanny', new Date('2026-10-10'))).toBe('Stefanny bought 2 things today: Goat Kid, Goat Kid');
});
test('reactions require meaningful events or evidence, never purchases/equips/settings', () => {
 for (const type of ['goal_set','goal_completed','competition_won','weekly_win','badge_earned','level_up']) expect(reactionEligible(event('x',type))).toBe(true);
 for (const type of ['purchase','equip','settings','checkin']) expect(reactionEligible(event('x',type))).toBe(false);
 expect(reactionEligible({...event('x','checkin'),payload:{has_evidence:true}})).toBe(true);
 expect(reactionEligible({...event('x','purchase'),payload:{has_evidence:true}})).toBe(false);
});
test('QA body, status and legacy prefixed text disappear', () => {
 for (const item of [{...event('x','checkin'),payload:{body:' QA-test'}},{...event('y','checkin'),text:'Stefanny checked in: QA-test'},{...event('z'),text:'QA-status'}]) {
  expect(visibleActivity(item)).toBe(false); expect(groupActivity([item])).toEqual([]);
 }
 expect(cleanVillager({status_line:'QA-testing'}).status_line).toBeNull();
 expect(cleanVillager({status_line:'A good day'}).status_line).toBe('A good day');
});
import {activityActions, activityCopy, activityTarget, groupCopy} from './activityData';
import {feedIcons} from './VillageIcon';

test('all known event types have short titles and preserve the full detail as subtitle', () => {
 const system = ['mayor_event','mayor_message','event','event_completed','disaster_started','disaster_repaired','pets_away','gazette','gazette_published','weekly_recap','debug','agent_decision'];
 for (const type of new Set([...Object.keys(activityActions),...Object.keys(feedIcons),...system])) {
  const detail = 'A detailed note '.repeat(50);
  const row = {...event(type,type),text:detail,payload:{body:detail}};
  const copy = activityCopy(row,'Maya');
  expect(copy.title.length).toBeLessThan(70);
  expect(copy.title).not.toContain(detail);
  expect(copy.subtitle).toBe(detail);
 }
 expect(activityCopy({...event('voice','friend_voice'),text:'Maya made your villager say: Hello there!',payload:{text:'Maya made your villager say: Hello there!'}},'Iraj')).toEqual({title:'Maya made your villager say something!',subtitle:'Hello there!'});
 expect(activityCopy({...event('unknown','new_event'),payload:{body:'Future detail'}},'Maya')).toEqual({title:'Maya shared an update',subtitle:'Future detail'});
 expect(activityCopy(event('safe','toString'),'Maya').title).toBe('Maya shared an update');
 expect(groupCopy({id:'group',items:[event('one'),event('two')]},'Lance')).toEqual({title:'Lance bought 2 things',subtitle:'Goat Kid'});
 expect(activityCopy({...event('text','outbox_sent'),text:'Mario received a Mayor text',payload:{}},'Mario').subtitle).toBe('');
});

test('structured payload IDs select the exact destination with profile fallbacks', () => {
 const cases: [string,object,object][] = [
  ['competition_entry_submitted',{competition_id:'c',entry_id:'e'},{kind:'competition',id:'c',entryId:'e'}],
  ['competition_entry_decided',{competition_id:'c',entry_id:'other'},{kind:'competition',id:'c',entryId:'other'}],
  ['competition_won',{competition_id:'c'},{kind:'competition',id:'c'}],
  ...['checkin','check_in','progress','status','evidence_uploaded','evidence_reviewed'].map(type => [type,{check_in_id:'check'},{kind:'activity',userId:'a',id:'check',eventId:'row'}] as [string,object,object]),
  ...['goal_set','goal_completed','stretch_completed'].map(type => [type,{goal_id:'goal'},{kind:'goal',userId:'a',id:'goal'}] as [string,object,object]),
  ['purchase',{item_id:'goat'},{kind:'shop',id:'goat'}],
  ['house_updated',{owner_id:'b'},{kind:'house',userId:'b'}],
  ['furniture_added',{}, {kind:'house',userId:'a'}],
  ['hall_item_added',{}, {kind:'hall'}],
  ['friend_voice',{line_id:'line'},{kind:'media',media:'line',id:'line'}],
  ['voice_line',{voice_line_id:'line'},{kind:'media',media:'line',id:'line'}],
  ['villagergram',{gram_id:'gram'},{kind:'media',media:'gram',id:'gram'}],
  ['reading_completed',{item_id:'book',week_start:'2026-10-05'},{kind:'reading',id:'book',week:'2026-10-05'}],
  ['mayor_event',{}, {kind:'mayor'}], ['gazette_published',{}, {kind:'gazette'}],
  ['disaster_started',{}, {kind:'alerts'}], ['disaster_repaired',{}, {kind:'alerts'}],
  ['purchase',{item_id:3},{kind:'profile',userId:'a'}],
  ['competition_entry_submitted',{}, {kind:'profile',userId:'a'}],
  ['new_event',{url:'javascript:alert(1)'},{kind:'profile',userId:'a'}],
 ];
 for (const [type,payload,target] of cases) expect(activityTarget({...event('row',type),payload})).toMatchObject(target);
 expect(activityTarget({...event('no-user','unknown'),user_id:null})).toEqual({kind:'mayor'});
});


test('QA15-03 Mayor text has one human title even without roster lookup', () => {
  const item = {id:'text',user_id:'iraj',type:'outbox_sent',text:'Iraj received a Mayor text.',payload:{},created_at:'2026-10-11T00:00:00Z'};
  expect(activityCopy(item).title).toBe('Iraj received a Mayor text');
});
