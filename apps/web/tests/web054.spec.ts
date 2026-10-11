import {test,expect} from '@playwright/test';
import {useDemoSeat} from './demoSeat';
useDemoSeat();

// Extend only the browser's in-memory mock API. No live API or provider requests.
const seed = String.raw`
const originalFeed = api.feed.bind(api), originalProfile = api.profile.bind(api), originalRequest = api.request.bind(api);
const longNote = 'I built a little library for the village and filled it with stories, notes, and photos. '.repeat(5);
api.profile = async (vid,uid) => {
 const p = await originalProfile(vid,uid);
 return {...p,check_ins:[{id:'web054-check',user_id:uid,created_at:new Date().toISOString(),kind:'progress',goal_id:p.goal?.id,body:longNote,evidence_url:'/api/assets/arena-demo-evidence.svg'},...p.check_ins]};
};
api.request = async (method,path,body) => {
 if(api.mode!=='mock') throw new Error('WEB-054 requires mock mode');
 if(method==='GET' && path.includes('/reading?')) return {week_start:'2026-10-05',read_only:true,awarded_count:0,items:[{id:'web054-book',title:'A small book about big ideas',author:'A neighbor',link:'',why:longNote,user_id:null,readers:[]}]};
 if(method==='GET' && path==='/voice/lines/web054-line') return {audio_url:'/api/assets/web054.wav'};
 if(method==='GET' && path==='/assets/web054.wav') {
  const buffer=new ArrayBuffer(1644),v=new DataView(buffer);const text=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};text(0,'RIFF');v.setUint32(4,1636,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,1600,true);return new Blob([buffer],{type:'audio/wav'});
 }
 return originalRequest(method,path,body);
};
api.feed = async vid => {
 const town=await api.village(vid), people=town.villagers, uid=people[1].user_id;
 const competitions=await api.competitions(vid), competition=await api.competition(vid,competitions[1].id);
 const profile=await originalProfile(vid,uid);
 const row=(id,type,payload,user=uid)=>({id,type,payload,user_id:user,text:payload.text ?? people.find(p=>p.user_id===user)?.display_name+' shared an update',created_at:new Date().toISOString()});
 return [
 row('web054-voice','friend_voice',{line_id:'web054-line',text:'Maya made your villager say: '+longNote}),
 row('web054-check-event','checkin',{check_in_id:'web054-check',body:longNote,evidence_asset_id:'arena-demo-evidence.svg'}),
 row('web054-entry','competition_entry_submitted',{competition_id:competition.id,entry_id:competition.entries[1].id,title:competition.title}),
 row('web054-purchase1','purchase',{item_id:'village_cap',name:'Village Cap'}),
 row('web054-purchase2','purchase',{item_id:'goat_kid',name:'Goat Kid'}),
 row('web054-goal','goal_set',{goal_id:profile.goal?.id,title:profile.goal?.title ?? 'A small goal'}),
 row('web054-book-event','reading_completed',{item_id:'web054-book',week_start:'2026-10-05',title:'A small book about big ideas'}),
 row('web054-house','house_updated',{}),
 row('web054-future','future_event',{body:longNote}),
 ];
};
`;
test.beforeEach(async({page})=>{
 await page.route('**/src/api/client.ts',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\n'+seed});});
 await page.route(/\.(glb|gltf|zip|splat)(\?.*)?$/,route=>route.abort());
 await page.emulateMedia({reducedMotion:'reduce'});
});
for(const width of [1440,390]) test(`readable feed and exact destinations at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/?quality=low');
 await expect(page.locator('.dashboard')).toBeVisible();
 await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();
 const panel=page.locator('.widget-popout');
 await expect(panel.locator('.activity-title').first()).toHaveText('Maya made your villager say something!');
 await expect(panel.getByRole('button',{name:'See their accomplishments',exact:true})).toHaveCount(0);
 await expect(panel.locator('.activity-evidence img').first()).toBeVisible();
 const subtitles=panel.locator('.activity-subtitle');
 expect(await subtitles.first().getAttribute('title')).toContain('I built a little library');
 expect(await subtitles.first().evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 expect(await panel.locator('.activity-title').first().evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
 expect(await panel.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})).toBe(true);
 await panel.screenshot({path:`tests/artifacts/web054/feed-${width}.png`});
 const link=panel.locator('[data-activity-id="web054-check-event"] > .activity-content > .activity-link');
 await link.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('tab',{name:'Activity',exact:true})).toHaveAttribute('aria-selected','true');
 const check=page.locator('.profile-panel [data-activity-id="web054-check-event"]');
 await expect(check).toHaveClass(/activity-destination/);await expect(check.locator('img').last()).toBeVisible();
 await page.locator('.profile-panel').screenshot({path:`tests/artifacts/web054/checkin-${width}.png`});
 await page.getByRole('button',{name:'Close profile',exact:true}).click();
 await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();
 await panel.locator('[data-activity-id="web054-entry"] .activity-link').click();
 await expect(page.getByRole('complementary',{name:'Participant evidence',exact:true})).toBeVisible();
 await expect(page.locator('.arena-evidence.activity-destination')).toContainText('Progress submitted for review.');
 await expect(page.locator('.arena-evidence.activity-destination img')).toBeVisible();
 await page.screenshot({path:`tests/artifacts/web054/entry-${width}.png`});
 await page.getByRole('button',{name:'← Village',exact:true}).click();
 await expect(page.locator('dialog.arena-modal[open]')).toHaveCount(0);
 await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();
 await panel.locator('[data-activity-id="web054-book-event"] .activity-link').click();
 await expect(page.locator('.reading-card.activity-destination')).toContainText('A small book about big ideas');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();
 await panel.locator('[data-activity-id="web054-voice"] .activity-link').click();
 await expect(page.locator('audio[controls]')).toBeVisible();
 await expect(page.locator('audio')).toHaveAttribute('src',/^blob:/);
});

test('grouped items retain individual destinations, goal and fallback links',async({page})=>{
 await page.goto('/?quality=low');await expect(page.locator('.dashboard')).toBeVisible();
 await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();
 const panel=page.locator('.widget-popout'), group=panel.locator('article[data-activity-id="web054-purchase1"]');
 await expect(group.locator('.activity-title').first()).toContainText('bought 2 things');
 await group.locator('summary').click();
 await expect(group.locator('.activity-event .activity-link')).toHaveCount(2);
 await group.locator('.activity-event').first().locator('.activity-link').click();
 await expect(page.locator('dialog[open]')).toContainText('Village Cap');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();
 await panel.locator('[data-activity-id="web054-goal"] .activity-link').click();
 await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.profile-section.activity-destination')).toContainText('THIS WEEK');
 await page.getByRole('button',{name:'Close profile',exact:true}).click();
 await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();
 await panel.locator('[data-activity-id="web054-future"] .activity-link').click();
 await expect(page.locator('.profile-panel')).toBeVisible();
});
