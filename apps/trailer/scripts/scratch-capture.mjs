// Run from apps/web: remote_run.sh --with-api node ../trailer/scripts/scratch-capture.mjs
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(`${process.cwd()}/package.json`);
const {chromium,expect}=require('@playwright/test');
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(process.env.VILLAGE_API_URL||'')||process.env.VILLAGE_API_URL.endsWith(':8010'))throw Error('Disposable API required');
execFileSync('../api/.venv/bin/python',['../trailer/scripts/seed-scratch.py'],{stdio:'inherit'});
const out=resolve('../trailer/artifacts/scratch');mkdirSync(out,{recursive:true});
const server=spawn('bun',['run','dev','--port','5197'],{env:{...process.env,VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_AUTH0_DOMAIN:'',VITE_AUTH0_CLIENT_ID:'',VILLAGE_ENV_FILE:'/dev/null'},stdio:'ignore'});
const origin='http://127.0.0.1:5197';
for(let i=0;i<120;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/playwright';
const dir=readdirSync(base).filter(x=>x.startsWith('chromium-')).sort().at(-1);
const executablePath=['chrome-linux64/chrome','chrome-linux/chrome'].map(x=>`${base}/${dir}/${x}`).find(existsSync);
const browser=await chromium.launch({executablePath,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling']});
const contexts=[],pages=[],segments=[];
let recording;
async function clip(name,action,split=true){
 // Force each software-rendered canvas to paint before the recorded action starts.
 // A final screenshot alone can hide a visitor canvas that stayed blank in the video.
 if(name!=='synced-walking')for(let i=0;i<pages.length;i++){
  await pages[i].bringToFront();await pages[i].waitForTimeout(2000);
  await pages[i].screenshot({path:`${out}/${name}-before-${i}.png`});
 }
 const start=(Date.now()-recording)/1000;
 await pages[0].bringToFront();await action();
 if(name!=='synced-walking'){
  await pages[1].bringToFront();await pages[1].waitForTimeout(1500);
  await pages[0].bringToFront();await pages[0].waitForTimeout(1500);
 }
 await pages[0].screenshot({path:`${out}/${name}.png`});await pages[1].screenshot({path:`${out}/${name}-peer.png`});
 segments.push({name,start,duration:(Date.now()-recording)/1000-start,split});console.log('CAPTURED',name);
}
try{
 for(const seat of [1,2]){
  const c=await browser.newContext({viewport:{width:960,height:900},recordVideo:{dir:`${out}/raw`,size:{width:960,height:900}}});
  await c.route('**/*',route=>{const u=new URL(route.request().url());const font=route.request().method()==='GET'&&((u.hostname==='cdn.jsdelivr.net'&&u.pathname.startsWith('/gh/lojjic/unicode-font-resolver'))||u.hostname==='fonts.gstatic.com');if(!['127.0.0.1','localhost'].includes(u.hostname)&&!font)console.log('BLOCKED EXTERNAL',u.origin+u.pathname);return ['127.0.0.1','localhost'].includes(u.hostname)||font?route.continue():route.abort();});
  await c.addInitScript(seat=>{const uid=`13370000-0000-4000-8000-00000000000${seat}`;localStorage.setItem('village:seat:live',uid);localStorage.setItem(`village:last:${uid}`,'13370000-0000-4000-8000-000000000000');localStorage.setItem(`village:face-badge:${uid}`,'seen');localStorage.setItem(`village:guide:v1:${uid}`,'seen');HTMLElement.prototype.requestFullscreen=async()=>{};},seat);
  c.setDefaultTimeout(45000);contexts.push(c);const page=await c.newPage();page.on('pageerror',e=>console.log('PAGE ERROR',e.stack));pages.push(page);
 }
 recording=Date.now();
 await Promise.all(pages.map(p=>p.goto(origin)));
 for(const p of pages){await p.locator('[data-player="true"]').waitFor({timeout:60000});await p.keyboard.press('Escape');await p.addStyleTag({content:'.demo-debug-toggle,.demo-seat-switch,.toast-viewport{display:none!important}'});}
 await pages[0].waitForTimeout(6000);
 const id=await pages[0].locator('[data-player="true"]').getAttribute('data-testid');
 if(!process.argv.includes('--rooms-only')) {
 for(const p of pages){await p.bringToFront();await p.addStyleTag({content:'.topbar,.dashboard,.action-dock,.neighbors-strip,.social-entry-stack,.player-hint,.camera-hint{visibility:hidden!important}'});}
 await pages[0].bringToFront();
 await clip('synced-walking',async()=>{await pages[0].keyboard.down('KeyS');await expect(pages[1].getByTestId(id)).toHaveAttribute('data-mode','walking',{timeout:15000});const z=Number(await pages[1].getByTestId(id).getAttribute('data-z'));await pages[0].waitForTimeout(2200);const after=Number(await pages[1].getByTestId(id).getAttribute('data-z'));expect(Math.abs(after-z)).toBeGreaterThan(.2);await pages[0].keyboard.up('KeyS');await pages[0].waitForTimeout(1800);await pages[0].keyboard.down('KeyD');await pages[0].waitForTimeout(2200);await pages[0].keyboard.up('KeyD');});
 }
 if(!process.argv.includes('--walk-only')){
 await Promise.all(pages.map((p,i)=>p.goto(`${origin}/interior-preview.html${i?'?seat=13370000-0000-4000-8000-000000000002':''}`)));
 for(const p of pages){await p.bringToFront();await p.waitForTimeout(2000);await expect(p.getByRole('status')).toContainText('changes saved',{timeout:45000});await p.getByText('Room inventory',{exact:true}).click();}
 await pages[0].getByRole('button',{name:'Decorate',exact:true}).click();
 const sofa=pages[1].getByTestId('position-sofa');const x=Number(await sofa.getAttribute('data-x'));
 await clip('house-sync',async()=>{await pages[0].waitForTimeout(1000);await pages[0].getByRole('button',{name:'Move sofa right',exact:true}).click();await pages[0].getByRole('button',{name:'Save decor',exact:true}).click();await expect(sofa).toHaveAttribute('data-x',String(x+.25));await pages[0].waitForTimeout(4000);});
 await pages[0].getByRole('button',{name:'Decorate',exact:true}).click();await pages[0].getByRole('button',{name:'Photo objects',exact:true}).click();
 await clip('object-room',async()=>{await pages[0].getByRole('button',{name:/Photo object.*By/}).click();await pages[0].getByRole('button',{name:'Save decor',exact:true}).click();await expect(pages[0].locator('[data-testid^="position-fe190000-"]')).toHaveCount(1);await pages[0].waitForTimeout(5000);},false);
 await Promise.all(pages.map((p,i)=>p.goto(`${origin}/interior-preview.html?hall=1${i?'&seat=13370000-0000-4000-8000-000000000002':''}`)));
 for(const p of pages){await p.bringToFront();await p.waitForTimeout(2000);await expect(p.getByRole('status')).toContainText('changes saved');await p.getByText('Room inventory',{exact:true}).click();}
 await pages[0].getByRole('button',{name:'Decorate',exact:true}).click();await pages[0].getByRole('button',{name:'Decor',exact:true}).click();
 await clip('hall-decor',async()=>{await pages[0].getByRole('button',{name:'Place Plant Fern',exact:true}).click();await pages[0].getByRole('button',{name:'Save decor',exact:true}).click();await expect(pages[1].locator('[data-testid^="position-plant_fern_"]')).toHaveCount(1,{timeout:15000});await pages[0].waitForTimeout(5000);});
}
}catch(error){for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:`${out}/diagnostic-${i}.png`,timeout:10000}).catch(()=>{});}throw error;}finally{
 await Promise.all(contexts.map(c=>c.close()));await browser.close();server.kill();
 const videos=await Promise.all(pages.map(p=>p.video().path()));
 writeFileSync(`${out}/audit.json`,JSON.stringify({source:'disposable API',segments,videos,external_mutations_forwarded:0,public_font_reads_allowed:true},null,2));
 for(const s of segments){execFileSync('ffmpeg',['-v','error','-y','-ss',String(s.start),'-i',videos[0],'-ss',String(s.start),'-i',videos[1],'-filter_complex',s.split?`[0:v][1:v]hstack=inputs=2:shortest=1,setpts=(PTS-STARTPTS)*${3/s.duration}[v]`:`[0:v]setpts=(PTS-STARTPTS)*${3/s.duration}[v]`,'-map','[v]','-t','3','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p',`${out}/${s.name}.mp4`],{stdio:'inherit'});}
}
