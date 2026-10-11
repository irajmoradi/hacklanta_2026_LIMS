import { expect, test } from 'bun:test';
import { makeFixtures } from '../api/fixtures';
import { friendSummary, socialNudges } from './friendsData';
import type { Accomplishment } from '../api/reactions';
import type { FeedItem } from '../api/types';

test('needs a cheer respects UTC day, goal progress and recent accomplishments', () => {
  const profile = Object.values(makeFixtures().profiles)[0];
  const now = new Date('2026-10-10T01:00:00Z');
  profile.check_ins = [{id:'today',user_id:profile.villager.user_id,created_at:'2026-10-10T00:01:00Z',kind:'progress',goal_id:profile.goal!.id,body:'Made progress',evidence_url:null}];
  expect(friendSummary(profile,[],now)).toMatchObject({needsCheer:false,progress:1,checkIn:{id:'today'}});
  const award: Accomplishment = {id:'award',user_id:profile.villager.user_id,display_name:'Friend',type:'goal_completed',title:'Finished',created_at:'2026-10-09T23:00:00Z',target_kind:'goal',target_id:'goal',reactions:[]};
  expect(friendSummary(profile,[award],now)).toMatchObject({needsCheer:true,justFinished:true});
  profile.check_ins[0].created_at = '2026-10-09T23:59:00Z';
  expect(friendSummary(profile,[],now).needsCheer).toBe(true);
});

test('nudges exclude history, own actions, unrelated events and previously seen activity', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const row = (id:string,type='checkin',user_id='friend',created_at='2026-10-10T11:00:00Z'): FeedItem => ({id,type,user_id,created_at,text:'Update',payload:{}});
  const feed = [row('seen'),row('new'),row('goal','goal_completed'),row('own','checkin','me'),row('old','checkin','friend','2026-10-01T00:00:00Z'),row('purchase','purchase')];
  const seen = new Set(['seen']);
  expect(socialNudges(feed,seen,'me',now).map(i=>i.id)).toEqual(['new','goal']);
  feed.forEach(i=>seen.add(i.id));
  expect(socialNudges(feed.slice(1),seen,'me',now)).toEqual([]);
});
