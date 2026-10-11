import {test,expect,type Page} from '@playwright/test';
import {useDemoSeat} from './demoSeat';
import type {ToastInput} from '../src/components/toastStore';
useDemoSeat();
test.beforeEach(async ({page}) => {
  page.on('pageerror', error => { throw error; });
});
async function notify(page:Page,input:ToastInput) {
  await page.evaluate(async input=>{const path='/src/components/toastStore.ts';const {toast}=await import(path);toast(input);},input);
}
async function clear(page:Page) {
  await page.evaluate(async()=>{const path='/src/components/toastStore.ts';(await import(path)).toastStore.clear();});
}
async function noOverlap(page:Page) {
  const cards=page.locator('.village-toast');await expect(cards.first()).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{
    const obstacles=Array.from(document.querySelectorAll<HTMLElement>('.profile-panel,.dashboard:not(.is-collapsed),.action-dock,.widget-popout,dialog[open],.topbar,.alerts-dropdown')).filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect());
    return Array.from(document.querySelectorAll('.village-toast')).every(el=>{const a=el.getBoundingClientRect();return a.left>=0&&a.right<=innerWidth&&a.top>=0&&a.bottom<=innerHeight&&obstacles.every(b=>a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);});
  })).toBe(true);
}
for(const [width,height] of [[1280,720],[1600,900],[390,844]])test(`notifications avoid panels at ${width}`,async({page})=>{
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await expect(page.locator('.dashboard')).toBeVisible();
  await page.getByRole('button',{name:'My profile',exact:true}).click();await expect(page.locator('.profile-panel')).toBeVisible();
  for(let i=0;i<4;i++)await notify(page,{title:`Saved ${i}`,duration:0});
  await noOverlap(page);expect(await page.locator('.village-toast').count()).toBeLessThanOrEqual(3);
  await page.screenshot({path:`tests/artifacts/web034/profile-${width}.png`});
  await clear(page);await notify(page,{title:'Rebuilt. Everyone is home.',variant:'moment',icon:'🏡',duration:0});await noOverlap(page);
  await page.screenshot({path:`tests/artifacts/web034/repair-${width}.png`});
  await clear(page);await page.getByRole('button',{name:'Close profile',exact:true}).click();
  if(width===390)await page.getByRole('button',{name:'Collapse dashboard',exact:true}).click();
  const badge=page.getByRole('button',{name:/Alerts, \d+ active/});
  if(await badge.getAttribute('aria-expanded')!=='true')await badge.click();
  await notify(page,{kind:'info',title:'Alerts are up to date',duration:0});await noOverlap(page);
  await expect(page.getByRole('region',{name:'Village alerts'})).toBeVisible();
  await page.screenshot({path:`tests/artifacts/web034/alerts-${width}.png`});
  await clear(page);await page.getByRole('button',{name:'Minimize alerts',exact:true}).click();
  if(width===390)await page.getByRole('button',{name:'Reopen dashboard',exact:true}).click();
  await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();
  await notify(page,{kind:'info',title:'Your village is up to date',duration:0});await noOverlap(page);
  await page.screenshot({path:`tests/artifacts/web034/widget-${width}.png`});
  await clear(page);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Check in',exact:true}).last().click();
  await notify(page,{kind:'error',title:'Could not connect',detail:'Your note is safe. Please try again.'});await noOverlap(page);
  await expect(page.locator('dialog[open] .toast-viewport')).toHaveCount(1);
  await page.screenshot({path:`tests/artifacts/web034/dialog-${width}.png`});
  await page.getByRole('button',{name:'Dismiss Could not connect',exact:true}).click();await expect(page.locator('.village-toast')).toHaveCount(0);
});

test('each kind, actions, accessible announcements and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('.dashboard')).toBeVisible();
  const examples:ToastInput[]=[
    {kind:'success',title:'Your outfit is updated',detail:'Ready for a walk around the village.'},
    {kind:'reward',title:'+25 XP',amount:25,currency:'coins',detail:'Check-in saved.'},
    {kind:'reward',title:'Weekly reward',amount:3,currency:'diamonds'},
    {kind:'event',title:'Movie night',detail:'Meet your neighbors at the plaza.',icon:'🎬'},
    {kind:'disaster',title:'Storm blackout',detail:'Check in together to bring the lights back.',icon:'🌩️'},
    {kind:'error',title:'The village could not refresh',detail:'Your check-in was saved.'},
    {kind:'info',title:'Reconnecting…',detail:'Trying to reconnect to the village.'},
    {kind:'success',title:'Level 5',detail:'Look how far you have grown.',variant:'moment',icon:'🌱'},
    {kind:'success',title:'The weekly crown is yours',variant:'moment',icon:'👑'},
  ];
  for(const [i,input] of examples.entries()) {
    await clear(page);await notify(page,input);const card=page.locator('.village-toast');await expect(card).toBeVisible();await card.hover();
    await expect(card.locator('[aria-live]')).toHaveAttribute('aria-live',input.kind==='error'?'assertive':'polite');
    await expect(card).toHaveCSS('animation-name','none');
    await card.screenshot({path:`tests/artifacts/web034/kind-${i}-${input.kind}.png`});
  }
  await clear(page);
  await page.evaluate(async()=>{const path='/src/components/toastStore.ts';const {toast}=await import(path);toast({kind:'error',title:'Try again',action:{label:'Retry',onClick:()=>{document.body.dataset.retried='yes';}}});});
  const retry=page.getByRole('button',{name:'Retry',exact:true});await retry.focus();await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-retried','yes');await expect(page.locator('.village-toast')).toHaveCount(0);
});

