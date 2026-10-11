import {test, expect} from '@playwright/test';
import {mkdirSync, writeFileSync} from 'node:fs';
import {useDemoSeat} from './demoSeat';
useDemoSeat();
const stage=process.env.WEB029_STAGE ?? 'after';
const artifacts='artifacts/web029';

test('real API town overview, street, camera reset and offline assets',async({page})=>{
  mkdirSync(artifacts,{recursive:true});
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.bringToFront();
  // WEB-031 hides the mode badge at compact desktop widths.
  await expect(page.locator('.mode-badge')).toHaveText('Connected');
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await expect(page.locator('.scene canvas')).toBeVisible();
  await page.waitForTimeout(12000);
  await page.getByRole('button',{name:'Reset camera'}).click();
  await page.screenshot({path:`${artifacts}/${stage}-overview.png`});
  // Use the real R3F store only in the browser test, without a production debug hook.
  await page.evaluate(async()=>{
    const source=await (await fetch('/src/scene/VillageScene.tsx')).text();
    const url=source.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)![1];
    const {_roots}=await import(/* @vite-ignore */ url);
    const {camera,controls,scene}=_roots.get(document.querySelector('.scene canvas')).store.getState();
    const home=scene.getObjectByName('home:13370000-0000-4000-8000-000000000001');
    const target=home.getWorldPosition(camera.position.clone());
    target.y=0;
    controls.enableDamping=false;controls.target.copy(target);
    camera.position.copy(target).add({x:14,y:12,z:20});camera.zoom=32;camera.updateProjectionMatrix();controls.update();
    controls.enableDamping=true;
  });
  await page.waitForTimeout(1000);
  await page.screenshot({path:`${artifacts}/${stage}-street.png`});
  await page.getByRole('button',{name:"Open Iraj's house profile"}).click({force:true});
  await expect(page.getByRole('button',{name:'Close profile'})).toBeVisible();
  await page.getByRole('button',{name:'Close profile'}).click();
  await page.getByRole('button',{name:'Reset camera'}).click();
  await page.waitForTimeout(2000);
  const rendererStats=await page.evaluate(async()=>{
    const source=await (await fetch('/src/scene/VillageScene.tsx')).text();
    const url=source.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)![1];
    const {_roots}=await import(/* @vite-ignore */ url);
    const {gl,scene,camera}=_roots.get(document.querySelector('.scene canvas')).store.getState();
    const topObjects:{name:string;meshes:number}[]=[];
    scene.traverse((o:any)=>{if(o.name.startsWith('unlocked:')||o.name.startsWith('home:')||o.name.startsWith('villager:')){let meshes=0;o.traverse((n:any)=>{if(n.isMesh)meshes++;});topObjects.push({name:o.name,meshes});}});
    let meshes=0,instanced=0;scene.traverse((o:any)=>{if(o.isMesh)meshes++;if(o.isInstancedMesh)instanced++;});
    return {topObjects,calls:gl.info.render.calls,triangles:gl.info.render.triangles,meshes,instanced,zoom:camera.zoom,shadows:gl.shadowMap.enabled};
  });
  const performanceSample=await page.evaluate(()=>new Promise<Record<string,unknown>>(resolve=>{
    const frames:number[]=[];let previous=performance.now();const start=previous;
    const frame=(now:number)=>{frames.push(now-previous);previous=now;if(now-start<5000){requestAnimationFrame(frame);return;}
      const gl=document.querySelector<HTMLCanvasElement>('.scene canvas')!.getContext('webgl2')!;
      const ext=gl.getExtension('WEBGL_debug_renderer_info');
      resolve({fps:frames.length*1000/(now-start),p95Ms:[...frames].sort((a,b)=>a-b)[Math.floor(frames.length*.95)],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'});
    };requestAnimationFrame(frame);
  }));
  writeFileSync(`${artifacts}/${stage}-performance.json`,JSON.stringify({...rendererStats,...performanceSample},null,2));
  await page.route('**/models/**',route=>route.fulfill({status:404,body:''}));
  await page.reload();
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await page.waitForTimeout(4000);
  await page.screenshot({path:`${artifacts}/${stage}-fallback.png`});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Reset camera'}).click();
  await expect(page.locator('.scene canvas')).toBeVisible();
  await page.screenshot({path:`${artifacts}/${stage}-mobile.png`});
  expect(errors).toEqual([]);
});
