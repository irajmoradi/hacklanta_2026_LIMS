// Same hardware/viewport/network/rAF method as INTEG-015, with draw-call sampling.
// Serve both captured builds using integ015-server.mjs (fixture-only API).
import {chromium} from '@playwright/test';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {cpus} from 'node:os';
const snapshot=()=>cpus().reduce((s,c)=>({idle:s.idle+c.times.idle,total:s.total+Object.values(c.times).reduce((a,b)=>a+b,0)}),{idle:0,total:0});
const start=snapshot();
const stage=process.env.PERF_STAGE || 'after';
const dir=`artifacts/integ018/${stage}`;
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--disable-frame-rate-limit','--disable-gpu-vsync','--enable-gpu','--ignore-gpu-blocklist','--use-angle=d3d11']});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await context.addInitScript(()=>{
  localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001');
  localStorage.setItem('village:guide:v1:00000000-0000-4000-8000-000000000001','seen');
  const counts=new Map();
  for(const kind of [WebGLRenderingContext,WebGL2RenderingContext]) for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
    const original=kind.prototype[name];
    if(!original)continue;
    kind.prototype[name]=function(...args){counts.set(this,(counts.get(this)||0)+1);return original.apply(this,args);};
  }
  window.perfFrames=[];
  let last;
  const tick=now=>{
    let calls=0;
    for(const [gl,count] of counts)if(gl.canvas.closest('.scene'))calls+=count;
    if(last!==undefined)window.perfFrames.push({ms:now-last,calls});
    counts.clear();last=now;requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const page=await context.newPage();
const result={stage,viewport:[1440,1000],dpr:1,mbps:25,latencyMs:20,errors:[]};
const build=process.env.PERF_BUILD || `artifacts/integ018/${stage==='before'?'before':'final'}-build`;
const entry=readFileSync(`${build}/index.html`,'utf8').match(/src="(\/assets\/[^" ]+\.js)"/)[1];
result.mainGzipBytes=gzipSync(readFileSync(`${build}${entry}`)).length;
result.sourceRevision=process.env.PERF_REVISION || 'unrecorded';
page.on('pageerror',error=>result.errors.push(error.message));
const cdp=await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:20,downloadThroughput:25e6/8,uploadThroughput:25e6/8});
let bytes=0;
cdp.on('Network.loadingFinished',event=>bytes+=event.encodedDataLength);
async function sample(name){
  await page.evaluate(()=>{window.perfFrames=[];});
  await page.waitForTimeout(5000);
  result[name]=await page.evaluate(()=>{
    const frames=window.perfFrames;
    const rendered=frames.filter(f=>f.calls>0);
    const calls=rendered.map(f=>f.calls).sort((a,b)=>a-b);
    const canvas=document.querySelector('.scene canvas');
    return {fps:1000*frames.length/frames.reduce((s,f)=>s+f.ms,0),frames:frames.length,
      canvas:[canvas.width,canvas.height],cssSize:[canvas.clientWidth,canvas.clientHeight],
      renderedFrames:rendered.length,drawCallsMedian:calls[Math.floor(calls.length/2)],drawCallsMax:calls.at(-1)};
  });
  await page.screenshot({path:`${dir}/${name}.png`});
}
try {
  await cdp.send('Network.clearBrowserCache');
  await page.goto(process.env.PERF_URL || 'http://127.0.0.1:16819');
  await page.getByTestId('villager-Iraj').waitFor({timeout:60000});
  if(await page.getByRole('dialog').count())throw new Error('A dialog obscures the benchmark scene');
  result.renderedInteractiveMs=await page.evaluate(()=>performance.now());
  await page.waitForTimeout(15000);
  result.coldBytes=bytes;
  result.renderer=await page.locator('.scene canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2');return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);});
  await sample('overview');
  await page.mouse.move(1000,450);
  for(let i=0;i<36;i++){await page.mouse.wheel(0,-100);await page.waitForTimeout(40);}
  await page.waitForTimeout(3000);
  await sample('street');
  result.quality=await page.locator('.scene').getAttribute('data-quality');
  bytes=0;
  await page.reload();
  await page.getByTestId('villager-Iraj').waitFor();
  await page.waitForTimeout(15000);result.repeatBytes=bytes;
  if(result.errors.length || !result.renderer.includes('RTX 5090'))process.exitCode=1;
} catch(error) {result.failure=String(error);process.exitCode=1;}
finally {
  const end=snapshot();result.hostCpuBusyFraction=1-(end.idle-start.idle)/(end.total-start.total);
  writeFileSync(`${dir}/metrics.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));await browser.close();
}
