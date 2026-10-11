import {test, expect} from '@playwright/test';
import {MockApi} from '../src/api/mock';
import {DEMO_USER_ID} from '../src/api/fixtures';

test('styled homes, civic plaza and festival load; notice board opens Gazette', async ({page}) => {
  const api = new MockApi(), models = new Set<string>(), errors: string[] = [];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.ok() && r.url().endsWith('.glb')) models.add(r.url().split('/').pop()!);});
  await page.route('**/api/**', async r=>{
    const req=r.request(), url=new URL(req.url());
    if(!url.pathname.startsWith('/api/')) return r.continue();
    const path=url.pathname.slice(4)+url.search;
    if(path.endsWith('/presence/stream')) return r.fulfill({contentType:'text/event-stream',body:'event: presence\ndata: {"online":[]}\n\n'});
    try { await r.fulfill({json:await api.request(req.method(),path,req.headers()['x-demo-user']??DEMO_USER_ID,req.postDataJSON()??undefined)}); }
    catch(e) { await r.fulfill({status:(e as {status?:number}).status??500,json:{detail:String(e)}}); }
  });
  await page.goto('/');
  await expect(page.locator('.house-nameplate')).toHaveCount(5);
  const houses=await page.locator('.house-nameplate').evaluateAll(els=>els.map(e=>e.getAttribute('data-house-model')!));
  expect(new Set(houses.map(h=>h.replace(/_lv\d/,''))).size).toBe(5);
  await expect.poll(()=>['mayor_podium.glb','mayor_statue.glb','notice_board.glb','festival_main_stage.glb',...houses.map(h=>`${h}.glb`)].every(m=>models.has(m)),{timeout:30000}).toBe(true);
  expect(models.has('mayor_stage.glb')).toBe(false);
  await page.getByRole('button',{name:'Read the Gazette at the plaza notice board'}).click();
  await expect(page.getByRole('dialog')).toContainText('The Village Gazette');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Mayor’s Plaza announcements'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(errors).toEqual([]);
});
