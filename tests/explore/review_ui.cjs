/* Headed, read-only exploration. Set REVIEW_PLAYWRIGHT_ROOT to an installed web
 * package directory when this worktree has no node_modules. Artifacts stay local.
 * No external browser navigation, wallet actions, generation, or form submission.
 */
const {createRequire} = require('node:module');
const fs = require('node:fs/promises');
const path = require('node:path');
const web = process.env.REVIEW_PLAYWRIGHT_ROOT || path.resolve(__dirname, '../../apps/web');
const {chromium} = createRequire(path.join(web, 'package.json'))('playwright');
const out = path.join(__dirname, 'artifacts');
const results = {checks: [], console: [], pageErrors: [], failed: [], httpErrors: [], blocked: [], geometry: []};
let browser, page;
async function shot(name) {await page.screenshot({path:path.join(out, name+'.png')});}
async function check(name, action) {
  try {await action(); results.checks.push({name, outcome:'completed'}); console.log('OK '+name);}
  catch (e) {results.checks.push({name, outcome:'exploration failure', detail:e.message}); console.log('FAIL '+name+': '+e.message.split('\n')[0]); await shot('failure-'+results.checks.length);}
}
async function close() {
  for (let i=0;i<3 && await page.locator('dialog[open]').count();i++) await page.keyboard.press('Escape');
  const c=page.getByRole('button',{name:'Close profile',exact:true}); if(await c.isVisible()) await c.click();
}
async function button(name) {await page.getByRole('button',{name,exact:typeof name==='string'}).click();}
async function geometry(size) {
  results.geometry.push({size, elements:await page.locator('.brand,.topbar,.feed-panel,.action-dock,.challenge-peek,button[aria-label^="Open "]').evaluateAll(es=>es.map(e=>{
    const r=e.getBoundingClientRect();return {name:e.getAttribute('aria-label')||e.className,rect:r.toJSON(),
      centerTarget:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')?.getAttribute('aria-label')};
  }))});
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  browser=await chromium.launch({headless:false,args:['--enable-webgl','--ignore-gpu-blocklist']});
  const ctx=await browser.newContext({viewport:{width:1920,height:1080}});
  await ctx.route('**/api/**',async route=>{
    const r=route.request();
    if(!['GET','HEAD','OPTIONS'].includes(r.method())) {
      results.blocked.push({method:r.method(),path:new URL(r.url()).pathname});
      return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({detail:'REVIEW-001 read-only guard: write blocked'})});
    }
    return route.continue();
  });
  page=await ctx.newPage();page.setDefaultTimeout(4000);
  page.on('console',m=>{if(['warning','error'].includes(m.type()))results.console.push({kind:m.type(),text:m.text(),url:m.location().url});});
  page.on('pageerror',e=>results.pageErrors.push({message:e.message,stack:e.stack}));
  page.on('requestfailed',r=>results.failed.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)results.httpErrors.push({url:r.url(),status:r.status()});});
  await page.goto('http://localhost:4173');await page.getByRole('button',{name:'My profile',exact:true}).waitFor();await page.waitForTimeout(2000);
  for(const [label,width,height] of [['wide',1920,1080],['laptop',1366,768],['phone',390,844]]) {
    await close();await page.setViewportSize({width,height});await page.waitForTimeout(350);await shot(label+'-home');await geometry(label);
    if(width===390) await button('More');
    for(const name of ['Inbox','AI at work','Village',/^Check in/,'Gazette','Weekly goal','Week','Compete','Shop','Mayor']) {
      await check(label+' panel '+name,async()=>{await close();await button(name);await page.waitForTimeout(1100);await shot(label+'-'+String(name).replace(/[^a-z0-9]/gi,'-'));});
    }
    await close();
    for(const name of ['Iraj','Lance','Stefanny','Maya','Dev']) {
      await check(label+' profile '+name,async()=>{await button(width===390?`Open ${name}'s profile`:'Visit '+name);await page.waitForTimeout(850);await shot(label+'-profile-'+name);await close();});
      await close();
    }
    await check(label+' tour',async()=>{await button('▶ Tour');for(let i=0;i<6;i++){await page.waitForTimeout(450);await shot(label+'-tour-'+(i+1));await button(i===5?'Finish':'Next');}await close();});
  }
  await page.setViewportSize({width:1920,height:1080});await close();
  for(const name of ['Iraj','Lance','Stefanny','Maya','Dev']) {
    await check('Play as '+name,async()=>{await close();await page.getByRole('combobox',{name:'Play as',exact:true}).selectOption({label:name});await page.waitForFunction(n=>document.querySelector('.self-heading strong')?.textContent.includes('Hey, '+n),name);await button('My profile');await page.getByRole('tab',{name:'Wardrobe',exact:true}).click();await page.waitForTimeout(500);await shot('wardrobe-'+name);await close();});
  }
  await page.getByRole('combobox',{name:'Play as',exact:true}).selectOption({label:'Iraj'});await page.waitForTimeout(700);
  await check('keyboard main controls and dialog',async()=>{
    await page.locator('body').click({position:{x:400,y:130}});await page.keyboard.press('c');await page.getByRole('textbox').fill('Unsaved review draft');
    results.focus=[];for(let i=0;i<12;i++){await page.keyboard.press('Tab');results.focus.push(await page.evaluate(()=>({tag:document.activeElement.tagName,label:document.activeElement.getAttribute('aria-label'),dialog:!!document.activeElement.closest('dialog')})));}
    await shot('keyboard-dialog');await page.reload();await page.getByRole('button',{name:'My profile',exact:true}).waitFor();await button(/^Check in/);
    results.draftAfterReload=await page.getByRole('textbox').inputValue();await close();
  });
  await check('slow cold asset load',async()=>{
    const cdp=await ctx.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:180,downloadThroughput:192000,uploadThroughput:96000});
    await page.reload({waitUntil:'domcontentloaded',timeout:25000});await page.waitForTimeout(2500);await shot('cold-assets-throttled');
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await page.waitForTimeout(2000);await shot('cold-assets-recovered');
  });
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
  await fs.writeFile(path.join(out,'ui-results.json'),JSON.stringify(results,null,2));
  if(browser)await browser.close();
  if(results.checks.some(c=>c.outcome!=='completed'))process.exitCode=1;
});
