process.env.QA_RESULT_FILE='recovery.json';
const {guard,shot,measure,close,report,save}=require('./audit.cjs');
const {createRequire}=require('node:module'),path=require('node:path');
const req=createRequire(path.resolve('package.json'));const {chromium,devices}=req('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const device of ['iPhone 14','Pixel 7']){
 const size=device==='iPhone 14'?{width:390,height:844}:devices[device].viewport;
 const live=await browser.newContext({...devices[device],viewport:size,ignoreHTTPSErrors:true,reducedMotion:'reduce'});await guard(live);await live.addInitScript(()=>localStorage.setItem('village:seat:live','13370000-0000-4000-8000-000000000001'));
 const page=await live.newPage();page.setDefaultTimeout(10000);await page.goto('https://207-246-81-187.sslip.io',{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('button',{name:'Village',exact:true}).waitFor({timeout:60000});
 for(const orientation of ['portrait','landscape']){
  const label='capture-'+device.replaceAll(' ','')+'-'+orientation;await page.setViewportSize(orientation==='portrait'?size:{width:size.height,height:size.width});await page.getByRole('button',{name:'Check in',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForTimeout(700);const checkin=await measure(page,label+'-latest-checkin');await close(page,checkin);
  await page.getByRole('button',{name:'My profile',exact:true}).focus();await page.keyboard.press('Enter');await page.locator('.profile-tab-content').waitFor({state:'attached',timeout:30000});(report.profileLayout??=[]).push({label,geometry:await page.evaluate(()=>['.profile-panel','.profile-tabs','.profile-tab-content'].map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {selector,y:r.y,height:r.height,overflowY:s.overflowY,scrollH:e.scrollHeight,clientH:e.clientHeight}}))});save();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Village',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Our group photo',exact:true}).click();await measure(page,label+'-group-photo');
  await page.getByRole('button',{name:'Take a photo',exact:true}).click();const entry=await measure(page,label+'-preview');const count=await page.locator('dialog[open]').count();await page.keyboard.press('Escape');await page.waitForTimeout(300);entry.escapeClosed=await page.locator('dialog[open]').count()===count-1;save();await page.keyboard.press('Escape');await page.waitForTimeout(300);
 }
 if(device==='iPhone 14'){
  await page.setViewportSize(size);
  await page.route('**/api/villages/*/competitions',route=>route.request().method()==='GET'?route.fulfill({status:500,contentType:'application/json',body:'{"detail":"QA simulated read failure"}'}):route.abort('blockedbyclient'));
  await page.getByRole('button',{name:'Compete',exact:true}).focus();await page.keyboard.press('Enter');await page.locator('.arena-modal[open] > p[role="alert"]').waitFor({timeout:20000});const failure=await measure(page,'latest-competition-read-failure');await close(page,failure);
 }
 await live.close();
}
const ctx=await browser.newContext({...devices['iPhone 14'],viewport:{width:390,height:844},ignoreHTTPSErrors:true});await guard(ctx);let delayed=true,healthRequests=0;
await ctx.addInitScript(()=>{localStorage.setItem('village:seat:live','13370000-0000-4000-8000-000000000001');localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001')});
await ctx.route('**/api/health',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))return route.abort('blockedbyclient');healthRequests++;if(delayed)await new Promise(r=>setTimeout(r,4000));await route.continue().catch(()=>{})});
const p=await ctx.newPage();await p.goto('https://207-246-81-187.sslip.io',{waitUntil:'domcontentloaded',timeout:60000});await p.getByRole('button',{name:'Check in',exact:true}).waitFor({timeout:60000});
report.recovery={initial:await p.locator('.mode-badge').innerText()};delayed=false;await p.waitForTimeout(6000);report.recovery.afterRemovingDelay=await p.locator('.mode-badge').innerText();report.recovery.badge=await p.locator('.mode-badge').evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {display:s.display,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,viewportW:innerWidth,viewportH:innerHeight}});
report.recovery.scripts=await p.evaluate(()=>[...document.scripts].map(e=>new URL(e.src,location.href).pathname));report.recovery.healthRequestsBeforeReload=healthRequests;await shot(p,'slow-api-recovery');save();await p.reload({waitUntil:'domcontentloaded',timeout:60000});await p.getByRole('button',{name:'Check in',exact:true}).waitFor({timeout:60000});report.recovery.afterReload=await p.locator('.mode-badge').innerText();report.recovery.healthRequestsAfterReload=healthRequests;save();console.log(JSON.stringify(report.recovery));await ctx.close();await browser.close();report.finished=new Date().toISOString();save();
})().catch(e=>{report.errors.push(e.stack);save();console.error(e);process.exit(1)});
