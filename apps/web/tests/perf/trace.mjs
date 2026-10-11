import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const stage=process.env.PERF_STAGE || 'after',dir=`artifacts/perf002/${stage}`;
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--disable-frame-rate-limit','--disable-gpu-vsync']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001'));
  const cdp=await page.context().newCDPSession(page);
  const url=new URL(process.env.PERF_URL || 'http://127.0.0.1:5186');
  if(process.env.PERF_LOW==='1'){url.searchParams.set('quality','low');await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Emulation.setHardwareConcurrencyOverride',{hardwareConcurrency:4});}
  await page.goto(url.href);
  await page.waitForTimeout(15000);
  const quality=await page.locator('.scene').getAttribute('data-quality');
  await cdp.send('Performance.enable');
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  const before=await cdp.send('Performance.getMetrics');
  await page.waitForTimeout(5000);
  const after=await cdp.send('Performance.getMetrics');
  const {profile}=await cdp.send('Profiler.stop');
  const counts=new Map();
  profile.samples.forEach((id,i)=>counts.set(id,(counts.get(id)||0)+profile.timeDeltas[i]));
  const top=profile.nodes.map(n=>({function:n.callFrame.functionName,url:n.callFrame.url.replace(/^.*\/assets\//,'assets/'),line:n.callFrame.lineNumber,selfMs:(counts.get(n.id)||0)/1000})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,40);
  const delta=Object.fromEntries(after.metrics.filter(m=>/Duration|Count/.test(m.name)).map(m=>[m.name,m.value-(before.metrics.find(b=>b.name===m.name)?.value||0)]));
  writeFileSync(`${dir}/cpu-profile.json`,JSON.stringify(profile));
  writeFileSync(`${dir}/trace-summary.json`,JSON.stringify({seconds:5,quality,delta,top},null,2));
  console.log(JSON.stringify({delta,top:top.slice(0,12)},null,2));
}finally{await browser.close();}
