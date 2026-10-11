import { test, expect } from '@playwright/test';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID, makeFixtures } from '../src/api/fixtures';
import type { Profile } from '../src/api/types';
const peer = makeFixtures().village.villagers[1];

for (const width of [1366,390]) test(`viewport ${width}: house opens its owner; outfit lists selected equipment, custom items and no editing or generation`, async ({page}) => {
  await page.setViewportSize({width,height:width===390?844:768});
  const api = new MockApi(), mutations: string[] = [], errors: string[] = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR', e.message); });
  await page.route('**/api/**', async route => {
    const request=route.request(), url=new URL(request.url());
    if(!url.pathname.startsWith('/api/')) {await route.continue(); return;}
    const path=url.pathname.slice(4)+url.search;
    if(request.method()!=='GET' && !path.endsWith('/presence/heartbeat')) mutations.push(path);
    if(path.endsWith('/presence/stream')) {await route.fulfill({contentType:'text/event-stream',body:'event: presence\ndata: {"online":[]}\n\n'}); return;}
    try {
      const data = await api.request<any>(request.method(),path,request.headers()['x-demo-user'] ?? DEMO_USER_ID,request.postDataJSON() ?? undefined);
      if(path.endsWith(`/users/${peer.user_id}`)) (data as Profile).villager.equipped.push({item_id:'custom-photo-test',slot:'torso',asset_key:null,custom:true,kind:'outfit',name:'Sunflower shirt'});
      await route.fulfill({json:data});
    } catch(e) {await route.fulfill({status:(e as {status?:number}).status ?? 500,json:{detail:String(e)}});}
  });
  await page.addInitScript(id=>localStorage.setItem('village:seat:live',id),DEMO_USER_ID);
  await page.route('**/models/**', r => r.fulfill({status:404,body:'Offline'}));
  await page.goto('/');
  if(width===390) await page.getByRole('button',{name:`Visit ${peer.display_name}`,exact:true}).click();
  else await page.getByRole('button',{name:`Open ${peer.display_name}'s house profile`,exact:true}).click();
  await expect(page.locator('.profile-name h2')).toHaveText(peer.display_name);
  await page.getByRole('tab',{name:'Outfit',exact:true}).click();
  const outfit=page.getByRole('region',{name:'Villager showcase',exact:true});
  await outfit.scrollIntoViewIfNeeded();
  await expect(outfit.getByRole('img',{name:`Villager turntable for ${peer.display_name}`})).toBeVisible();
  for(const item of peer.equipped.filter(item=>!['house','decoration','house_addon','farm_animal'].includes(item.slot))) await expect(outfit.locator(`[data-item-id="${item.item_id}"]`)).toContainText('Equipped');
  await page.getByRole('tab',{name:'House',exact:true}).click();
  await expect(page.getByRole('region',{name:'House showcase',exact:true})).toContainText(`Level ${peer.house_level}`);
  await page.getByRole('tab',{name:'Outfit',exact:true}).click();
  await expect(outfit).toContainText('Natural voice');
  await expect(outfit).toContainText('Sunflower shirt');
  await outfit.getByRole('button',{name:'Sunflower shirt',exact:true}).click();
  await expect(outfit.getByRole('region',{name:'Item details'})).toContainText('Photo creation');
  await expect(outfit.getByRole('button',{name:/^(Equip|Unequip) /})).toHaveCount(0);
  await expect(page.getByRole('tab',{name:'Wardrobe'})).toHaveCount(0);
  expect(await page.locator('.profile-panel').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:`test-results/web016/mock-outfit-${width}.png`});
  await page.getByRole('button',{name:'Close profile'}).click();
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('tab',{name:'Outfit',exact:true}).click();
  await expect(page.getByRole('region',{name:'Villager showcase',exact:true})).toContainText(/Hype coach/i);
  await page.getByRole('button',{name:'Headphones',exact:true}).first().click();
  await expect(page.getByRole('button',{name:'Unequip Headphones',exact:true})).toBeVisible();
  expect(mutations).toEqual([]); expect(errors).toEqual([]);
});
