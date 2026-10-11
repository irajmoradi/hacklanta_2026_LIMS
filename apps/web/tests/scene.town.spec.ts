import {test,expect} from '@playwright/test';
for(const night of [false,true])test(`real town ${night?'night':'day'}: full framing and camera`,async({page})=>{
  const errors:string[]=[];let liveMembers=0;
  const models=new Set<string>();
  page.on('response', async response=>{if(response.url().endsWith('.glb') && response.ok()){try{const body=await response.body();if(body.subarray(0,4).toString()==='glTF')models.add(response.url());}catch{ /* A reset can cancel an in-flight response. */ }}});
  page.on('pageerror',e=>errors.push(e.message));
  // Read the actual API village. Override only lighting; no backend mutation/generation.
  await page.route('**/api/villages/13370000-0000-4000-8000-000000000000',async route=>{
    const response=await route.fetch();expect(response.ok()).toBe(true);const village=await response.json();liveMembers=village.villagers.length;
    village.world={...village.world,time_of_day:night?'22:00':'15:00',weather:night?'festival_night':'clear'};
    await route.fulfill({response,json:village});
  });
  await page.goto('/');
  await expect.poll(()=>liveMembers,{timeout:30000}).toBeGreaterThan(0);
  await expect(page.locator('[data-head-kind]')).toHaveCount(liveMembers);
  await page.waitForTimeout(12000);
  await expect.poll(()=>models.size).toBeGreaterThan(20);
  await expect(page.getByTestId('building-label')).toHaveCount(0);
  await expect(page.getByText('FOR SALE', {exact:true})).toHaveCount(0);
  await page.screenshot({path:`src/scene/artifacts/web013-real-${night?'night':'day'}.png`});
  const fps=await page.evaluate(()=>new Promise<number>(resolve=>{let start=0,frames=0;const step=(t:number)=>{start||=t;frames++;if(t-start>=3000)resolve((frames-1)*1000/(t-start));else requestAnimationFrame(step);};requestAnimationFrame(step);}));
  const renderer=await page.evaluate(()=>{const gl=document.querySelector('canvas')!.getContext('webgl2')!;const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';});
  console.log(renderer);
  console.log(`WEB-013 ${night?'night':'day'}: ${fps.toFixed(1)} fps; ${liveMembers} live villagers`);
  if(process.env.SCENE_HARDWARE==='1')expect(fps).toBeGreaterThanOrEqual(50);
  // Inspect a building, then leave the canvas: no permanent label may remain.
  for(const [x,y] of [[960,500],[1000,540],[900,480],[1100,540]]) {
    await page.mouse.move(x,y); await page.waitForTimeout(150);
    if(await page.getByTestId('building-label').count())break;
  }
  await expect(page.getByTestId('building-label')).toHaveCount(1);
  await page.mouse.move(10,10);
  await expect(page.getByTestId('building-label')).toHaveCount(0);
  await page.mouse.move(1000,650); await page.mouse.wheel(0,500);
  await page.waitForTimeout(1000);
  await page.screenshot({path:`src/scene/artifacts/web013-overview-${night?'night':'day'}.png`});
  await page.mouse.down({button:'right'}); await page.mouse.move(1120,680,{steps:12}); await page.mouse.up({button:'right'});
  await page.getByRole('button',{name:'Reset camera'}).click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
