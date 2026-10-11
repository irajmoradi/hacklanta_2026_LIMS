// Isolated low-tier diagnosis; the full acceptance gate remains measure.mjs.
import {chromium} from '@playwright/test';
import {cpus} from 'node:os';
import {mkdirSync,writeFileSync} from 'node:fs';
const snap=()=>cpus().reduce((s,c)=>({idle:s.idle+c.times.idle,total:s.total+Object.values(c.times).reduce((a,b)=>a+b,0)}),{idle:0,total:0});
const dir=`artifacts/perf002/${process.env.PERF_STAGE || 'low-isolated'}`;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--disable-frame-rate-limit','--disable-gpu-vsync']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001'));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Emulation.setHardwareConcurrencyOverride',{hardwareConcurrency:4});
 const url=new URL(process.env.PERF_URL || 'http://127.0.0.1:5186');url.searchParams.set('quality','low');await page.goto(url.href);await page.locator('.scene canvas').waitFor();await page.waitForTimeout(15000);
 const before=snap();
 const result=await page.evaluate(async()=>{
  const frames=[];let first,last;
  await new Promise(resolve=>{const tick=now=>{if(first===undefined)first=now;if(last!==undefined)frames.push(now-last);last=now;if(now-first<5000)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
  const gl=document.querySelector('.scene canvas').getContext('webgl2'),extension=gl.getExtension('WEBGL_debug_renderer_info');
  frames.sort((a,b)=>a-b);return {fps:1000*frames.length/frames.reduce((a,b)=>a+b,0),p95Ms:frames[Math.floor(frames.length*.95)],maxMs:frames.at(-1),quality:document.querySelector('.scene').dataset.quality,renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'unknown'};
 });
 const after=snap();Object.assign(result,{viewport:[1440,1000],cpuThrottle:4,errors});result.hostCpuBusyFraction=1-(after.idle-before.idle)/(after.total-before.total);writeFileSync(`${dir}/metrics.json`,JSON.stringify(result,null,2));console.log(result);if(result.fps<45 || result.quality!=='low' || !result.renderer.includes('RTX 5090') || errors.length)process.exitCode=1;
}finally{await browser.close();}
