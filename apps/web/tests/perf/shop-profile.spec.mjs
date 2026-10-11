import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
test('profile the first warmed shop entrance',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001');
    localStorage.setItem('village:guide:v1:00000000-0000-4000-8000-000000000001','seen');
  });
  await page.goto('/');
  const canvas=page.locator('.shop-room canvas');
  await expect(canvas).toHaveAttribute('data-shop-warmed','true');
  await page.waitForLoadState('networkidle');
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  await cdp.send('Tracing.start',{categories:'devtools.timeline,v8',transferMode:'ReturnAsStream'});
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-entered','true');
  const transitionMs=Number(await canvas.getAttribute('data-transition-ms'));
  const {profile}=await cdp.send('Profiler.stop');
  const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');
  const {stream}=await done;let trace='';
  while(true){const part=await cdp.send('IO.read',{handle:stream});trace+=part.data;if(part.eof)break;}
  await cdp.send('IO.close',{handle:stream});
  const counts=new Map();profile.samples.forEach((id,i)=>counts.set(id,(counts.get(id)||0)+profile.timeDeltas[i]));
  const top=profile.nodes.map(n=>({function:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber,selfMs:(counts.get(n.id)||0)/1000})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,40);
  const events=JSON.parse(trace).traceEvents.filter(e=>e.ph==='X'&&e.dur>15000).sort((a,b)=>b.dur-a.dur).slice(0,30).map(e=>({name:e.name,ms:e.dur/1000,args:e.args}));
  mkdirSync('artifacts/integ018',{recursive:true});
  writeFileSync('artifacts/integ018/shop-profile.json',JSON.stringify({transitionMs,top,events},null,2));
  console.log(JSON.stringify({transitionMs,top:top.slice(0,12)},null,2));
});
