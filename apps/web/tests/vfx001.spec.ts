import {expect,test} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const gpu=process.env.VFX_GPU==='1',low=process.env.VFX_LOW==='1';
const artifactDir=`artifacts/vfx001/${gpu?'gpu':low?'low':'after'}`;
import {MockApi,ApiError} from '../src/api/mock';
import {DEMO_USER_ID,DEMO_VILLAGE_ID} from '../src/api/fixtures';

for(const kind of ['scorch','outbreak','blackout','blight']) test(`${kind}: cinematic render and repair without shader errors`,async({page})=>{
  mkdirSync(artifactDir,{recursive:true});
  if(low)await page.addInitScript(()=>Object.defineProperty(navigator,'hardwareConcurrency',{value:2}));
  const backend=new MockApi();
  await backend.request('POST','/demo/debug/xp',DEMO_USER_ID,{idempotency_key:crypto.randomUUID(),amount:2000});
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error' && /THREE.WebGLProgram|VALIDATE_STATUS|Shader Error/.test(m.text())){errors.push(m.text());console.log(m.text());}});
  // Exercise the procedural scene: no generated assets or GPU worker required.
  if(!gpu)await page.route('**/models/**',route=>route.abort());
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
  {
    await page.getByRole('button',{name:'Debug menu'}).click();
    await page.getByText('Trigger disaster ▸',{exact:true}).click();
    await page.getByRole('button',{name:kind,exact:true}).click();
    await expect(page.locator(`[data-disaster="${kind}"]`)).toBeVisible();
    await page.getByRole('button',{name:'Close dialog',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.scene canvas')).toBeVisible();
    await page.waitForTimeout(gpu?8000:2500);
    const metrics=await page.evaluate(async()=>{
      const modulePath='/node_modules/.vite/deps/@react-three_fiber.js';
      const {_roots}=await import(modulePath);
      const state=_roots.get(document.querySelector('.scene canvas')).store.getState();
      const mesh=state.scene.getObjectByName('disaster-vfx-batch');
      state.gl.shadowMap.needsUpdate=false;
      state.gl.render(state.scene,state.camera);const withEffect=state.gl.info.render.calls;
      mesh.visible=false;state.gl.render(state.scene,state.camera);const withoutEffect=state.gl.info.render.calls;mesh.visible=true;
      const context=state.gl.getContext(),ext=context.getExtension('WEBGL_debug_renderer_info');
      return {extraCalls:withEffect-withoutEffect,instances:mesh.count,renderer:ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};
    });
    expect(metrics.extraCalls).toBe(1);expect(metrics.instances).toBeLessThan(500);
    if(gpu){
      const performance=await page.evaluate(async()=>{
        const path='/node_modules/.vite/deps/@react-three_fiber.js';const {_roots}=await import(path);const state=_roots.get(document.querySelector('.scene canvas')).store.getState();const mesh=state.scene.getObjectByName('disaster-vfx-batch');
        const sample=()=>new Promise<number>(resolve=>{let start=0,frames=0;const frame=(now:number)=>{if(!start)start=now;if(++frames===121)resolve(120000/(now-start));else requestAnimationFrame(frame);};requestAnimationFrame(frame);});
        const fps=await sample();mesh.visible=false;const baselineFps=await sample();mesh.visible=true;
        return {fps,baselineFps,targetMet:fps>=59};
      });
      writeFileSync(`${artifactDir}/${kind}-performance.json`,JSON.stringify({...metrics,...performance},null,2));
      if(process.env.VFX_REQUIRE_60==='1')expect(performance.fps).toBeGreaterThanOrEqual(59);
      expect(metrics.renderer).toContain('5090');console.log(`${kind}: ${JSON.stringify(performance)}`);

    }
    await page.screenshot({path:`${artifactDir}/${kind}.png`});
    await page.mouse.move(580,570);for(let i=0;i<14;i++)await page.mouse.wheel(0,-100);
    await page.waitForTimeout(700);
    await page.screenshot({path:`${artifactDir}/${kind}-detail.png`});
    await page.getByRole('button',{name:'Reset camera'}).click();
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForTimeout(100);
    expect(await page.evaluate(async()=>{const path='/node_modules/.vite/deps/@react-three_fiber.js';const {_roots}=await import(path);return _roots.get(document.querySelector('.scene canvas')).store.getState().scene.getObjectByName('disaster-vfx-batch').material.uniforms.still.value;})).toBe(1);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.getByRole('button',{name:'Debug menu'}).click();
    await page.getByRole('button',{name:'Repair now',exact:true}).click();
    await expect(page.getByLabel('Village disaster')).toHaveCount(0);
    await page.getByRole('button',{name:'Close dialog',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Rebuilt. Everyone is home.',{exact:false})).toBeVisible();
    await page.screenshot({path:`${artifactDir}/${kind}-rebuilt.png`});
    await page.waitForTimeout(4200);
  }
  expect(errors).toEqual([]);
  await page.close();
  await page.video()?.saveAs(`${artifactDir}/${kind}.webm`);
});
