// Run from apps/web through ops/remote_run.sh. No writes are sent to the target.
const {createRequire}=require('node:module'),path=require('node:path'),fs=require('node:fs');
const req=createRequire(path.resolve('package.json'));
const {chromium,devices}=req('playwright');
const axeSource=fs.readFileSync(req.resolve('axe-core/axe.min.js'),'utf8');
const out=path.resolve('../../docs/qa/QA-012/screenshots');fs.mkdirSync(out,{recursive:true});
const report={started:new Date().toISOString(),cases:[],blocked:{},errors:[]};
const save=()=>fs.writeFileSync(path.join(out,process.env.QA_RESULT_FILE||'audit.json'),JSON.stringify(report,null,2));
async function guard(context){await context.route('**/*',r=>{const q=r.request();if(!['GET','HEAD','OPTIONS'].includes(q.method())){const k=q.method()+' '+new URL(q.url()).pathname;report.blocked[k]=(report.blocked[k]||0)+1;return r.abort('blockedbyclient')}return r.continue()})}
async function shot(p,name){try{await p.screenshot({path:path.join(out,name+'.png'),scale:'css',timeout:20000,animations:'disabled',style:'img,canvas,.head-portrait,.conversation-log,.message-body,.message-text,.message-preview,input[type="tel"]{visibility:hidden!important}'});return null}catch(e){const error=name+': '+e.message.slice(0,350);report.errors.push(error);save();return error}}
async function measure(p,label,scan=true){
 const data=await p.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
 const surface=[...document.querySelectorAll('dialog[open]')].at(-1)||document.querySelector('.profile-panel,.widget-popout,.alerts-dropdown');
 const head=surface?[...surface.querySelectorAll('.modal-header')].find(e=>e.getBoundingClientRect().width>0):null;
 const close=head?.querySelector('button');
 const dock=document.querySelector('.action-dock');
 return {viewport:{w:innerWidth,h:innerHeight},document:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},surface:surface?{rect:rect(surface),scrollH:surface.scrollHeight,clientH:surface.clientHeight,scrollW:surface.scrollWidth,clientW:surface.clientWidth}:null,header:head?rect(head):null,close:close?{...rect(close),disabled:close.disabled}:null,dock:dock?{...rect(dock),bottom:getComputedStyle(dock).bottom}:null,canvas:!!document.querySelector('canvas')};
 });
 const entry={label,...data};report.cases.push(entry);console.log('CASE '+label);save();
 if(scan){try{await p.evaluate(axeSource);const a=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,count:v.nodes.length}))}});entry.axe=a}catch(e){entry.axeError=e.message.slice(0,250)}}
 const surface=p.locator('dialog[open]').last();
 if(await surface.count()){
   entry.focus=[];
   for(let i=0;i<10;i++){await p.keyboard.press('Tab');entry.focus.push(await p.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return {tag:e.tagName,label:e.getAttribute('aria-label')||e.getAttribute('name')||e.id,inside:!!e.closest('dialog[open]'),outline:s.outlineStyle+' '+s.outlineWidth,visible:e.getBoundingClientRect().bottom<=innerHeight}}))}
   entry.scroll=await surface.evaluate(el=>{const list=[el,...el.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+10&&/(auto|scroll)/.test(getComputedStyle(e).overflowY));for(const e of list)e.scrollTop=e.scrollHeight;const h=[...el.querySelectorAll('.modal-header')].find(e=>e.getBoundingClientRect().width>0),b=h?.querySelector('button'),r=b?.getBoundingClientRect();return {containers:list.map(e=>({class:e.className,top:e.scrollTop,max:e.scrollHeight-e.clientHeight})),close:r?{top:r.top,bottom:r.bottom,visible:r.width>0&&r.top>=0&&r.bottom<=innerHeight}:null}});
 }
 entry.screenshotError=await shot(p,label);save();return entry;
}
async function close(p,entry){await p.keyboard.press('Escape');await p.waitForTimeout(300);entry.escapeClosed=await p.locator('dialog[open]').count()===0;if(!entry.escapeClosed){const b=p.locator('dialog[open]').last().getByRole('button',{name:/^Close/}).first();if(await b.isEnabled().catch(()=>false))await b.click({timeout:4000});}save()}
const panels=[['checkin','Check in'],['village','Village'],['goal','My goal'],['week','Weekly review'],['compete','Compete'],['mayor','Mayor'],['shop','Shop'],['settings','Open Settings'],['inbox','Inbox'],['agents','AI at work'],['gazette','Read the Gazette at the plaza notice board'],['profile','My profile']];
module.exports={guard,shot,measure,close,report,save};
if(require.main===module)(async()=>{
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});report.browser=browser.version();
for(const [device,size] of [['iPhone 14',{width:390,height:844}],['Pixel 7',devices['Pixel 7'].viewport]]){
 const ctx=await browser.newContext({...devices[device],viewport:size,ignoreHTTPSErrors:true,reducedMotion:'reduce'});await guard(ctx);
 const p=await ctx.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>report.errors.push(e.message.slice(0,200)));
 await p.goto('https://207-246-81-187.sslip.io',{waitUntil:'domcontentloaded',timeout:60000});await p.locator('.demo-seat-grid button').first().waitFor({timeout:60000});
 const seat=await measure(p,device.replaceAll(' ','')+'-seat');await p.locator('.demo-seat-grid button').first().click();await p.waitForTimeout(2000);
 for(const orientation of ['portrait','landscape']){
  await p.setViewportSize(orientation==='portrait'?size:{width:size.height,height:size.width});const prefix=device.replaceAll(' ','')+'-'+orientation;await p.waitForTimeout(500);
  await measure(p,prefix+'-town',true);
  for(const [key,name] of panels){
   try{await p.getByRole('button',{name,exact:true}).first().click();await p.waitForTimeout(key==='profile'||key==='settings'?2000:700);const entry=await measure(p,prefix+'-'+key);
    if(key==='village'){await p.getByRole('button',{name:'Our group photo',exact:true}).click();await p.waitForTimeout(500);const sub=await measure(p,prefix+'-group-photo');await close(p,sub)}
    else if(key==='settings'){await p.getByRole('button',{name:'Refresh my face check',exact:true}).click();const sub=await measure(p,prefix+'-face');await close(p,sub)}
    else if(key==='profile'){
     for(const tab of ['Outfit','House','Rewards','Activity']){await p.getByRole('tab',{name:tab,exact:true}).click();await p.waitForTimeout(400);await measure(p,prefix+'-profile-'+tab.toLowerCase(),orientation==='portrait');}
     await close(p,entry);
    }else await close(p,entry);
   }catch(e){report.errors.push(prefix+'-'+key+': '+e.message.slice(0,220));await p.keyboard.press('Escape');await p.waitForTimeout(300);save()}
  }
  const extras=[['join',async()=>p.getByRole('combobox',{name:'Village',exact:true}).selectOption('__join')],['alerts',async()=>p.getByRole('button',{name:/^Alerts,/}).click()],['dashboard-popout',async()=>p.getByRole('button',{name:'Pop out Your corner',exact:true}).click()]];
  for(const [key,open] of extras){try{await open();await p.waitForTimeout(500);const e=await measure(p,prefix+'-'+key);await close(p,e)}catch(e){report.errors.push(prefix+'-'+key+': '+e.message.slice(0,180));await p.keyboard.press('Escape');save()}}
 }
 await ctx.close();
}
report.finished=new Date().toISOString();save();await browser.close();
})().catch(e=>{report.errors.push(e.stack);save();console.error(e);process.exit(1)});
