import {expect,test} from '@playwright/test';
import {MockApi,ApiError} from '../src/api/mock';
import {DEMO_USER_ID as uid,DEMO_VILLAGE_ID as vid} from '../src/api/fixtures';
import type {Village} from '../src/api/types';
import {mkdirSync} from 'node:fs';

test('partial scaffolding and revival work on low quality with reduced motion',async({page})=>{
  mkdirSync('artifacts/vfx001/transitions',{recursive:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>Object.defineProperty(navigator,'hardwareConcurrency',{value:2}));
  const backend=new MockApi();
  const action=(name:string,body={})=>backend.request('POST',`/demo/debug/${name}`,uid,{idempotency_key:crypto.randomUUID(),...body});
  await action('xp',{amount:2000});
  await backend.request('POST',`/villages/${vid}/shop/buy`,uid,{item_id:'house_backyard'});
  await backend.request('POST',`/villages/${vid}/shop/buy`,uid,{item_id:'pet_dog'});
  await action('disaster',{disaster:'scorch'});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/Shader Error|WebGLProgram/.test(m.text()))errors.push(m.text());});
  await page.route('**/models/**',r=>r.abort());
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const req=route.request(),url=new URL(req.url());
    try{const result=await backend.request<Partial<Village>>(req.method(),url.pathname.slice(4).replace('13370000-0000-4000-8000-000000000000',vid)+url.search,uid,req.postData()?req.postDataJSON():undefined);if(result.world?.disaster?.kind==='scorch'){result.world.disaster.checkins=3;result.world.disaster.people=2;}await route.fulfill({json:JSON.parse(JSON.stringify(result).replaceAll(vid,'13370000-0000-4000-8000-000000000000'))});}
    catch(e){await route.fulfill({status:e instanceof ApiError?e.status:500,json:{detail:String(e)}});}
  });
  await page.goto('/');
  await page.getByRole('dialog',{name:'Who are you testing as?'}).getByRole('button',{name:/Iraj/}).click();
  const alerts=page.getByRole('button',{name:/Alerts, \d+ active/});
  await expect(alerts).toBeVisible();
  if(await alerts.getAttribute('aria-expanded')==='false')await alerts.click();
  await expect(page.locator('[data-disaster="scorch"]')).toBeVisible();
  const state=()=>page.evaluate(async()=>{const path='/node_modules/.vite/deps/@react-three_fiber.js';const {_roots}=await import(path);const mesh=_roots.get(document.querySelector('.scene canvas')).store.getState().scene.getObjectByName('disaster-vfx-batch');return mesh?{still:mesh.material.uniforms.still.value,motions:Array.from(mesh.geometry.attributes.effect.array).filter((_,i)=>i%4===1)}:null;});
  await expect.poll(async()=>(await state())?.motions.filter(x=>x===11).length).toBe(6);
  expect((await state())?.still).toBe(1);
  await page.screenshot({path:'artifacts/vfx001/transitions/scaffolding.png'});
  await page.getByRole('button',{name:'Debug menu'}).click();await page.getByRole('button',{name:'Repair now',exact:true}).click();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await expect(page.getByLabel('Village disaster')).toHaveCount(0);
  await action('disaster',{disaster:'outbreak'});
  const now=Date.now;
  try{Date.now=()=>now()+49*3600000;await backend.request('GET',`/villages/${vid}`,uid);}finally{Date.now=now;}
  await page.reload();
  const seats=page.getByRole('dialog',{name:'Who are you testing as?'});await expect(seats).toBeVisible();await seats.getByRole('button',{name:/Iraj/}).click();
  await expect(alerts).toBeVisible();
  if(await alerts.getAttribute('aria-expanded')==='false')await alerts.click();
  await expect(page.locator('[data-disaster="outbreak"]')).toContainText('Pets away');
  await page.screenshot({path:'artifacts/vfx001/transitions/paw-trail.png'});
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  await page.getByRole('button',{name:/Buy Revival potion/i}).click();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await expect(page.getByText('Welcome home!',{exact:true})).toBeVisible();
  expect((await state())?.motions).toContain(8);
  expect((await state())?.still).toBe(1);
  await page.screenshot({path:'artifacts/vfx001/transitions/revival.png'});
  const home=await backend.request<Village>('GET',`/villages/${vid}`,uid);expect(home.villagers.find(p=>p.user_id===uid)!.equipped_ids).toContain('pet_dog');
  expect(errors).toEqual([]);
});
