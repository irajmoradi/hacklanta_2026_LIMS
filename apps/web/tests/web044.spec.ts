import {existsSync} from 'node:fs';
import {test,expect} from '@playwright/test';
async function scene(page:any,operation:string){return page.evaluate(async(op:string)=>{const source='/tests/web044Scene.ts';const module=await import(source);return module[op]();},operation);}
test('seated cafe, desktop and touch close-up, restore and profiles',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/tests/web044.html');await expect(page.locator('.scene canvas')).toBeVisible();await page.waitForTimeout(2000);await scene(page,'settle');
 await expect.poll(async()=>{const s=await scene(page,'snapshot');return s.people.filter((p:any)=>p.seated).length;},{timeout:150000,intervals:[2000]}).toBe(6);
 await expect.poll(async()=>{const s=await scene(page,'snapshot');return s.people.every((p:any)=>p.knees.every((k:any)=>typeof k==='number'));}).toBe(true);
 await scene(page,'frameCafe');await page.waitForTimeout(500);
 await page.screenshot({path:'artifacts/web044/cafe-after.png'});
 const seated=await scene(page,'snapshot');expect(new Set(seated.people.map((p:any)=>p.position.join(','))).size).toBe(6);for(const p of seated.people)for(const knee of p.knees)expect(knee).toBeCloseTo(Math.PI/2);
 const point=await scene(page,'cafePoint');await page.mouse.dblclick(point.x,point.y,{delay:80});
 await expect(page.getByTestId('location-closeup')).toBeVisible();await page.waitForTimeout(700);
 const detail=await scene(page,'snapshot');expect(detail.dpr).toBe(2);expect(detail.zoom).toBeGreaterThan(95);
 await expect(page.getByTestId('location-closeup').locator('li')).toHaveCount(6);
 await page.screenshot({path:'artifacts/integ016/closeup-after-1280.png'});
 await page.keyboard.press('Escape');await expect(page.getByTestId('location-closeup')).toBeHidden();await page.waitForTimeout(700);
 await expect.poll(async()=>Math.abs((await scene(page,'snapshot')).zoom-seated.zoom)).toBeLessThan(.005);
 const restored=await scene(page,'snapshot');expect(restored.zoom).toBeCloseTo(seated.zoom);for(let i=0;i<3;i++)expect(restored.position[i]).toBeCloseTo(seated.position[i],2);
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(async()=>(await scene(page,'snapshot')).zoom).toBeLessThan(10);await scene(page,'frameCafe');await page.waitForTimeout(300);
 const mobile=await scene(page,'cafePoint');
 // Queue native touch events together: awaiting each tap lets the software renderer
 // stretch an intended double-tap into two separate taps several seconds apart.
 const cdp=await page.context().newCDPSession(page);const timestamp=Date.now()/1000;
 await Promise.all([0,1,2,3].map(i=>cdp.send('Input.dispatchTouchEvent',{
  type:i%2?'touchEnd':'touchStart',touchPoints:i%2?[]:[{x:mobile.x,y:mobile.y,id:0}],timestamp:timestamp+i*.06,
 })));await cdp.detach();
 await expect(page.getByTestId('location-closeup')).toBeVisible();await page.waitForTimeout(500);await page.screenshot({path:'artifacts/integ016/closeup-after-390.png'});
 await page.getByTestId('location-closeup').locator('li button').first().click();await expect(page.getByTestId('profile')).toBeVisible();await page.getByTestId('profile').click();
 await page.getByRole('button',{name:'Back to town'}).click();await expect(page.getByTestId('location-closeup')).toBeHidden();expect(errors).toEqual([]);
});

