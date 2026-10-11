// Run against a production preview, optionally through PERF_URL (a tunnel).
// Never calls generation endpoints. Outputs contain fixture screenshots and timings only.
import {chromium} from '@playwright/test';
import {mkdirSync, writeFileSync, readFileSync, readdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {cpus} from 'node:os';

const cpuSnapshot=()=>cpus().reduce((sum,cpu)=>({idle:sum.idle+cpu.times.idle,total:sum.total+Object.values(cpu.times).reduce((a,b)=>a+b,0)}),{idle:0,total:0});
const hostStart=cpuSnapshot();

const stage = process.env.PERF_STAGE || 'after';
const dir = `artifacts/integ015/${stage}`;
mkdirSync(dir, {recursive:true});
const browser = await chromium.launch({headless:false, args:['--disable-frame-rate-limit', '--disable-gpu-vsync']});
const context = await browser.newContext({viewport:{width:1440,height:1000}, deviceScaleFactor:1});
const initialize=() => {
  localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001');
  window.perfFrames = [];
  let last;
  const tick = now => {if(last !== undefined) window.perfFrames.push({at:now,ms:now-last});last=now;requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
};
await context.addInitScript(initialize);
let page = await context.newPage();
page.setDefaultTimeout(15000);
let cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:20,downloadThroughput:25e6/8,uploadThroughput:25e6/8});
let transferred=0;
cdp.on('Network.loadingFinished', e => transferred+=e.encodedDataLength);
const errors=[]; const consoleErrors=[];
page.on('console', m => {if(m.type()==='error'|| /context lost/i.test(m.text()))consoleErrors.push(m.text());});
page.on('pageerror',e=>errors.push(e.message));
const stats=async()=>page.evaluate(()=>{
  const f=window.perfFrames.map(f=>f.ms).sort((a,b)=>a-b);
  return {fps:1000*f.length/f.reduce((a,b)=>a+b,0),p95Ms:f[Math.floor(f.length*.95)],maxMs:f.at(-1),over50:f.filter(x=>x>50).length,frames:f.length};
});
const reset=()=>page.evaluate(()=>{window.perfFrames=[];});
const result={stage, url:process.env.PERF_URL || 'http://127.0.0.1:5186', viewport:[1440,1000],mbps:25,errors,consoleErrors};
try {
  await cdp.send('Network.clearBrowserCache');
  await page.goto(result.url,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'My profile',exact:true}).waitFor();
  await page.locator('.scene canvas').waitFor();
  result.interactiveMs=await page.evaluate(()=>performance.now());
  await page.getByTestId('villager-Iraj').waitFor();
  result.renderedInteractiveMs=await page.evaluate(()=>performance.now());
  await page.waitForTimeout(15000);
  result.coldBytes=transferred;
  result.startup=await stats();
  result.arenaWarmEndMs=await page.evaluate(()=>performance.getEntriesByName('arena-warm-end').at(-1)?.startTime ?? null);
  result.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:new URL(e.name).pathname,bytes:e.encodedBodySize,duration:e.duration})).sort((a,b)=>b.bytes-a.bytes));
  result.renderer=await page.evaluate(()=>{const gl=document.querySelector('.scene canvas').getContext('webgl2');const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown';});
  await reset(); await page.waitForTimeout(5000); result.town=await stats();
  result.townQuality=await page.locator('.scene').getAttribute('data-quality');
  await page.screenshot({path:`${dir}/town.png`});
  result.transitions={};
  async function transition(name,action) {console.log(name);await reset(); await action(); await page.waitForTimeout(1200);result.transitions[name]={...await stats(), contexts:await page.locator('canvas').evaluateAll(canvases=>canvases.map(c=>({parent:c.parentElement?.parentElement?.className,lost:c.getContext('webgl2')?.isContextLost()})))};}
  await transition('profile',async()=>{await page.getByRole('button',{name:'My profile',exact:true}).click();await page.getByRole('button',{name:'Close profile'}).waitFor();});
  await page.screenshot({path:`${dir}/profile.png`});
  await page.getByRole('button',{name:'Close profile'}).click();
  await transition('shop',async()=>{await page.getByRole('button',{name:'Shop',exact:true}).click();await page.getByRole('dialog').waitFor();});
  await transition('farm',async()=>{await page.getByRole('tab',{name:'Farm Store',exact:true}).click();await page.locator('[data-department=farm]').waitFor();});
  await page.keyboard.press('Escape');
  await transition('arena',async()=>{await page.getByRole('button',{name:'Compete',exact:true}).click();await page.locator('.colosseum canvas').waitFor();});
  await transition('townReturn',()=>page.locator('.arena-header').getByRole('button',{name:'← Village',exact:true}).click());
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('tab',{name:'House',exact:true}).click();
  await transition('house',async()=>{await page.getByRole('button',{name:'Go inside',exact:true}).click();await page.locator('.interior-canvas canvas').waitFor();});
  await page.screenshot({path:`${dir}/house.png`});
  await page.keyboard.press('Escape');
  if(await page.getByRole('button',{name:'Close profile'}).isVisible())await page.getByRole('button',{name:'Close profile'}).click();
  await transition('checkin',async()=>{await page.getByRole('button',{name:'Check in',exact:true}).click();await page.getByRole('dialog',{name:'A moment with your villager'}).waitFor();});
  await page.screenshot({path:`${dir}/checkin.png`});
  await transition('checkinReturn',()=>page.keyboard.press('Escape'));
  transferred=0;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'My profile',exact:true}).waitFor();
  await page.waitForTimeout(15000);result.repeatBytes=transferred;
  // A different device profile gets a fresh renderer and storage partition.
  // Keep its audio/unlock state and retained pages independent of the desktop tour.
  await context.close();
  const lowContext=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await lowContext.addInitScript(initialize);page=await lowContext.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));cdp=await lowContext.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:20,downloadThroughput:25e6/8,uploadThroughput:25e6/8});
  result.lowContext='fresh';
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await cdp.send('Emulation.setHardwareConcurrencyOverride',{hardwareConcurrency:4});
  const lowUrl=new URL(result.url);lowUrl.searchParams.set('quality','low');
  await page.goto(lowUrl.href,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'My profile',exact:true}).waitFor();
  await page.waitForTimeout(15000);await reset();const lowHostStart=cpuSnapshot();await page.waitForTimeout(5000);result.low4x=await stats();
  const lowHostEnd=cpuSnapshot();result.lowHostCpuBusyFraction=1-(lowHostEnd.idle-lowHostStart.idle)/(lowHostEnd.total-lowHostStart.total);
  result.lowQuality=await page.locator('.scene').getAttribute('data-quality');
  const build=process.env.PERF_BUILD || 'dist';
  const html=readFileSync(`${build}/index.html`,'utf8');
  const entry=html.match(/src="(\/assets\/[^" ]+\.js)"/)[1];
  result.mainGzipBytes=gzipSync(readFileSync(`${build}${entry}`)).length;
  result.chunks=readdirSync(`${build}/assets`).filter(f=>f.endsWith('.js')).map(name=>({name,gzipBytes:gzipSync(readFileSync(`${build}/assets/${name}`)).length}));
  result.budgets={town:result.town.fps>=100,low4x:result.low4x.fps>=45,interactive:result.interactiveMs<=4000,
    main:result.mainGzipBytes<=600000,cold:result.coldBytes<=8000000,repeat:result.repeatBytes<=500000,
    transitions:Object.values(result.transitions).every(value=>value.maxMs<=50),errors:errors.length===0,
    hardware:result.renderer.includes('RTX 5090'),quality:result.townQuality==='normal' && result.lowQuality==='low',renderedInteractive:result.renderedInteractiveMs<=4000};
  if(process.env.PERF_ASSERT==='1' && Object.values(result.budgets).some(pass=>!pass))process.exitCode=1;
} catch(e) {result.failure=String(e);await page.screenshot({path:`${dir}/failure.png`});process.exitCode=1;}
finally {const hostEnd=cpuSnapshot();result.hostCpuBusyFraction=1-(hostEnd.idle-hostStart.idle)/(hostEnd.total-hostStart.total);writeFileSync(`${dir}/metrics.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,resources:undefined,chunks:undefined},null,2));await browser.close();}
