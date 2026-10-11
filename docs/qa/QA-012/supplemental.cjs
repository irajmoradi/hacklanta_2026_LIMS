process.env.QA_RESULT_FILE='supplemental.json';
const {guard,shot,measure,close,report,save}=require('./audit.cjs');
const {createRequire}=require('node:module'),path=require('node:path');
const req=createRequire(path.resolve('package.json'));const {chromium,devices}=req('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const device of ['iPhone 14','Pixel 7']){
  const size=device==='iPhone 14'?{width:390,height:844}:devices[device].viewport;
  const ctx=await browser.newContext({...devices[device],viewport:size,ignoreHTTPSErrors:true,reducedMotion:'reduce'});await guard(ctx);
  await ctx.addInitScript(()=>localStorage.setItem('village:seat:live','13370000-0000-4000-8000-000000000001'));
  const p=await ctx.newPage();p.setDefaultTimeout(7000);p.on('response',r=>{if(r.status()>=400)(report.httpErrors??=[]).push({method:r.request().method(),path:new URL(r.url()).pathname,status:r.status()})});await p.goto('https://207-246-81-187.sslip.io',{waitUntil:'domcontentloaded',timeout:60000});await p.getByRole('button',{name:'Check in',exact:true}).waitFor({timeout:60000});
  for(const orientation of ['portrait','landscape']){
   await p.setViewportSize(orientation==='portrait'?size:{width:size.height,height:size.width});const prefix='extra-'+device.replaceAll(' ','')+'-'+orientation;
   if(await p.getByRole('button',{name:'Reopen dashboard',exact:true}).isVisible())await p.getByRole('button',{name:'Reopen dashboard',exact:true}).click();
   await p.evaluate(()=>scrollTo(0,0));
   (report.dockHitTests??=[]).push({label:prefix,buttons:await p.locator('.action-dock button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:e.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height,hit:top?.closest('button')?.getAttribute('aria-label')||top?.closest('button')?.innerText||top?.className,receivesPointer:top===e||e.contains(top)}}))});save();await shot(p,prefix+'-town-before-keyboard');
   if(device==='iPhone 14'){
    const safe=await ctx.newCDPSession(p);
    try{await safe.send('Emulation.setSafeAreaInsetsOverride',{insets:{bottom:34}});
     const geometry=await p.evaluate(()=>{const probe=document.createElement('div');probe.style.paddingBottom='env(safe-area-inset-bottom)';document.body.append(probe);const inset=getComputedStyle(probe).paddingBottom;probe.remove();const dock=document.querySelector('.action-dock'),r=dock.getBoundingClientRect();return {inset,dockBottomCSS:getComputedStyle(dock).bottom,actualGap:innerHeight-r.bottom,buttonBottoms:[...dock.querySelectorAll('button')].map(e=>({label:e.getAttribute('aria-label'),bottom:e.getBoundingClientRect().bottom})),viewportH:innerHeight}});
     (report.safeArea??=[]).push({label:prefix,...geometry});save();
     await p.evaluate(()=>{const e=document.createElement('div');e.id='qa-inset-overlay';e.textContent='QA: simulated 34px bottom safe area';e.style.cssText='position:fixed;bottom:0;left:0;right:0;height:34px;background:#ff880066;color:#151515;font:12px sans-serif;z-index:99999;pointer-events:none';document.body.append(e)});await shot(p,prefix+'-safe-area');await p.locator('#qa-inset-overlay').evaluate(e=>e.remove());
    }catch(e){report.errors.push('safe-area: '+e.message)}finally{await safe.send('Emulation.setSafeAreaInsetsOverride',{insets:{}}).catch(()=>{})}
   }
   await p.getByRole('link',{name:'Village home',exact:true}).focus();const walk=[];
   for(let n=0;n<40;n++){await p.keyboard.press('Tab');walk.push(await p.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,label:e.getAttribute('aria-label')||e.getAttribute('name')||e.id,outline:s.outlineStyle+' '+s.outlineWidth,rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom}}}))}
   (report.keyboardWalk??=[]).push({label:prefix,walk});save();
   // Palette-only probe; no application toast/event is triggered.
   report.toastPalette=await p.evaluate(()=>{const node=document.createElement('div');node.className='toast-viewport';node.innerHTML='<article class="village-toast"><div class="toast-content"><div class="toast-copy"><strong>QA palette probe</strong><p>CSS contrast only</p></div></div></article>';document.body.append(node);const pick=selector=>{const s=getComputedStyle(node.querySelector(selector));return {color:s.color,background:s.backgroundColor,fontSize:s.fontSize}};const value={card:pick('.village-toast'),title:pick('strong'),detail:pick('p')};node.remove();return value});save();
   const step=async(name,fn)=>{try{await p.evaluate(()=>scrollTo(0,0));await fn();const e=await measure(p,prefix+'-'+name);await close(p,e)}catch(e){report.errors.push(prefix+'-'+name+': '+e.message.slice(0,500));await p.keyboard.press('Escape');save()}};
   if(orientation==='landscape')for(const [key,name] of [['checkin','Check in'],['village','Village']])await step(key+'-keyboard',async()=>{await p.getByRole('button',{name,exact:true}).focus();await p.keyboard.press('Enter')});
   await step('seat-picker',async()=>p.getByRole('button',{name:/^Testing as /}).click());
   await step('gazette',async()=>{await p.locator('.dashboard [data-widget="gazette"] .headline-ticker').click();await p.waitForTimeout(1000)});
   if(device==='iPhone 14'&&orientation==='portrait')await step('agent-log-keyboard',async()=>{await p.getByRole('button',{name:'AI at work',exact:true}).click();await p.waitForTimeout(1500);const samples=[];for(let i=0;i<24;i++){await p.keyboard.press('Tab');samples.push(await p.evaluate(()=>({tag:document.activeElement.tagName,class:document.activeElement.className,inLog:!!document.activeElement.closest('.agent-log')})))}report.agentLogKeyboard={samples,geometry:await p.locator('.agent-log').evaluate(e=>({tabIndex:e.tabIndex,clientH:e.clientHeight,scrollH:e.scrollHeight,focusableChildren:e.querySelectorAll('button,a,input,select,textarea,[tabindex]').length}))};save()});
   await step('chorus',async()=>{await p.getByRole('button',{name:'Everyone says it',exact:true}).click();await p.waitForTimeout(1000)});
   await step('accomplishments',async()=>{await p.getByRole('button',{name:'Pop out Around the village',exact:true}).click();await p.getByRole('button',{name:'Accomplishments',exact:true}).click();await p.waitForTimeout(700)});await p.keyboard.press('Escape');await p.waitForTimeout(300);
   await step('create-competition',async()=>{await p.getByRole('button',{name:'Compete',exact:true}).click();await p.locator('.arena-create-banner').click()});
   await step('profile-initial',async()=>{await p.getByRole('button',{name:'My profile',exact:true}).click();await p.waitForTimeout(1800);(report.profileGeometry??=[]).push({label:prefix,geometry:await p.evaluate(()=>['.profile-panel','.profile-panel .head-studio','.profile-tabs','.profile-tab-content'].map(selector=>{const e=document.querySelector(selector);if(!e)return {selector,missing:true};const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {selector,y:r.y,bottom:r.bottom,height:r.height,overflowY:s.overflowY,scrollTop:e.scrollTop,clientH:e.clientHeight,scrollH:e.scrollHeight}}))});save();await shot(p,prefix+'-profile-before-keyboard')});
   await step('house-editor',async()=>{await p.getByRole('button',{name:'My profile',exact:true}).click();await p.getByRole('tab',{name:'House',exact:true}).click();await p.getByRole('button',{name:'Edit my house',exact:true}).click()});
   await step('avatar-editor',async()=>{await p.getByRole('button',{name:'My profile',exact:true}).click();await p.getByRole('tab',{name:'Outfit',exact:true}).click();await p.getByRole('button',{name:'Customize my avatar',exact:true}).click()});
   const cdp=await ctx.newCDPSession(p);const labels=()=>p.getByRole('button',{name:/^Open .* house profile$/}).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y}}));
   await p.getByRole('button',{name:'Collapse dashboard',exact:true}).click().catch(()=>{});
   await p.evaluate(()=>scrollTo(0,0));
   const point=await p.evaluate(()=>{for(const yf of [.5,.4,.6,.3])for(const xf of [.5,.6,.4,.7,.3]){const x=Math.round(innerWidth*xf),y=Math.round(innerHeight*yf);if(document.elementFromPoint(x,y)?.tagName==='CANVAS')return {x,y}}return null});
   if(!point){report.errors.push(prefix+': no unobstructed canvas touch point');save();continue}
   const cx=point.x,cy=point.y;const gesture={label:prefix,before:await labels()};
   gesture.hit=await p.evaluate(({cx,cy})=>{const e=document.elementFromPoint(cx,cy);return {tag:e?.tagName,class:e?.className}},{cx,cy});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+i*7,y:cy+i*2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(700);gesture.afterPan=await labels();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-25,y:cy-25,id:1},{x:cx+25,y:cy+25,id:2}]});for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-25-i*7,y:cy-25-i*7,id:1},{x:cx+25+i*7,y:cy+25+i*7,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(700);gesture.afterPinch=await labels();gesture.viewport=await p.evaluate(()=>({scale:visualViewport.scale,scrollX,scrollY}));
   (report.gestures??=[]).push(gesture);save();await shot(p,prefix+'-touch');await p.getByRole('button',{name:'Reset camera',exact:true}).click();await p.getByRole('button',{name:'Reopen dashboard',exact:true}).click().catch(()=>{});
  }
  await ctx.close();
 }
 await browser.close();report.finished=new Date().toISOString();save();
})().catch(e=>{report.errors.push(e.stack);save();console.error(e);process.exit(1)});