test('baseline cafe from original branch source',async({page})=>{
 test.skip(!existsSync(new URL('./web044BaselineVillageScene.tsx',import.meta.url)),'Run python tests/web044-baseline.py to generate the original source');
 await page.goto('/tests/web044.html?baseline');await expect(page.locator('.scene canvas')).toBeVisible();await page.waitForTimeout(2000);await scene(page,'settle');
 await expect.poll(()=>page.locator('.activity-badge').allTextContents().then((values:string[])=>values.map(v=>v.trim())),{timeout:150000,intervals:[2000]}).toEqual(Array(6).fill('Caf\u00e9 - sit and sip'));
 await scene(page,'frameCafe');await page.waitForTimeout(500);await page.screenshot({path:'artifacts/web044/cafe-before.png'});
});

test('zero downloaded models still seats every guest',async({page})=>{
 await page.route('**/models/**',route=>route.fulfill({status:404,body:''}));
 await page.goto('/tests/web044.html');await expect(page.locator('.scene canvas')).toBeVisible();await page.waitForTimeout(2000);await scene(page,'settle');
 await expect.poll(async()=>{const s=await scene(page,'snapshot');return s.people.filter((p:any)=>p.seated).length;}).toBe(6);
 await scene(page,'frameCafe');await page.screenshot({path:'artifacts/web044/cafe-fallback.png'});
});

test('plaza labels retain single-click actions; double-click and click-out work',async({page})=>{
 await page.goto('/tests/web044.html');await expect(page.locator('.scene canvas')).toBeVisible();await page.waitForTimeout(2000);await scene(page,'framePlaza');
 const label=page.getByRole('button',{name:/Plaza announcements/});await label.click();await expect(page.getByTestId('profile')).toHaveText('Profile mayor');await page.getByTestId('profile').click();
 await label.dblclick({delay:80});await expect(page.getByTestId('location-closeup')).toBeVisible();await expect(page.getByTestId('profile')).toBeHidden();await page.waitForTimeout(700);
 await page.mouse.click(5,5);await expect(page.getByTestId('location-closeup')).toBeHidden();
});


test('close-up keeps present guests at full detail in a crowded town',async({page})=>{
 await page.goto('/tests/web044.html?crowded');await expect(page.locator('.scene canvas')).toBeVisible();await page.waitForTimeout(2000);await scene(page,'settle');
 await scene(page,'frameCafe');await page.waitForTimeout(500);
 const point=await scene(page,'cafePoint');await page.mouse.dblclick(point.x,point.y,{delay:80});
 await expect(page.getByTestId('location-closeup')).toBeVisible();
 await expect.poll(async()=>{const people=await scene(page,'crowdDetail');return people.filter((p:any)=>p.seated&&p.detail).length;},{timeout:90000}).toBe(6);
 await expect(page.getByTestId('village-scene')).toHaveAttribute('data-dense-labels','true');
});


test('Library and Hall single actions survive location double-clicks',async({page})=>{
 await page.goto('/tests/web044.html');await expect(page.locator('.scene canvas')).toBeVisible();await page.waitForTimeout(2000);
 const point=await scene(page,'frameLibrary');await page.waitForTimeout(500);
 await page.mouse.click(point.x,point.y);await expect(page.getByTestId('profile')).toHaveText('Profile reading');await page.getByTestId('profile').click();
 await page.mouse.dblclick(point.x,point.y,{delay:80});await expect(page.getByTestId('location-closeup')).toContainText('Library');await expect(page.getByTestId('profile')).toBeHidden();
 await page.keyboard.press('Escape');await expect(page.getByTestId('location-closeup')).toBeHidden();
 // Keyboard activation remains immediate even when the label is outside the camera.
 const hall=page.getByRole('button',{name:'Enter Community Hall',exact:true});
 await hall.dispatchEvent('click',{detail:0});await expect(page.getByTestId('profile')).toHaveText('Profile hall');await page.getByTestId('profile').click();
 await hall.dispatchEvent('click',{detail:2});await expect(page.getByTestId('location-closeup')).toBeVisible();await expect(page.getByTestId('profile')).toBeHidden();
});
