const {createRequire}=require('node:module'),path=require('node:path'),fs=require('node:fs');
const req=createRequire(path.resolve('package.json'));const {chromium,devices}=req('playwright');
const out=path.resolve('../../docs/qa/QA-012/screenshots');fs.mkdirSync(out,{recursive:true});
const result={started:new Date().toISOString(),runs:[]};const save=()=>fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(result,null,2));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const mode of (process.argv.length>2?process.argv.slice(2):['cold','slow3g','slow-api'])){
  const r={mode,blocked:0,resources:[],errors:[]};result.runs.push(r);
  const ctx=await browser.newContext({...devices['iPhone 14'],viewport:{width:390,height:844},ignoreHTTPSErrors:true,reducedMotion:'reduce'});
  await ctx.addInitScript(()=>{localStorage.setItem('village:seat:live','13370000-0000-4000-8000-000000000001');localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001')});
  await ctx.route('**/*',async route=>{const q=route.request();if(!['GET','HEAD','OPTIONS'].includes(q.method())){r.blocked++;return route.abort('blockedbyclient')}if(mode==='slow-api'&&new URL(q.url()).pathname.startsWith('/api/'))await new Promise(resolve=>setTimeout(resolve,4000));try{await route.continue()}catch{}});
  const p=await ctx.newPage();p.setDefaultTimeout(6000);const cdp=await ctx.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  if(mode==='slow3g'){r.throttle={latencyMs:400,downloadBytesPerSecond:50000,uploadBytesPerSecond:50000};await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:50000,uploadThroughput:50000,connectionType:'cellular3g'});}
  const resources=new Map();let received=0;cdp.on('Network.dataReceived',e=>received+=e.encodedDataLength);
  cdp.on('Network.responseReceived',e=>{if(/^https?:/.test(e.response.url))resources.set(e.requestId,{path:new URL(e.response.url).pathname,type:e.type,status:e.response.status,encoded:0,mime:e.response.mimeType})});
  cdp.on('Network.loadingFinished',e=>{const x=resources.get(e.requestId);if(x){x.encoded=e.encodedDataLength;x.finished=true}});
  const start=Date.now();console.log('PERF '+mode+' starting');
  try{await p.goto('https://207-246-81-187.sslip.io',{waitUntil:'domcontentloaded',timeout:180000});r.domContentLoadedWallMs=Date.now()-start;
   await p.getByRole('button',{name:'Check in',exact:true}).waitFor({timeout:60000});r.townControlsVisibleMs=Date.now()-start;
   await p.getByRole('button',{name:'Check in',exact:true}).click();await p.locator('dialog[open]').waitFor({timeout:15000});r.interactiveDialogMs=Date.now()-start;await p.keyboard.press('Escape');
   await p.waitForTimeout(8000);r.modeBadge=await p.locator('.mode-badge').innerText();
   r.timing=await p.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(e=>({domContentLoaded:e.domContentLoadedEventEnd,load:e.loadEventEnd,responseStart:e.responseStart,transfer:e.transferSize})),paint:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime})),canvas:[...document.querySelectorAll('canvas')].map(e=>({w:e.width,h:e.height})),scripts:[...document.scripts].map(e=>new URL(e.src,location.href).pathname)}));
   if(mode==='cold'){
    const labels=()=>p.getByRole('button',{name:/^Open .* house profile$/}).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y}}));
    r.touch={before:await labels()};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:420,id:1}]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:170+i*7,y:420+i*3,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(500);r.touch.afterPan=await labels();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:160,y:400,id:1},{x:220,y:460,id:2}]});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:160-i*7,y:400-i*7,id:1},{x:220+i*7,y:460+i*7,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(500);r.touch.afterPinch=await labels();
    r.touch.viewport=await p.evaluate(()=>({scale:visualViewport.scale,scrollX,scrollY}));
   }
   await p.screenshot({path:path.join(out,'performance-'+mode+'.png'),scale:'css',style:'img,canvas,.head-portrait {visibility:hidden!important}',timeout:20000});
  }catch(e){r.errors.push(e.message.slice(0,400))}
  r.observationMs=Date.now()-start;r.receivedEncodedBodyBytes=received;r.resources=[...resources.values()];r.completedEncodedBytes=r.resources.reduce((s,e)=>s+e.encoded,0);save();console.log('PERF '+mode+' '+JSON.stringify({time:r.observationMs,interactive:r.interactiveDialogMs,bytes:r.completedEncodedBytes,mode:r.modeBadge,errors:r.errors}));await ctx.close();
 }
 await browser.close();result.finished=new Date().toISOString();save();
})().catch(e=>{console.error(e);save();process.exit(1)});
