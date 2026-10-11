import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';

for(const profile of [false,true]) test(`current scene compositor parity profile=${profile}`,async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001');
    localStorage.setItem('village:guide:v1:00000000-0000-4000-8000-000000000001','seen');
  });
  await page.goto('/');
  await page.getByTestId('villager-Iraj').waitFor();
  await page.waitForTimeout(15000);
  if(profile){await page.getByRole('button',{name:'My profile',exact:true}).click();await page.waitForTimeout(1500);}
  await expect(page.locator('.scene')).toHaveAttribute('data-quality','normal');
  await page.evaluate(async()=>{
    const source=await (await fetch('/src/scene/VillageScene.tsx')).text();
    const url=source.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)[1];
    const {_roots}=await import(url);
    const state=_roots.get(document.querySelector('.scene canvas')).store.getState();
    state.setFrameloop('never');window.perfScene=state;
    state.gl.render(state.scene,state.camera);
  });
  const directory=`artifacts/integ018/visual${profile?'-profile':''}`;
  mkdirSync(directory,{recursive:true});
  const direct=await page.screenshot({path:`${directory}/direct.png`,animations:'disabled'});
  await page.evaluate(()=>{const s=window.perfScene;s.internal.subscribers.find(sub=>sub.priority===1).ref.current(s,0);});
  const composed=await page.screenshot({path:`${directory}/composed.png`,animations:'disabled'});
  const a=PNG.sync.read(direct),b=PNG.sync.read(composed),diff=new PNG({width:a.width,height:a.height});
  const pixels=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:.1,includeAA:true});
  const result={differencePercent:pixels/(a.width*a.height)*100,threshold:.1,includeAA:true};
  writeFileSync(`${directory}/comparison.json`,JSON.stringify(result,null,2));
  writeFileSync(`${directory}/diff.png`,PNG.sync.write(diff));
  expect(result.differencePercent).toBeLessThanOrEqual(1);
});
