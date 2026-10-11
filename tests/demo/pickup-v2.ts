// Read-only replacement for the unavailable legacy group job; no API response mocks.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve('docs/submission/video/data/demo');
const data=process.env.VILLAGE_ARTIFACT_DATA||'C:/Users/mourn/Downloads/hacklanta/data';
const browser=await chromium.launch({headless:false});
const ctx=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:out+'/v2_raw',size:{width:1920,height:1080}}});
const page=await ctx.newPage();
await page.route('**/api/**',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
try{
 await page.goto('http://localhost:4173/');await page.getByText('Connected',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Village',exact:true}).click();await page.getByRole('button',{name:'Our group photo',exact:true}).click();
 await page.getByLabel('Group photo',{exact:true}).waitFor();
 const start=await page.evaluate(()=>performance.now());
 await page.evaluate(()=>{const e=document.createElement('div');e.id='caption';e.setAttribute('popover','manual');e.style.cssText='position:fixed;inset:auto auto 100px 32px;margin:0;width:555px;padding:22px;background:#122b29f5;border:1px solid #90ac91;border-radius:16px;color:white;font:21px/1.5 Arial;pointer-events:none';e.textContent='GROUP PHOTO ONBOARDING · Consent comes first. The saved CV005 job is not registered with this API, so its claim grid is unavailable.';document.body.append(e);e.showPopover();});
 await page.waitForTimeout(2000);await page.screenshot({path:out+'/v2_stills/02-group-consent.png'});await page.waitForTimeout(4500);
 const base='assets/villages/13370000-0000-4000-8000-000000000000/group/d5eca46a-2175-4915-8c3d-df1d040cea29';
 const images=await Promise.all([0,1,2,3,4].map(async n=>'data:image/png;base64,'+(await readFile(resolve(data,`${base}/person_${n}/full_body.png`))).toString('base64')));
 await page.evaluate(images=>{document.getElementById('caption')?.remove();const e=document.createElement('div');e.setAttribute('popover','manual');e.style.cssText='position:fixed;inset:0;margin:0;width:100vw;height:100vh;box-sizing:border-box;padding:65px;background:#102623;color:#f8f3de;font:25px/1.5 Arial;border:0';const h=document.createElement('h1');h.textContent='One group photo → five SAM 3 crops';e.append(h);const p=document.createElement('p');p.textContent='REAL SAVED CV005 ARTIFACTS · Not a live claim grid · 24 s wall on RTX 5090';e.append(p);const row=document.createElement('div');row.style.cssText='height:650px;display:flex;gap:20px;justify-content:center;background:#e6e8df;border-radius:16px;padding:20px';for(const src of images){const img=document.createElement('img');img.src=src;img.style.cssText='width:18%;object-fit:contain';row.append(img);}row.animate([{opacity:0,transform:'scale(.97)'},{opacity:1,transform:'scale(1)'}],{duration:1200,fill:'forwards'});e.append(row);document.body.append(e);e.showPopover();},images);
 const elapsed=await page.evaluate(()=>performance.now())-start;await page.waitForTimeout(Math.max(0,15000-elapsed));
 const end=await page.evaluate(()=>performance.now());await ctx.close();const rawVideo=await page.video()!.path();
 await writeFile(out+'/v2-pickup.json',JSON.stringify({rawVideo,storySeconds:(end-start)/1000,replaces:'Group photo onboarding',reason:'Legacy CV005 job returns HTTP 404; use task-authorized consent screen plus real saved crops.'},null,2));
 console.log('Read-only group onboarding pickup captured');
}finally{await browser.close();}
