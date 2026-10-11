import {test, expect} from '@playwright/test';
import {mkdirSync, writeFileSync, readFileSync, existsSync} from 'node:fs';
import {useDemoSeat} from './demoSeat';
useDemoSeat();
let stage='after';
const artifacts='artifacts/web050';
// Optional local source snapshot lets a queued remote baseline run remain a true baseline.
const saved=new Map<string,string>();
test.beforeAll(({},info)=>{
  stage=info.project.name;
  if(stage!=='before')return;
  if(!existsSync('tests/web050-baseline.json'))throw new Error('Run python tests/web050-baseline.py before capturing the baseline');
  const baseline=JSON.parse(readFileSync('tests/web050-baseline.json','utf8').replace(/^\uFEFF/,''));
  for(const [path,source] of Object.entries(baseline)) {saved.set(path,readFileSync(path,'utf8'));writeFileSync(path,source as string);}
});
test.afterAll(()=>{for(const [path,source] of saved)writeFileSync(path,source);});
for(const seed of [1337,42,19,24109]) test(`seed ${seed}: overview, street and performance`,async({page})=>{
  mkdirSync(artifacts,{recursive:true});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/src/api/fixtures.ts',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace(/seed: 24109/g,`seed: ${seed}`)});
  });
  await page.goto('/');await page.bringToFront();
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  expect(await page.evaluate(async()=>{
    const path='/src/api/client.ts';const {api}=await import(/* @vite-ignore */ path);
    if(api.mode!=='mock')throw new Error('WEB-050 requires mock mode');
    const fixturesPath='/src/api/fixtures.ts';const {DEMO_VILLAGE_ID}=await import(/* @vite-ignore */ fixturesPath);
    return (await api.village(DEMO_VILLAGE_ID)).seed;
  })).toBe(seed);
  await page.waitForTimeout(16000);
  await page.getByRole('button',{name:'Reset camera'}).click();
  const measurements=[];
  for(const view of ['overview','street']) {
    if(view==='street') await page.evaluate(async()=>{
      const source=await(await fetch('/src/scene/VillageScene.tsx')).text();
      const url=source.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)![1];
      const {_roots}=await import(/* @vite-ignore */ url);
      const {camera,controls,scene}=_roots.get(document.querySelector('.scene canvas')).store.getState();
      const home=scene.getObjectByName('home:00000000-0000-4000-8000-000000000001');
      const target=home.getWorldPosition(camera.position.clone());target.y=0;
      controls.enableDamping=false;controls.target.copy(target);
      camera.position.copy(target).add({x:14,y:12,z:20});camera.zoom=23;camera.updateProjectionMatrix();controls.update();
    });
    await page.waitForTimeout(1500);
    await page.screenshot({path:`${artifacts}/${stage}-${seed}-${view}.png`});
    measurements.push({view,...await page.evaluate(async()=>{
      const source=await(await fetch('/src/scene/VillageScene.tsx')).text();
      const url=source.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)![1];
      const {_roots}=await import(/* @vite-ignore */ url);
      const {gl}=_roots.get(document.querySelector('.scene canvas')).store.getState();
      const calls:number[]=[],frames:number[]=[];const start=performance.now();let last=start;
      await new Promise<void>(resolve=>{const frame=(now:number)=>{frames.push(now-last);last=now;calls.push(gl.info.render.calls);if(now-start<15000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
      const context=gl.getContext(),ext=context.getExtension('WEBGL_debug_renderer_info');
      return {calls:calls.sort((a,b)=>a-b)[Math.floor(calls.length/2)],fps:frames.length*1000/(last-start),renderer:ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',shadows:gl.shadowMap.enabled};
    })});
  }
  writeFileSync(`${artifacts}/${stage}-${seed}-performance.json`,JSON.stringify(measurements,null,2));
  if(stage==='after' && existsSync(`${artifacts}/before-${seed}-performance.json`)) {
    const before=JSON.parse(readFileSync(`${artifacts}/before-${seed}-performance.json`,'utf8'));
    for(const [i,measurement] of measurements.entries()) {
      expect.soft(measurement.shadows).toBe(before[i].shadows);
      expect.soft(measurement.calls,`${seed} ${measurement.view}: draw-call budget`).toBeLessThanOrEqual(before[i].calls*1.05);
      expect.soft(measurement.fps,`${seed} ${measurement.view}: FPS budget`).toBeGreaterThanOrEqual(before[i].fps*.95);
    }
  }
  await page.route('**/models/**',route=>route.fulfill({status:404,body:''}));
  await page.reload();await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await page.waitForTimeout(4000);
  await page.screenshot({path:`${artifacts}/${stage}-${seed}-fallback.png`});
  expect(errors).toEqual([]);
});



