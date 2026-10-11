import {test, expect} from '@playwright/test';

test('two browser contexts: movement fan-out latency', async ({browser}, info) => {
  const contexts = await Promise.all([0,1].map(() => browser.newContext()));
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  try {
    for (const page of pages) {
      await page.goto('/tests/latency.html');
      await page.evaluate(async () => {
        const w = window as any;
        const {Overworld}=await import('/src/api/overworld.ts' as string);
        w.world=new Overworld();w.rendered=[];
        const render=()=>{
          const s=w.world.sample('13370000-0000-4000-8000-000000000001');
          const latest=w.world.avatars.get('13370000-0000-4000-8000-000000000001');
          if(s && latest && Math.abs(s.heading-latest.heading)<.00001 && !w.rendered.some((r:any)=>r.seq===s.seq))w.rendered.push({seq:s.seq,heading:s.heading,at:Date.now()});
          requestAnimationFrame(render);
        };requestAnimationFrame(render);
        w.events = [];
        w.socket = new WebSocket(`ws://${location.host}/api/villages/13370000-0000-4000-8000-000000000000/live`);
        await new Promise<void>(resolve => {
          w.socket.onopen = () => w.socket.send(JSON.stringify({'X-Demo-User':'13370000-0000-4000-8000-000000000001',world_version:2}));
          w.socket.onmessage = (e:MessageEvent) => {
            const data = JSON.parse(e.data); w.events.push({data, at:Date.now()});
            if(['world_snapshot','world_delta'].includes(data.type))w.world.apply(data);
            if(data.type === 'world_snapshot') {w.avatar=data.avatars.find((s:any)=>s.user_id.endsWith('001')); resolve();}
          };
        });
      });
    }
    const samples:number[]=[], rendered:number[]=[];
    for(let i=0;i<30;i++) {
      await pages[0].waitForTimeout(110);
      const sent = await pages[0].evaluate(i => {
        const w=window as any, at=Date.now();
        w.socket.send(JSON.stringify({type:'intent',request_id:`latency-${i}`,action:'move',x:w.avatar.x+(i%2)*.1,z:w.avatar.z,heading:i/100,moving:true}));
        return at;
      },i);
      const received = await pages[1].evaluate(async ({sent,i}) => {
        const w=window as any;
        return new Promise<number>((resolve,reject)=>{
          const start=Date.now();const poll=()=>{
            const e=w.events.find((e:any)=>e.at>=sent && ['world_delta','world_snapshot'].includes(e.data.type) && e.data.avatars.some((s:any)=>s.user_id.endsWith('001') && Math.abs(s.heading-i/100)<.00001));
            if(e)resolve(e.at);else if(Date.now()-start>3000)reject(new Error('Missing movement '+JSON.stringify(w.events.slice(-5))));else setTimeout(poll,1);
          };poll();
        });
      },{sent,i});
      samples.push(received-sent);
      rendered.push(await pages[1].evaluate(async({sent,i})=>{
        const w=window as any;
        return new Promise<number>((resolve,reject)=>{
          const start=Date.now();const poll=()=>{
            const frame=w.rendered.find((r:any)=>r.at>=sent && Math.abs(r.heading-i/100)<.00001);
            if(frame)resolve(frame.at-sent);else if(Date.now()-start>3000)reject(new Error('Missing rendered movement'));else setTimeout(poll,1);
          };poll();
        });
      },{sent,i}));
    }
    samples.sort((a,b)=>a-b);
    rendered.sort((a,b)=>a-b);
    const result={samples,p50:samples[14],p95:samples[28],rendered,renderP95:rendered[28]};
    console.log('MOVEMENT_LATENCY',JSON.stringify(result));
    await info.attach('latency.json',{body:JSON.stringify(result),contentType:'application/json'});
    expect(result.p95).toBeLessThan(150);
    expect(result.renderP95).toBeLessThan(150);
  } finally {await Promise.all(contexts.map(c=>c.close()));}
});
