process.env.QA_RESULT_FILE='touch.json';
const {guard,shot,report,save}=require('./audit.cjs');
const {createRequire}=require('node:module'),path=require('node:path');
const req=createRequire(path.resolve('package.json'));const {chromium,devices}=req('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await browser.newContext({...devices['iPhone 14'],viewport:{width:844,height:390},ignoreHTTPSErrors:true,reducedMotion:'reduce'});await guard(ctx);await ctx.addInitScript(()=>localStorage.setItem('village:seat:live','13370000-0000-4000-8000-000000000001'));
 const p=await ctx.newPage();p.setDefaultTimeout(15000);await p.goto('https://207-246-81-187.sslip.io',{waitUntil:'domcontentloaded',timeout:60000});await p.getByRole('button',{name:'Reset camera',exact:true}).waitFor({timeout:60000});
 if(await p.getByRole('button',{name:'Collapse dashboard',exact:true}).isVisible())await p.getByRole('button',{name:'Collapse dashboard',exact:true}).click();
 await p.getByRole('button',{name:'Reset camera',exact:true}).click();await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(1500);
 const labels=()=>p.getByRole('button',{name:/^Open .* house profile$/}).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {name:e.getAttribute('aria-label'),x:r.x,y:r.y}}));
 const point=await p.evaluate(()=>{for(const xf of [.2,.25,.3,.35,.65,.7,.75,.8])for(const yf of [.4,.45,.5,.55]){const x=Math.round(innerWidth*xf),y=Math.round(innerHeight*yf);if([-25,0,25].every(d=>document.elementFromPoint(x+d,y+d)?.tagName==='CANVAS'))return {x,y}}return null});
 if(!point)throw Error('No canvas-only pair of pinch start points found');
 report.touch={point,before:await labels(),hitTest:await p.evaluate(({x,y})=>[-25,0,25].map(d=>document.elementFromPoint(x+d,y+d)?.tagName),point)};
 const cdp=await ctx.newCDPSession(p);const points=d=>[{x:point.x-d,y:point.y-d,id:1},{x:point.x+d,y:point.y+d,id:2}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(25)});
 for(let i=1;i<=4;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(25+i*4)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(1000);report.touch.after=await labels();report.touch.viewport=await p.evaluate(()=>({scale:visualViewport.scale,scrollX,scrollY}));
 const common=report.touch.before.filter(a=>report.touch.after.some(b=>a.name===b.name));if(common.length>=2){const [a,b]=common,aa=report.touch.after.find(e=>e.name===a.name),bb=report.touch.after.find(e=>e.name===b.name);report.touch.projectedSeparationRatio=Math.hypot(aa.x-bb.x,aa.y-bb.y)/Math.hypot(a.x-b.x,a.y-b.y)}
 save();await shot(p,'iPhone14-landscape-pinch-retest');console.log(JSON.stringify(report.touch));await ctx.close();await browser.close();report.finished=new Date().toISOString();save();
})().catch(e=>{report.errors.push(e.stack);save();console.error(e);process.exit(1)});