test('queue, timeouts, persistent errors, hover pause and reconnect deduplication',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('.dashboard')).toBeVisible();
  const pausedAt = Date.now();await page.clock.install({time:new Date(pausedAt-60000)});await page.clock.pauseAt(new Date(pausedAt));
  await notify(page,{title:'Auto dismiss'});await expect(page.locator('.village-toast')).toBeVisible();
  await page.locator('.village-toast').hover();await page.clock.fastForward(4300);await expect(page.locator('.village-toast')).toBeVisible();
  await page.locator('.toast-close').focus();await page.mouse.move(1,1);await page.clock.fastForward(4300);await expect(page.locator('.village-toast')).toBeVisible();
  await page.locator('.toast-close').evaluate(el=>(el as HTMLElement).blur());await page.clock.fastForward(4300);await page.clock.runFor(200);await expect(page.locator('.village-toast')).toHaveCount(0);
  await notify(page,{title:'Short moment',variant:'moment'});await expect(page.locator('.toast-moment')).toBeVisible();await page.clock.fastForward(2700);await page.clock.runFor(200);await expect(page.locator('.village-toast')).toHaveCount(0);
  await notify(page,{kind:'error',title:'Persistent'});await page.clock.fastForward(10000);await expect(page.getByRole('alert')).toContainText('Persistent');
  await clear(page);for(let i=0;i<5;i++)await notify(page,{title:`Queued ${i}`,duration:0});
  await expect(page.locator('.village-toast')).toHaveCount(3);await expect(page.locator('.village-toast').first()).toContainText('Queued 4');
  await page.getByRole('button',{name:'Dismiss Queued 4'}).click();await page.clock.runFor(200);await expect(page.locator('.village-toast').last()).toContainText('Queued 1');
  await clear(page);
  await page.evaluate(async()=>{const path='/src/api/retry.ts';const {connection}=await import(path);connection.set(true);connection.set(true);});
  await expect(page.locator('.village-toast')).toHaveCount(1);await expect(page.locator('.village-toast')).toContainText('Reconnecting');
  await page.evaluate(async()=>{const path='/src/api/retry.ts';(await import(path)).connection.set(false);});await expect(page.locator('.village-toast')).toHaveCount(0);
});

test('real check-in, purchase and settings confirmations use the shared cards',async({page})=>{
  await page.goto('/');await expect(page.locator('.dashboard')).toBeVisible();
  await page.getByRole('button',{name:'Check in',exact:true}).last().click();
  await page.getByRole('button',{name:/Daily note/}).click();
  await page.locator('#checkin-body').fill('One small step for the village.');
  await page.getByRole('button',{name:'Share check-in',exact:true}).click();
  await expect(page.locator('.village-toast[data-kind=reward]')).toContainText('+10 coins');
  await noOverlap(page);await clear(page);
  await expect(page.locator('dialog.cinematic-scene')).toHaveCount(0);
  await page.getByRole('button',{name:'Check in',exact:true}).last().click();
  await page.getByRole('button',{name:/Goal progress/}).click();await page.locator('#checkin-body').fill('Another step toward my goal.');
  await page.getByRole('button',{name:'Share check-in',exact:true}).click();
  await expect(page.locator('.toast-moment')).toContainText('Level 4');await clear(page);
  await expect(page.locator('dialog.cinematic-scene')).toHaveCount(0);
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  await page.getByRole('button',{name:'Buy Village Cap',exact:true}).click();
  await expect(page.locator('dialog[open] .village-toast')).toContainText('Item equipped');
  await noOverlap(page);await clear(page);await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Open Settings',exact:true}).click();
  await page.getByLabel('Display name',{exact:true}).fill('Iraj Village');
  await page.getByRole('button',{name:'Save settings',exact:true}).click();
  await expect(page.locator('dialog[open] .village-toast')).toContainText('Settings saved');await noOverlap(page);
  await expect(page.locator('.toast,.checkout-receipt,.reconnecting-pill,.celebration-title')).toHaveCount(0);
});

test('mock disaster and repair emit typed notifications while the profile stays open',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('.dashboard')).toBeVisible();
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('button',{name:'Debug menu',exact:true}).click();
  await page.getByText('Trigger disaster',{exact:false}).click();
  await page.getByRole('button',{name:'scorch',exact:true}).click();
  await expect(page.locator('.village-toast[data-kind=disaster]')).toContainText('scorch');await clear(page);
  await page.getByRole('button',{name:'Repair now',exact:true}).click();
  await expect(page.locator('.toast-moment')).toContainText('Rebuilt. Everyone is home.');await page.locator('.toast-moment .toast-close').focus();
  await noOverlap(page);await page.screenshot({path:'tests/artifacts/web034/repair-real-flow.png'});
  await expect(page.locator('.profile-panel')).toBeVisible();
});
