import {expect,test} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {MockApi,ApiError} from '../src/api/mock';
import {DEMO_USER_ID,DEMO_VILLAGE_ID} from '../src/api/fixtures';
import type {Village} from '../src/api/types';

test.beforeAll(() => {
  mkdirSync('test-results',{recursive:true});
  const require = createRequire(new URL('../../imessage/package.json',import.meta.url));
  execFileSync(require('ffmpeg-static'),['-y','-f','lavfi','-i','color=c=purple:s=512x512:d=1',
    '-f','lavfi','-i','anullsrc=r=44100:cl=mono','-t','1','-c:v','libx264','-pix_fmt','yuv420p',
    '-c:a','aac','-movflags','+faststart','test-results/feat010-fixture.mp4'],{stdio:'ignore'});
});

for (const ready of [true,false]) test(`gram rendering resolves to ${ready ? 'playable video' : 'audio fallback'}`,async ({page}) => {
  const backend=new MockApi();
  const village=await backend.request<Village>('GET',`/villages/${DEMO_VILLAGE_ID}`,DEMO_USER_ID);
  const speaker=village.villagers[1],recipient=village.villagers[2];
  await backend.request('PATCH','/me',speaker.user_id,{allow_voice_by_friends:true});
  await backend.request('PATCH','/me',recipient.user_id,{receive_villagergrams:true,phone_e164:'+15555550123'});
  let polls=0,sends=0,assetFetches=0;
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname.slice(4)+url.search;
    if(path==='/assets/fixture.mp4') {
      expect(req.headers()['x-demo-user']).toBeTruthy(); assetFetches++;
      return route.fulfill({contentType:'video/mp4',body:readFileSync('test-results/feat010-fixture.mp4')});
    }
    if(path.endsWith('/villagergrams/video-test')) {
      polls++;
      return route.fulfill({json:{id:'video-test',status:polls<2?'rendering_video':'queued',
        video_url:polls>=2&&ready?'/api/assets/fixture.mp4':null}});
    }
    try {
      const result=await backend.request(req.method(),path,DEMO_USER_ID,req.postData()?req.postDataJSON():undefined);
      if(req.method()==='POST'&&path.endsWith('/villagergrams')) {
        sends++;
        return route.fulfill({json:{id:'video-test',status:'rendering_video',video_url:null}});
      }
      await route.fulfill({json:result});
    } catch(e) {await route.fulfill({status:e instanceof ApiError?e.status:500,json:{detail:String(e)}});}
  });
  await page.goto('/');
  await page.getByRole('button',{name:/^Shop/}).click();
  await page.getByRole('button',{name:'Buy Villager-gram · 150 coins'}).click();
  await page.getByLabel('Speaker villager').selectOption(speaker.user_id);
  await page.getByLabel('Fictional line').fill('The village ducks salute your tiny victory!');
  await page.getByLabel('Recipient member').selectOption(recipient.user_id);
  await page.getByRole('button',{name:'Preview gram'}).click();
  await page.getByRole('button',{name:'Confirm and send gram'}).click();
  await expect(page.getByText('Rendering video…',{exact:true})).toBeVisible();
  if(ready) {
    await page.locator('.villagergram').screenshot({path:'test-results/feat010-rendering.png'});
    const video=page.getByLabel('Rendered Villager-gram');
    await expect(video).toBeVisible();
    await expect.poll(()=>video.evaluate((el:HTMLVideoElement)=>el.readyState)).toBeGreaterThan(0);
    expect(assetFetches).toBe(1);
    await page.locator('.villagergram').screenshot({path:'test-results/feat010-video.png'});
  } else {
    await expect(page.getByText('Gram queued with available audio and portrait.')).toBeVisible();
    await expect(page.getByLabel('Rendered Villager-gram')).toHaveCount(0);
    expect(assetFetches).toBe(0);
  }
  expect(sends).toBe(1);
  const stoppedAt=polls;
  await page.waitForTimeout(2500);
  expect(polls).toBe(stoppedAt);
});
