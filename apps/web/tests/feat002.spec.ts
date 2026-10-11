import {expect,test} from '@playwright/test';
import {MockApi, ApiError} from '../src/api/mock';
import {DEMO_USER_ID, DEMO_VILLAGE_ID} from '../src/api/fixtures';
import type {Village} from '../src/api/types';

test('settings opt in, buy, preview, confirm and consume a gram with mocked delivery',async ({page})=>{
  const backend=new MockApi();
  const village=await backend.request<Village>('GET',`/villages/${DEMO_VILLAGE_ID}`,DEMO_USER_ID);
  const speaker=village.villagers[1], recipient=village.villagers[2];
  await backend.request('PATCH','/me',speaker.user_id,{allow_voice_by_friends:true});
  await backend.request('PATCH','/me',recipient.user_id,{receive_villagergrams:true,phone_e164:'+15555550123'});
  let sends=0;
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname.slice(4)+url.search;
    if(req.method()==='POST'&&path.endsWith('/villagergrams')) sends++;
    try {await route.fulfill({json:await backend.request(req.method(),path,DEMO_USER_ID,req.postData()?req.postDataJSON():undefined)});}
    catch(e){await route.fulfill({status:e instanceof ApiError?e.status:500,json:{detail:e instanceof Error?e.message:'Failed'}});}
  });
  await page.goto('/');
  await page.getByRole('button',{name:'My profile'}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  const permission=page.getByRole('checkbox',{name:'Friends may use my avatar and AI voice for Villager-grams'});
  await expect(permission).not.toBeChecked(); await permission.check();
  await page.getByRole('button',{name:'Save settings',exact:true}).click();
  await expect(page.getByText('Settings saved.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('button',{name:/^Shop/}).click();
  await page.getByRole('button',{name:'Buy Villager-gram · 150 coins'}).click();
  await page.getByLabel('Speaker villager').selectOption(speaker.user_id);
  await page.getByLabel('Fictional line').fill('The village ducks salute your tiny victory!');
  await page.getByLabel('Recipient member').selectOption(recipient.user_id);
  await page.getByRole('button',{name:'Preview gram'}).click();
  await expect(page.getByLabel('Villager-gram preview')).toContainText('The village ducks salute your tiny victory!');
  expect(sends).toBe(0);
  await page.getByLabel('Villager-gram preview').screenshot({path:'test-results/feat002-preview.png'});
  await page.getByRole('button',{name:'Confirm and send gram'}).click();
  await expect(page.getByText('Gram queued. Delivery may be a dry run; queued does not mean delivered.')).toBeVisible();
  expect(sends).toBe(1);
  await expect(page.getByRole('button',{name:'Buy Villager-gram · 150 coins'})).toBeVisible();
});
