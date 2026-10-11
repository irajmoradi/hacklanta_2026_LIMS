// A/B the same frozen scene, camera, geometry and materials. No masking of pixels.
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const profile=process.env.PERF_VISUAL_PROFILE==='1';
const directory=process.env.PERF_VISUAL_DIR || `artifacts/perf002/visual${profile?'-profile':''}`;mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:false});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await page.addInitScript(()=>localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001'));
  await page.goto(process.env.PERF_DEV_URL || 'http://127.0.0.1:5188');
  await page.waitForTimeout(15000);
  if(profile){await page.getByRole('button',{name:'My profile',exact:true}).click();await page.waitForTimeout(1000);}
  if(await page.locator('.scene').getAttribute('data-quality')!=='normal')throw new Error('Visual comparison requires normal quality; wait for a quieter host.');
  const sceneInfo=await page.evaluate(async()=>{
    const source=await (await fetch('/src/scene/VillageScene.tsx')).text();
    const url=source.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)[1];
    const {_roots}=await import(url);
    const state=_roots.get(document.querySelector('.scene canvas')).store.getState();
    state.setFrameloop('never');
    window.perfScene=state;
    state.gl.render(state.scene,state.camera);
    let transmissionMeshes=0;state.scene.traverse(node=>{if(node.isMesh && (Array.isArray(node.material)?node.material:[node.material]).some(material=>material.transmission>0))transmissionMeshes++;});
    return {quality:'normal',dpr:state.gl.getPixelRatio(),shadows:state.gl.shadowMap.enabled,transmissionMeshes};
  });
  writeFileSync(`${directory}/scene.json`,JSON.stringify(sceneInfo,null,2));
  await page.screenshot({path:`${directory}/direct.png`,animations:'disabled'});
  await page.evaluate(()=>{
    const s=window.perfScene;
    s.internal.subscribers.find(subscriber=>subscriber.priority===1).ref.current(s,0);
  });
  await page.screenshot({path:`${directory}/composed.png`,animations:'disabled'});
}finally{await browser.close();}
