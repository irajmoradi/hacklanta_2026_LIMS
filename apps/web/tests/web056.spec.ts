import { expect, test } from '@playwright/test';
const uid = '13370000-0000-4000-8000-000000000001';
for (const mode of ['fallback', 'runtime', 'failed', 'nonmember'] as const) test(`${mode}: tracks advance with GET-only media`, async ({page}) => {
 const writes:string[]=[], assets:string[]=[], errors:string[]=[];
 page.on('request', r => { if (!['GET','HEAD'].includes(r.method())) writes.push(r.method()); if (r.url().includes('/api/assets/')) assets.push(r.url()); });
 page.on('pageerror', e => errors.push(e.message));
 await page.route(url => url.pathname.startsWith('/api/'), async route => {
   const path = new URL(route.request().url()).pathname;
   if (mode === 'failed') return route.fulfill({status:403,json:{detail:'Unavailable'}});
   if (path === '/api/me') return route.fulfill({json:{user:{id:uid},villages:[{id:'demo'}]}});
   if (path === '/api/villages/demo') return route.fulfill({json:{id:'demo',villagers:mode === 'nonmember' ? [] : [{user_id:uid,display_name:'Iraj',equipped:[],equipped_ids:[],avatar:{user_id:uid,revision:1,body:{colors:{skin:'#d5ae88',hair:'#655647',shirt:'#658d7a',pants:'#2f3640',shoes:'#222222'}},portrait:{kind:'photo',asset_url:`/api/assets/avatars/${uid}/face_512.png`,head_package_url:`/api/assets/avatars/${uid}/head/avatar.zip`}}}]}});
   if (path === '/api/villages/demo/barks') return route.fulfill({json:{[uid]:{greeting:[`/api/barks/${uid}/hello`]},other:{greeting:['/api/barks/other/hello']}}});
   if (path === `/api/barks/${uid}/hello`) {
     const data=Buffer.alloc(8044);data.write('RIFF');data.writeUInt32LE(8036,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(8000,24);data.writeUInt32LE(8000,28);data.writeUInt16LE(1,32);data.writeUInt16LE(8,34);data.write('data',36);data.writeUInt32LE(8000,40);data.fill(128,44);
     return route.fulfill({contentType:'audio/wav',body:data});
   }
   if (path.endsWith('.zip')) return route.fulfill({status:404});
   if (path.startsWith(`/api/assets/avatars/${uid}/`)) return route.fulfill({path:'public/lab/placeholder.svg',contentType:'image/svg+xml'});
   return route.fulfill({status:404});
 });
 const query = mode === 'fallback' ? '' : '&runtime=1';
 const next = () => page.getByRole('button',{name:'Next',exact:true}).click();
 const shot = (name:string) => page.screenshot({path:`test-results/web056/screenshots/${mode}-${name}.png`,fullPage:true});
 await page.goto(`/tests/web056.html?scene=onboarding${query}`);
 for(let i=0;i<7;i++){await expect(page.locator('[aria-current=step]')).toContainText(`${i+1}.`);if(i===1){await expect(page.getByText(mode==='runtime'?'Member-only runtime sample:':'Illustrated sample:',{exact:false})).toBeVisible();await shot('onboarding');}if(i<6)await next();}
 await page.getByRole('button',{name:'Join a village',exact:true}).click();await next();await next();await expect(page.getByText('Welcome to the neighborhood',{exact:false})).toBeVisible();
 await page.goto(`/tests/web056.html?scene=pipeline${query}`);
 await expect(page.getByRole('status')).toContainText(mode === 'runtime' ? 'Runtime source' : 'Illustrated fallback');
 for(let i=0;i<6;i++){
   await expect(page.locator('[aria-current=step]')).toContainText(`${i+1}.`);
   if(i===1){await page.getByLabel('Hair',{exact:true}).check();await page.getByRole('slider').fill('0.75');await expect(page.locator('output')).toHaveText('75%');if(mode==='runtime')await expect(page.locator('.lab-mask')).toHaveCount(2);}
   if(i===4) await expect(page.locator('[data-head-state]')).toHaveAttribute('data-head-state','unavailable');
   if(i===5 && mode==='runtime') {await page.locator('audio').evaluate(async (a:HTMLAudioElement)=>{a.muted=true;await a.play();});await expect.poll(()=>page.locator('audio').evaluate((a:HTMLAudioElement)=>a.currentTime)).toBeGreaterThan(0);}
   await shot(`avatar-${i+1}`);if(i<5)await next();
 }
 await page.getByRole('button',{name:'Object → mesh',exact:true}).click();for(let i=0;i<3;i++)await next();await expect(page.getByRole('heading',{name:'Ready for a friend’s home'})).toBeVisible();
 expect(writes).toEqual([]);expect(errors).toEqual([]);expect(assets.every(url=>url.includes(`/avatars/${uid}/`))).toBe(true);if(mode!=='runtime')expect(assets).toEqual([]);
});
