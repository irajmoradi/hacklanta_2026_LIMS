import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const dir='artifacts/perf002/shop-trace';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--disable-frame-rate-limit','--disable-gpu-vsync']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001'));
  await page.goto(process.env.PERF_URL || 'http://127.0.0.1:5186');await page.waitForTimeout(15000);
  await page.getByRole('button',{name:'My profile',exact:true}).click();await page.waitForTimeout(1200);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  await cdp.send('Tracing.start',{categories:'devtools.timeline,v8',transferMode:'ReturnAsStream'});
  await page.getByRole('button',{name:'Close profile',exact:true}).click();
  await page.getByRole('button',{name:'Shop',exact:true}).click();await page.waitForTimeout(2000);
  const {profile}=await cdp.send('Profiler.stop');
  const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');
  const {stream}=await done;let trace='';while(true){const part=await cdp.send('IO.read',{handle:stream});trace+=part.data;if(part.eof)break;}await cdp.send('IO.close',{handle:stream});
  const counts=new Map();profile.samples.forEach((id,i)=>counts.set(id,(counts.get(id)||0)+profile.timeDeltas[i]));
  const top=profile.nodes.map(n=>({function:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber,selfMs:(counts.get(n.id)||0)/1000})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,25);
  const events=JSON.parse(trace).traceEvents.filter(e=>e.ph==='X' && e.dur>15000).sort((a,b)=>b.dur-a.dur).slice(0,30).map(e=>({name:e.name,ms:e.dur/1000,args:e.args}));
  writeFileSync(`${dir}/cpu-profile.json`,JSON.stringify(profile));writeFileSync(`${dir}/timeline.json.gz`,gzipSync(trace));
  writeFileSync(`${dir}/summary.json`,JSON.stringify({top,events},null,2));console.log(JSON.stringify({top:top.slice(0,8),events},null,2));
}finally{await browser.close();}
