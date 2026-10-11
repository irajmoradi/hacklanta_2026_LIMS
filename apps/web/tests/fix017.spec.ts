import {expect,test} from '@playwright/test';
async function start(page:any, query=''){
 await page.route('**/api/assets/**', (r:any)=>r.fulfill({body:'synthetic'}));
 await page.goto('/tests/fix017.html'+query);
 await page.getByRole('button',{name:'Everyone says it'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Everyone says it'}).click();
}
test('three animated videos share the clock, replay and stop',async({page})=>{
 await start(page);
 const videos=page.locator('video[data-ready=true]');await expect(videos).toHaveCount(3);
 await expect.poll(()=>videos.evaluateAll((vs:any[])=>vs.every(v=>!v.paused&&v.currentTime>.15))).toBe(true);
 const times=await videos.evaluateAll((vs:any[])=>vs.map(v=>v.currentTime));expect(Math.max(...times)-Math.min(...times)).toBeLessThan(.15);
 await page.screenshot({path:'artifacts/fix017/chorus-desktop.png'});
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.locator('video')).toHaveCount(0);
 await page.getByRole('dialog').getByRole('button',{name:'Everyone says it'}).click();await expect(videos).toHaveCount(3);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/fix017/chorus-mobile.png'});
 await page.getByRole('button',{name:'Close dialog'}).click();await expect(page.locator('video')).toHaveCount(0);
});
test('late clips join without blocking audio; offline uses waveform',async({page})=>{
 await start(page,'?late');await expect(page.locator('.voice-wave')).toHaveCount(3);await expect(page.locator('video')).toHaveCount(0);
 await expect(page.locator('video[data-ready=true]')).toHaveCount(3,{timeout:10000});
 await page.getByRole('button',{name:'Stop',exact:true}).click();const polls=await page.evaluate(()=>(window as any).polls);await page.waitForTimeout(2200);expect(await page.evaluate(()=>(window as any).polls)).toBe(polls);
 await page.getByRole('button',{name:'Close dialog'}).click();await start(page,'?offline');await expect(page.locator('.voice-wave')).toHaveCount(3);await expect(page.locator('video')).toHaveCount(0);await page.screenshot({path:'artifacts/fix017/offline.png'});
});
test('spotlight retains live Gaussian while neighbors use videos',async({page})=>{
 await start(page,'?live&delay=100');await expect(page.locator('[data-head-state=ready]')).toBeVisible();await expect(page.locator('video[data-ready=true]')).toHaveCount(2);await page.screenshot({path:'artifacts/fix017/live-spotlight.png'});
});
