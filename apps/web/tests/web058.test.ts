import { expect, test } from 'bun:test';
import { orderCompetitions, emptyCompetition } from '../src/components/competitionOrder';
import { badgeLabel } from '../src/components/badgeLabel';
import { dashboardCollapsedOnBoot, debugProbeEnabled } from '../src/components/chromePreferences';
import { normalizeGazetteCopy } from '../src/api/gazetteCopy';
import { normalizeIssue } from '../src/api/gazette';
import { selectedUpdate } from '../src/components/ActivityUpdate';
import { makeFixtures } from '../src/api/fixtures';
import { labelOffset, labelsOverlap, type LabelRect } from '../src/scene/labelPlacement';
import type { CompetitionDetail, FeedItem } from '../src/api/types';

test('QA14-03 participation, useful titles, recency; never delete or mutate rows', () => {
  const make = (id: string, title: string, date: string, people = 0, entries = 0) => ({id, title, created_at:date, participants:Array(people).fill({user_id:'u'}), entries:Array(entries).fill({id:'e'})} as CompetitionDetail);
  const rows = [make('h','h','2026-10-11'), make('hi','hi','2026-10-10'), make('old','Reading sprint','2026-10-08',1), make('new','Study streak','2026-10-09',1), make('empty','Walking goal','2026-10-11'), make('entry','Art challenge','2026-10-10',0,1)];
  const ordered = orderCompetitions(rows, Object.fromEntries(rows.map(c => [c.id,c])));
  expect(ordered.map(c => c.id)).toEqual(['entry','new','old','empty','h','hi']);
  expect(rows[0].id).toBe('h'); expect(ordered).toHaveLength(rows.length);
  expect(emptyCompetition(rows[0])).toBe(true); expect(emptyCompetition(rows[2])).toBe(false); expect(emptyCompetition(undefined)).toBe(false);
});
test('QA14-04/10 phones boot collapsed; desktop retains preference; debug is opt-in', () => {
  expect(dashboardCollapsedOnBoot(false,true)).toBe(true);
  expect(dashboardCollapsedOnBoot(false,false)).toBe(false);
  expect(dashboardCollapsedOnBoot(true,false)).toBe(true);
  for (const value of [undefined,'0','false',true]) expect(debugProbeEnabled(value)).toBe(false);
  expect(debugProbeEnabled('1')).toBe(true);
});
test('QA14-05/10 even sparse labels avoid signs and fixed controls or hide', () => {
  const bounds = {left:0,right:390,top:0,bottom:844};
  const occupied: LabelRect[] = [{left:0,right:390,top:0,bottom:210}, {left:0,right:390,top:710,bottom:844}];
  for (let i = 0; i < 10; i++) {
    const base = {left:130,right:270,top:360,bottom:396};
    const offset = labelOffset(base,bounds,occupied,40);
    if (offset === null) continue;
    const placed = {...base,top:base.top+offset,bottom:base.bottom+offset};
    expect(occupied.some(other => labelsOverlap(placed,other))).toBe(false); occupied.push(placed);
  }
  expect(labelOffset({left:100,right:200,top:300,bottom:350},bounds,[bounds])).toBeNull();
});
test('QA14-06 stored prose is repaired without title-casing weather or corrupting links', () => {
  const text = "Hello everyone.iraj is here!Welcome. It'S What'S We'Ll We’Re";
  expect(normalizeGazetteCopy(text)).toBe("Hello everyone. Iraj is here! Welcome. It's What's We'll We’re");
  const protectedText = 'https://example.org/a.b iraj@example.com example.com 3.14 U.S. Dr. Smith';
  expect(normalizeGazetteCopy(protectedText)).toBe(protectedText);
  const raw = {id:'i',village_id:'v',created_at:'2026-10-11',content:{headline:text,body:text,weather:"It's cloudy. We'll be fine.",stories:[{text}],gossip:{text}}};
  const issue = normalizeIssue(raw)!;
  expect(issue.weather).toBe("It's cloudy. We'll be fine.");
  expect(issue.body).toContain('everyone. Iraj'); expect(issue.stories[0].body).toBe(issue.body);
  expect(normalizeIssue(issue)).toEqual(issue); expect(raw.content.body).toBe(text);
});
test('QA14-07 badge has a human name and timezone-stable date', () => {
  expect(badgeLabel('star','2026-09-28')).toBe('Weekly completion star · Sep 28, 2026');
});
test('QA14-11 selected event resolves by ID, and expired updates retain their snapshot', () => {
  const village = makeFixtures().village;
  const item: FeedItem = {id:'feed',type:'mayor_event',user_id:null,created_at:'2026-10-11',text:'Fallback text',payload:{event_id:'target',title:'Saved title',body:'Saved body'}};
  village.active_events = [{id:'other',title:'Wrong event'},{id:'target',title:'Selected event',body:'Selected terms'}] as typeof village.active_events;
  expect(selectedUpdate(item,village).body).toBe('Selected terms');
  village.active_events=[];
  expect(selectedUpdate(item,village)).toMatchObject({title:'Saved title',body:'Saved body'});
});


test('QA15-03 selected notification uses its roster name and one title', () => {
  const village=makeFixtures().village;
  const person=village.villagers[0];
  const item: FeedItem={id:'notification', user_id:person.user_id,type:'outbox_sent',text:`${person.display_name} received a Mayor text.`,payload:{},created_at:'2026-10-11T00:00:00Z'};
  expect(selectedUpdate(item,village).title).toBe(`${person.display_name} received a Mayor text`);
});
