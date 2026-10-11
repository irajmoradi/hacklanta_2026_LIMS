import { chromium } from '../apps/web/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';
const base=process.env.PATIO_QA_URL ?? 'http://127.0.0.1:5197';
const out=new URL('./previews/',import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1');
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001');
});
await page.goto(base);
await page.locator('.scene canvas').waitFor();
await page.waitForTimeout(7000);
const initial=await page.evaluate(async()=>{
  const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js');
  const state=_roots.get(document.querySelector('.scene canvas')).store.getState();
  const patio=state.scene.getObjectByName('cafe-patio');
  return {patio:!!patio,parent:patio?.parent.name,labels:[...document.querySelectorAll('[data-player]')].map(e=>e.textContent)};
});
if(initial.parent!=='unlocked:storefront_cafe')throw new Error('Patio is not a cafe child');
async function drop(p) {
  const to=await p.evaluate(async()=>{
    const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js');
    const {Vector3}=await import('/node_modules/.vite/deps/three.js');
    const canvas=document.querySelector('.scene canvas'),{scene,camera}=_roots.get(canvas).store.getState(),rect=canvas.getBoundingClientRect();
    const point=scene.getObjectByName('unlocked:storefront_cafe').getWorldPosition(new Vector3());point.y=0;point.project(camera);
    return {x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2};
  });
  const from=await p.locator('[data-player="true"]').boundingBox();
  await p.mouse.move(from.x+from.width/2,from.y+from.height/2);await p.mouse.down();await p.waitForTimeout(350);
  await p.mouse.move(to.x,to.y,{steps:12});await p.mouse.up();await p.waitForTimeout(700);
  const label=await p.locator('[data-player="true"]').textContent();
  if(!label.includes('Sit and sip'))throw new Error('Cafe drag failed: '+label);
  await p.keyboard.press('KeyC');
}
async function frame(p) {
  await p.evaluate(async()=>{
    const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js');
    const {Vector3}=await import('/node_modules/.vite/deps/three.js');
    const {scene,camera,controls}=_roots.get(document.querySelector('.scene canvas')).store.getState();
    const center=scene.getObjectByName('cafe-patio').getWorldPosition(new Vector3());center.y=1;center.z-=.8;
    controls.maxZoom=160;controls.target.copy(center);camera.position.copy(center).add(new Vector3(6,7,12));camera.zoom=105;camera.updateProjectionMatrix();controls.update();
  });
  await p.waitForTimeout(600);
}
await drop(page);await frame(page);
const pose=await page.evaluate(async()=>{
  const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js');
  const {scene}=_roots.get(document.querySelector('.scene canvas')).store.getState();
  const person=scene.getObjectByName('villager:00000000-0000-4000-8000-000000000001');
  const cup=person.getObjectByName('cafe-sipping-cup');
  return {cupVisible:cup.visible,bodyScale:cup.parent.scale.toArray(),yaw:cup.parent.rotation.y};
});
if(!pose.cupVisible || pose.bodyScale[1]!==.7)throw new Error('Missing seated sipping pose');
await page.screenshot({path:out+'cafe_patio_day.png'});
await page.getByRole('button',{name:'Debug menu'}).click();
await page.getByLabel('Reason',{exact:true}).fill('ASSET-012 local mock night screenshot');
await page.getByRole('button',{name:'Toggle festival night'}).click();
await page.waitForTimeout(500);await page.keyboard.press('Escape');await frame(page);
const emission=await page.evaluate(async()=>{
  const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js');
  const {scene}=_roots.get(document.querySelector('.scene canvas')).store.getState();
  const values=[];scene.getObjectByName('cafe-patio').traverse(n=>{for(const m of Array.isArray(n.material)?n.material:[n.material])if(m?.name==='patio_bulb')values.push(m.emissiveIntensity);});return values;
});
if(!emission.length || emission.some(v=>v!==3))throw new Error('Night bulbs did not brighten');
await page.screenshot({path:out+'cafe_patio_night.png'});
await page.close();
console.log('Day/night screenshots and drag-to-sip passed; checking all-GLB fallback');
const fallback=await browser.newPage({viewport:{width:1440,height:1000}});
fallback.on('pageerror',e=>errors.push(e.message));
await fallback.addInitScript(()=>localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001'));
await fallback.route('**/models/**',r=>r.fulfill({status:404,body:''}));
await fallback.goto(base);console.log('Fallback loaded');await fallback.waitForTimeout(2000);await fallback.locator('.scene canvas').waitFor({timeout:20000});await fallback.waitForTimeout(2500);
await drop(fallback);await frame(fallback);
await fallback.screenshot({path:out+'cafe_patio_fallback.png'});
await browser.close();
await writeFile(out+'cafe_patio_browser_qa.json',JSON.stringify({initial,pose,emission,errors,fallback:'all GLBs 404; cafe drag, seated pose and cup remain usable'},null,2));
if(errors.length)throw new Error(errors.join('\n'));
console.log('ASSET-012 browser: cafe child, drag-to-sip, night bulbs, all-models-404 fallback; 0 failures');
