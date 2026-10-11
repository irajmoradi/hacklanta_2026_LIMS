import {test, expect} from '@playwright/test';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';

for (const size of [5,25,100]) test(`synthetic town ${size}`, async ({page}) => {
  const label=process.env.SCALE_LABEL ?? 'after';
  const dir='tests/artifacts/scale001'; mkdirSync(dir,{recursive:true});
  const data=readFileSync(`../api/artifacts/scale001/village-${size}.json`,'utf8');
  const errors:string[]=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
  await page.route('**/scale001-data',route=>route.fulfill({body:data,contentType:'application/json'}));
  await page.route(url=>url.pathname.startsWith('/api/'),route=>route.fulfill({body:'[]',contentType:'application/json'}));
  // Explicit fixture/no-assets scenario; the GPU worker and generated assets are offline.
  await page.route(/\.(glb|gltf)(\?.*)?$/,route=>route.abort());
  const started=Date.now();
  await page.goto('/tests/scale001.html');
  await expect(page.locator('.scene canvas')).toBeVisible();
  await page.waitForFunction(()=>document.querySelector('[data-testid^="villager-"]'));
  const initial_ms=Date.now()-started;
  await page.waitForTimeout(14000);
  const results=[];
  for (const view of ['overview','street']) {
    const sample=await page.evaluate(async view=>{
      const source=await (await fetch('/src/scene/VillageScene.tsx')).text();
      const url=source.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)![1];
      const {_roots}=await import(/* @vite-ignore */ url);
      const {gl,scene,camera,controls}=_roots.get(document.querySelector('.scene canvas')).store.getState();
      if(view==='street') {
        camera.zoom=32;camera.position.set(15,16,27);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
        if(controls) {controls.target.set(0,0,0);controls.update();}
      }
      await new Promise(r=>setTimeout(r,1500));
      let previous=performance.now();const start=previous, frames:number[]=[],calls:number[]=[];
      await new Promise<void>(resolve=>{const frame=(now:number)=>{
        frames.push(now-previous);calls.push(gl.info.render.calls);previous=now;
        if(now-start<5000)requestAnimationFrame(frame);else resolve();
      };requestAnimationFrame(frame);});
      const context=gl.getContext(),ext=context.getExtension('WEBGL_debug_renderer_info');
      let villagers=0, detailed=0, impostors=0;scene.traverse((o:{name:string})=>{
        if(o.name.startsWith('villager:'))villagers++;
        if(o.name==='crowd-detailed')detailed++;
        if(o.name==='crowd-impostor')impostors++;
      });
      return {view,fps:frames.length*1000/(previous-start),p95_frame_ms:frames.sort((a,b)=>a-b)[Math.floor(frames.length*.95)],
        draw_calls:Math.round(calls.reduce((a,b)=>a+b)/calls.length),villagers,detailed,impostors,
        avatar_requests:Number(document.body.dataset.avatarRequests??0),
        renderer:ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',
        labels:[...document.querySelectorAll('.villager-label')].filter(el=>el.getBoundingClientRect().width>0 && getComputedStyle(el).visibility!=='hidden').length};
    },view);
    const cdp=await page.context().newCDPSession(page);
    const heap=await cdp.send('Runtime.getHeapUsage');await cdp.detach();
    results.push({...sample,heap_mb:heap.usedSize/1024/1024,initial_ms});
    await page.screenshot({path:`${dir}/${label}-${size}-${view}.png`});
    expect(sample.villagers).toBe(size);
    if(label==='after' && size===100) {
      expect(sample.detailed).toBeLessThanOrEqual(22);
      expect(sample.impostors).toBeGreaterThanOrEqual(78);
      expect(sample.avatar_requests).toBeLessThanOrEqual(2);
    }
  }
  writeFileSync(`${dir}/web-${label}-${size}.json`,JSON.stringify({size,results,errors},null,2));
  expect(errors).toEqual([]);
});

test('100-person review bounds requests and finds the last villager', async({page})=>{
  const data=readFileSync('../api/artifacts/scale001/village-100.json','utf8');
  await page.route('**/scale001-data',route=>route.fulfill({body:data,contentType:'application/json'}));
  await page.goto('/tests/scale001.html?review');
  await expect(page.locator('.weekly-goal-card')).toHaveCount(10);
  await expect(page.locator('body')).toHaveAttribute('data-profile-requests','10');
  await page.getByRole('button',{name:'Next villagers'}).click();
  await expect(page.getByRole('article',{name:"Villager 011's weekly goal",exact:true})).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-profile-requests','20');
  await page.getByRole('searchbox',{name:'Find a villager'}).fill('Villager 100');
  await expect(page.getByRole('article',{name:"Villager 100's weekly goal",exact:true})).toBeVisible();
  await expect(page.locator('.weekly-goal-card')).toHaveCount(1);
  await expect(page.locator('body')).toHaveAttribute('data-profile-requests','21');
  await page.screenshot({path:'tests/artifacts/scale001/review-100-search.png'});
});
