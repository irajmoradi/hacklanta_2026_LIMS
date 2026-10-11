import {chromium, expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/web018'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[], results=[];
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.fulfill({status:409,json:{detail:'Read-only capture'}}));
  await page.goto(process.env.WEB018_URL??'http://127.0.0.1:5398');
  await expect(page.getByText('Connected',{exact:true})).toBeAttached({timeout:60000});
  await expect(page.locator('.house-nameplate').first()).toBeVisible({timeout:60000});
  await page.waitForTimeout(8000);
  await page.screenshot({path:`${out}/real-overview.png`});
  // Use the development renderer's existing store; no production camera hooks.
  async function frame(name,back=false) {
    return page.evaluate(async ({name,back})=>{
      const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js');
      const state=_roots.get(document.querySelector('.scene canvas')).store.getState();
      const object=state.scene.getObjectByName(name); if(!object) throw new Error(`Missing ${name}`);
      const target=state.controls.target.clone(); object.getWorldPosition(target); target.y+=1.8;
      state.controls.target.copy(target); state.camera.position.copy(target).add({x:back?-9:9,y:10,z:back?-14:14});
      state.controls.maxZoom=90; state.camera.zoom=75; state.camera.updateProjectionMatrix(); state.controls.update();
      return {name,position:target.toArray()};
    },{name,back});
  }
  const ids=await page.locator('.house-nameplate').evaluateAll(els=>els.map(e=>({model:e.dataset.houseModel,label:e.getAttribute('aria-label')})));
  const homeNames=await page.evaluate(async()=>{
    const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js');
    const names=[]; _roots.get(document.querySelector('.scene canvas')).store.getState().scene.traverse(o=>{if(o.name.startsWith('home:')) names.push(o.name);}); return names;
  });
  for(let i=0;i<Math.min(5,homeNames.length);i++) for(const back of [false,true]) {
    results.push({...await frame(homeNames[i],back),...ids[i],back});
    await page.waitForTimeout(750); await page.screenshot({path:`${out}/real-house-${i}-${back?'back':'front'}.png`});
  }
  results.push(await frame('mayors-plaza')); await page.waitForTimeout(750);
  await page.screenshot({path:`${out}/real-plaza.png`});
  await page.getByRole('button',{name:'Read the Gazette at the plaza notice board'}).click();
  await expect(page.getByRole('dialog')).toContainText('The Village Gazette');
  expect(errors).toEqual([]);
} finally {await writeFile(`${out}/real-results.json`,JSON.stringify({results,errors},null,2)); await browser.close();}
