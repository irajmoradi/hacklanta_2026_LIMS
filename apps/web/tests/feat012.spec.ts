import {expect,test} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {MockApi,ApiError} from '../src/api/mock';
import {DEMO_USER_ID,DEMO_VILLAGE_ID} from '../src/api/fixtures';

test('four disasters render with offline assets and debug recovery',async({page})=>{
  mkdirSync('artifacts/feat012',{recursive:true});
  const backend=new MockApi();
  await backend.request('POST','/demo/debug/xp',DEMO_USER_ID,{idempotency_key:crypto.randomUUID(),amount:2000});
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Exercise the procedural scene: no generated assets or GPU worker required.
  await page.route('**/models/**',route=>route.abort());
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const req=route.request(),url=new URL(req.url());
    try{const result=await backend.request(req.method(),url.pathname.slice(4).replace('13370000-0000-4000-8000-000000000000',DEMO_VILLAGE_ID)+url.search,DEMO_USER_ID,req.postData()?req.postDataJSON():undefined);await route.fulfill({json:JSON.parse(JSON.stringify(result).replaceAll(DEMO_VILLAGE_ID,'13370000-0000-4000-8000-000000000000'))});}
    catch(e){await route.fulfill({status:e instanceof ApiError?e.status:500,json:{detail:String(e)}});}
  });
  await page.goto('/');
  const seats=page.getByRole('dialog',{name:'Who are you testing as?'});
  await expect(seats).toBeVisible();
  if(await seats.isVisible()) await seats.getByRole('button',{name:/Iraj/}).click();
  await expect(page.getByRole('button',{name:'Debug menu'})).toBeVisible();
  for(const kind of ['scorch','outbreak','blackout','blight']) {
    await page.getByRole('button',{name:'Debug menu'}).click();
    await page.getByText('Trigger disaster ▸',{exact:true}).click();
    await page.getByRole('button',{name:kind,exact:true}).click();
    await expect(page.locator(`[data-disaster="${kind}"]`)).toBeVisible();
    await page.getByRole('button',{name:'Close dialog',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.scene canvas')).toBeVisible();
    await page.waitForTimeout(2000);
    await page.screenshot({path:`artifacts/feat012/${kind}.png`});
    await page.getByRole('button',{name:'Debug menu'}).click();
    await page.getByRole('button',{name:'Repair now',exact:true}).click();
    await expect(page.getByLabel('Village disaster')).toHaveCount(0);
    await page.getByRole('button',{name:'Close dialog',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Rebuilt. Everyone is home.',{exact:false})).toBeVisible();
    await page.waitForTimeout(5500);
  }
  expect(errors).toEqual([]);
});
