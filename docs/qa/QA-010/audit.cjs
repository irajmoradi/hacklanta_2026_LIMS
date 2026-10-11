// QA-010: live Chromium traversal. Requires an already running stack; never starts providers.
const { chromium } = require(process.env.QA_PLAYWRIGHT || 'C:/Users/mourn/Downloads/hacklanta/apps/web/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const out = __dirname;
const seats = (process.env.QA_SEATS || 'Iraj,Lance,Stefanny,Maya,Mario').split(',');
const results = { started: new Date().toISOString(), steps: [], network: [], console: [], blocked: [] };
const save = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
let seat, stage;
(async () => {
  const browser = await chromium.launch({ headless: true });
  results.browser = browser.version();
  for (seat of seats) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    // Only seat/presence/read receipts and explicitly selected reversible test operations may mutate.
    await page.route('**/api/**', async route => {
      const r = route.request(), url = new URL(r.url()).pathname;
      const allowed = ['GET','HEAD','OPTIONS'].includes(r.method()) || /\/demo\/seat$|\/presence\/heartbeat$|\/messages\/[^/]+\/read$/.test(url);
      if (allowed) return route.continue();
      results.blocked.push({seat,stage,method:r.method(),url});
      await route.abort('blockedbyclient');
    });
    page.on('console', m => { if (['error','warning'].includes(m.type())) results.console.push({seat,stage,type:m.type(),text:m.text().slice(0,1800)}); });
    page.on('pageerror', e => results.console.push({seat,stage,type:'pageerror',text:e.message}));
    page.on('requestfinished', r => {
      const timing = r.timing(), ms = Math.round(timing.responseEnd);
      r.response().then(response => { if(response && (response.status() >=400 || ms>1000)) { results.network.push({seat,stage,method:r.method(),url:r.url().replace(/\?.*/,''),status:response.status(),ms}); save(); } });
    });
    page.on('requestfailed', r => results.network.push({seat,stage,url:r.url().replace(/\?.*/,''),failure:r.failure()?.errorText}));
    const shot = async label => {
      // Exclude portraits/private messages from committed evidence.
      await page.screenshot({path:path.join(out,`${seat}-${label}.png`), style:'img, .portrait canvas, [data-lam-host], .conversation-log, input[type="tel"] { visibility: hidden !important; }', mask:[page.locator('.profile-hero .portrait')], maskColor:'#c7c9c1'});
    };
    const close = async () => { const b=page.getByRole('button',{name:'Close dialog',exact:true}); if(await b.isVisible()) {await b.click();await page.waitForTimeout(150);} const p=page.getByRole('button',{name:'Close profile',exact:true}); if(await p.isVisible()) await p.click(); };
    const step = async (name, action) => {
      stage=name; const started=Date.now(); let data;
      try { data=await action(); results.steps.push({seat,stage,status:'pass',ms:Date.now()-started,...data}); }
      catch(e) { results.steps.push({seat,stage,status:'failed',ms:Date.now()-started,error:e.message.slice(0,1800)}); await shot(`${name}-failure`).catch(()=>{}); }
      save(); console.log(`${seat}: ${name}: ${results.steps.at(-1).status}`);
    };
    await step('seat',async()=>{await page.goto('http://127.0.0.1:4173'); await page.locator('.demo-seat-grid button').filter({hasText:seat}).click(); await page.getByText('Connected',{exact:true}).waitFor(); await page.getByRole('button',{name:`Testing as ${seat} · switch`}).waitFor(); await shot('town'); return {identity:await page.getByLabel('Play as').inputValue()};});
    await step('map',async()=>{const canvas=page.locator('canvas').first();const box=await canvas.boundingBox();let x=box.x+box.width*.60,y=box.y+box.height*.48; await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+85,y+35,{steps:12});await page.mouse.up();await page.mouse.wheel(0,-220);await page.mouse.down({button:'right'});await page.mouse.move(x-50,y-30,{steps:12});await page.mouse.up({button:'right'});await shot('map');return {canvases:await page.locator('canvas').count(),labels:await page.locator('[data-testid^="villager-"]').evaluateAll(es=>es.map(e=>({id:e.getAttribute('data-testid'),head:e.getAttribute('data-head-kind'),text:e.textContent}))) };});
    await step('profile',async()=>{await page.getByRole('button',{name:'My profile',exact:true}).click();await page.getByRole('tab',{name:'Wardrobe',exact:true}).waitFor();await shot('profile');return {tabs:await page.getByRole('tab').allTextContents(),text:await page.locator('.profile-panel').innerText()};});
    await step('wardrobe',async()=>{await page.getByRole('tab',{name:'Wardrobe',exact:true}).click();await page.locator('.shop-intro').waitFor();const colors=page.getByRole('button',{name:/^Colors for /});if(await colors.count()){await colors.first().click();await page.getByLabel('Custom hex',{exact:true}).fill('#zzzzzz');const invalidDisabled=await page.getByRole('button',{name:'Save colors',exact:true}).isDisabled();await page.getByLabel('Custom hex',{exact:true}).fill('#487d6b');await shot('colors');await page.getByRole('button',{name:'Cancel colors'}).click();return {invalidDisabled,text:await page.locator('.equipment-panel').innerText()};}await shot('wardrobe');return {colorsAvailable:false,text:await page.locator('.equipment-panel').innerText()};});
    await step('house',async()=>{await page.getByRole('tab',{name:'House',exact:true}).click();await page.getByRole('button',{name:'Modern',exact:true}).click();await page.getByRole('button',{name:'Preset palette 2',exact:true}).click();await page.getByLabel('Custom hex',{exact:true}).fill('#123456');await page.getByRole('button',{name:'Apply hex',exact:true}).click();await shot('house');return {model:await page.getByLabel('Rotating house preview').getAttribute('data-model'),text:await page.getByRole('region',{name:'House editor'}).innerText()};});
    await close();
    await step('settings',async()=>{await page.getByRole('button',{name:'Open Settings',exact:true}).click();await page.getByLabel('Display name',{exact:true}).waitFor();const toggles=page.getByRole('switch');let states=[];for(let i=0;i<await toggles.count();i++){const t=toggles.nth(i);const before=await t.getAttribute('aria-checked');await t.click();const after=await t.getAttribute('aria-checked');await t.click();states.push({label:await t.getAttribute('aria-label'),before,after});}const checks=page.getByRole('checkbox');for(let i=0;i<await checks.count();i++){const c=checks.nth(i);if(await c.isEnabled()){const original=await c.isChecked();await c.setChecked(!original);await c.setChecked(original);}}await shot('settings');return {states,checkboxes:await checks.count(),text:await page.getByRole('dialog').innerText()};});
    await close();
    for (const [name,button] of [['checkin','Check in'],['goal','My goal'],['week','Weekly review'],['accomplishments','Accomplishments'],['gazette','Gazette'],['mayor','Mayor'],['inbox','Inbox'],['compete','Compete'],['shop','Shop'],['village','Village'],['debug','Debug menu']]) {
      await step(name,async()=>{const b=page.getByRole('button',{name:button,exact:true}); await b.first().click();await page.getByRole('dialog').first().waitFor();await page.waitForTimeout(650);if(name==='checkin'){await page.locator('#checkin-body').fill('QA-010 dry validation; no upload.');const progress=page.getByRole('button',{name:/Goal progress/});if(await progress.isEnabled())await progress.click();}
        if(name==='goal') {await page.locator('#goal-title').fill('QA-010 dry goal draft');}
        if(name==='mayor') {await page.locator('#prayer').fill('QA-010 dry draft; not submitted.');}
        if(name==='inbox'){await page.getByRole('navigation',{name:'Conversations'}).getByRole('button').first().click();await page.locator('#message-text').fill('QA-010 unsent message draft');}
        await shot(name);return {text:name==='inbox'?'Conversation inspected; content intentionally omitted.':await page.getByRole('dialog').first().innerText()};});
      await close();
    }
    await step('seat-persistence',async()=>{await page.reload();await page.getByRole('button',{name:`Testing as ${seat} · switch`}).waitFor();return {pickerVisible:await page.getByRole('heading',{name:'Who are you testing as?'}).isVisible()};});
    await context.close();save();
  }
  await browser.close();save();console.log(JSON.stringify({steps:results.steps.length,failures:results.steps.filter(s=>s.status==='failed').length,network:results.network.length,blocked:results.blocked.length}));
})().catch(e=>{console.error(e);save();process.exitCode=1;});
