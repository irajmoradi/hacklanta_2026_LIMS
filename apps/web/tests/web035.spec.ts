import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {useDemoSeat} from './demoSeat';
useDemoSeat();
for (const [width,height] of [[390,844],[1280,720],[1600,1000]]) test(`widget identities and clean feed ${width}`,async({page})=>{
 await page.setViewportSize({width,height}); await page.goto('/');
 await expect(page.locator('.dashboard-card')).toHaveCount(3);
 await page.evaluate(async()=>{
  const {api}=await import('/src/api/client.ts' as string);
  const request=api.request.bind(api);
  const rows=['[AI Mayor] Small steps make a village.','[AI Scheduler] event: A picnic is on the calendar.','[AI Scheduler] none: Nothing due','\u{1f41e} debug: xp - synthetic test'].map((text,i)=>({id:`web035-${i}`,type:'agent_decision',user_id:null,text,payload:{},created_at:new Date().toISOString()}));
  api.request=async(method:string,path:string,body:unknown)=>method==='GET'&&path.includes('/feed?')?rows:request(method,path,body);
 });
 const feed=page.locator('.dashboard-card[data-widget=feed]');
 await expect(feed).toContainText('Mayor: Small steps', {timeout:25000});
 await expect(feed.getByTestId('activity-group')).toHaveCount(2);
 await expect(feed.getByRole('img',{name:'Mayor',exact:true})).toBeVisible();
 await expect(feed.getByRole('img',{name:'Scheduler',exact:true})).toBeVisible();
 await expect(feed).not.toContainText('[AI'); await expect(feed).not.toContainText('debug:');
 const backgrounds=await page.locator('.dashboard-card').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).backgroundColor));
 expect(new Set(backgrounds).size).toBe(3);
 await page.screenshot({animations:'disabled',path:`tests/screenshots/WEB-035/dashboard-${width}.png`});
 for(const id of ['feed','corner','goal']) {
  const card=page.locator(`.dashboard-card[data-widget=${id}]`);
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('.widget-badge')).toHaveCount(1);
  const background=await card.evaluate(el=>getComputedStyle(el).backgroundColor);
  await card.getByRole('button',{name:/^Pop out/}).click();
  const popup=page.locator('.widget-popout');
  await expect(popup).toHaveCSS('background-color',background);
  await popup.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished)); });
  if(id==='corner') {
   expect((await popup.innerText()).match(/Level \d+/g)).toHaveLength(1);
   await expect(popup.locator('.streak-ring')).toBeVisible();
   await expect(popup.locator('.wallet-balances')).toContainText('SOL');
  }
  const audit=await new AxeBuilder({page}).include('.widget-popout').withRules(['color-contrast']).analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({animations:'disabled',path:`tests/screenshots/WEB-035/${id}-${width}.png`});
  await popup.getByRole('button',{name:/^Minimize/}).click(); await expect(popup).toHaveCount(0);
 }
 await page.getByRole('button',{name:'Collapse dashboard'}).click();
 await page.getByRole('button',{name:'Reopen dashboard'}).click();
 await expect(page.locator('.dashboard-card')).toHaveCount(3);
});
