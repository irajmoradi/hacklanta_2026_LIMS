import {expect,test,type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';

async function tool(page:Page,method:string,...args:any[]){
  return page.evaluate(async({method,args})=>{const m=await import('/tests/overworld-tools.ts' as string);return m[method](...args);},{method,args});
}

test('two seats share drop, chair, ride, idle and gap recovery',async({browser},info)=>{
  // The wrapper reserves DATABASE_URL for its disposable run_<hash> database.
  execFileSync('../api/.venv/bin/python',['-c',`
import os, psycopg
from psycopg.conninfo import conninfo_to_dict
dsn=os.environ['DATABASE_URL']
assert conninfo_to_dict(dsn)['dbname'].startswith('run_')
with psycopg.connect(dsn) as c:
 c.execute("INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key) VALUES ('13370000-0000-4000-8000-000000000000','13370000-0000-4000-8000-000000000001',100000,'weekly_win','overworld-proof') ON CONFLICT DO NOTHING")
 c.execute("UPDATE users SET idle_activity='dancing'")
 c.execute("INSERT INTO village_world(village_id,weather) VALUES ('13370000-0000-4000-8000-000000000000','festival_night') ON CONFLICT(village_id) DO UPDATE SET weather='festival_night',disaster=NULL")
`]);
  const contexts=await Promise.all([1,2].map(async seat=>{
    const c=await browser.newContext({baseURL:info.project.use.baseURL,viewport:{width:1000,height:800},recordVideo:{dir:info.outputPath(`seat-${seat}`),size:{width:1000,height:800}}});
    await c.route('**/*.glb',route=>route.fulfill({status:404,body:''}));
    await c.addInitScript(seat=>{const u=`13370000-0000-4000-8000-00000000000${seat}`;
      localStorage.setItem('village:seat:live',u);localStorage.setItem(`village:last:${u}`,'13370000-0000-4000-8000-000000000000');
      localStorage.setItem(`village:face-badge:${u}`,'seen');localStorage.setItem(`village:guide:v1:${u}`,'seen');
    },seat);return c;
  }));
  const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
  const errors:string[]=[]; for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
  try{
    await Promise.all([a,b].map(p=>p.goto('/')));
    await Promise.all([a,b].map(p=>expect(p.locator('[data-player="true"]')).toHaveAttribute('data-mode',/home|walking|attraction|seated/,{timeout:60000})));
    for(const p of [a,b]){const close=p.getByRole('button',{name:/^(Close|Not now|Maybe later)$/});if(await close.first().isVisible())await close.first().click();}
    const actor=a.locator('[data-player="true"]');const id=(await actor.getAttribute('data-testid'))!;const peer=b.getByTestId(id);
    // Real drag gesture through the existing controller, followed by server allocation.
    await tool(a,'intent','drop',{attraction_id:'home'});
    await expect(actor).toHaveAttribute('data-mode','home');
    await a.keyboard.press('Shift+KeyC');await b.keyboard.press('Shift+KeyC');
    await expect(actor).toHaveAttribute('data-follow','false');
    await tool(a,'frameAvatar','13370000-0000-4000-8000-000000000001');await a.waitForTimeout(1200);
    await expect.poll(()=>actor.evaluate(el=>{const r=el.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-player="true"]');})).toBe(true);
    const start=await actor.boundingBox();expect(start).toBeTruthy();
    await a.mouse.move(start!.x+start!.width/2,start!.y+start!.height/2);await a.mouse.down();await a.waitForTimeout(350);
    await expect(a.locator('[data-drop-target="festival_stage"]')).toBeAttached();
    await tool(a,'frame','festival_stage');await tool(b,'frame','festival_stage');await a.waitForTimeout(200);
    const end=await tool(a,'ground','festival_stage');await a.mouse.move(end.x,end.y,{steps:12});await a.mouse.up();
    await expect(actor).toHaveAttribute('data-attraction','festival_stage');await expect(peer).toHaveAttribute('data-attraction','festival_stage');
    await expect(peer).toHaveAttribute('data-slot',(await actor.getAttribute('data-slot'))!);
    await expect(peer).toHaveAttribute('data-since',(await actor.getAttribute('data-since'))!);
    await expect(peer).toContainText('Dancing');
    await Promise.all([a.screenshot({path:info.outputPath('festival-a.png')}),b.screenshot({path:info.outputPath('festival-b.png')})]);
    await a.waitForTimeout(400);
    expect(await tool(a,'intent','sit',{seat_id:'storefront_cafe:1'})).toBe(true);
    await expect(actor).toHaveAttribute('data-seat','storefront_cafe:1');await expect(peer).toHaveAttribute('data-seat','storefront_cafe:1');
    await tool(a,'frame','storefront_cafe');await tool(b,'frame','storefront_cafe');await a.waitForTimeout(1200);
    await Promise.all([a.screenshot({path:info.outputPath('cafe-a.png')}),b.screenshot({path:info.outputPath('cafe-b.png')})]);
    expect(await tool(b,'intent','sit',{seat_id:'storefront_cafe:1'})).toBe(true);
    await b.waitForTimeout(400);await expect(b.locator('[data-player="true"]')).not.toHaveAttribute('data-seat','storefront_cafe:1');
    await tool(a,'intent','join_attraction',{attraction_id:'ferris_wheel'});
    await expect(peer).toHaveAttribute('data-attraction','ferris_wheel');
    await expect(peer).toHaveAttribute('data-parent',/ride-cabin:/);
    await expect(peer).toHaveAttribute('data-parent',(await actor.getAttribute('data-parent'))!);
    await tool(b,'resyncGap');await a.waitForTimeout(200);await tool(a,'intent','emote',{kind:'cheer'});
    await expect(peer).toHaveAttribute('data-mode','emote');
    await contexts[1].setOffline(true);await b.waitForTimeout(500);await contexts[1].setOffline(false);
    await expect.poll(async()=>{const aa=await tool(a,'snapshot'),bb=await tool(b,'snapshot');return aa.filter((s:any)=>s.user_id.endsWith('003')).map((s:any)=>[s.mode,s.slot,s.since]).toString()===bb.filter((s:any)=>s.user_id.endsWith('003')).map((s:any)=>[s.mode,s.slot,s.since]).toString();},{timeout:15000}).toBe(true);
    expect(errors).toEqual([]);
  }catch(error){
    await Promise.all([a.screenshot({path:info.outputPath('failure-a.png')}),b.screenshot({path:info.outputPath('failure-b.png')})]);
    throw error;
  }finally{await Promise.all(contexts.map(c=>c.close()));}
  execFileSync('ffmpeg',['-y','-i',await a.video()!.path(),'-i',await b.video()!.path(),'-filter_complex','[0:v][1:v]hstack=inputs=2:shortest=1[v]','-map','[v]','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p',info.outputPath('two-windows.mp4')],{stdio:'pipe'});
});
