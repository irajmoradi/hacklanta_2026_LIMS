// Run from apps/web through ops/remote_run.sh. No credentials required.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require('@playwright/test');
const output = fileURLToPath(new URL('../artifacts/captures/', import.meta.url));
await mkdir(output, { recursive: true });
const {existsSync,readdirSync}=require('node:fs');
const browserRoot=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/playwright';
const chromiumDir=readdirSync(browserRoot).filter(p=>p.startsWith('chromium-')).sort().at(-1);
const executablePath=['chrome-linux64/chrome','chrome-linux/chrome'].map(p=>`${browserRoot}/${chromiumDir}/${p}`).find(existsSync);
const browser = await chromium.launch({executablePath,args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']});
const context = await browser.newContext({viewport: {width: 1920, height: 1080}, recordVideo: {dir: output + '/raw', size: {width:1920,height:1080}}, deviceScaleFactor: 1, serviceWorkers: 'block'});
const blocked = {};
const origin = 'https://thefriendshipvillage.vodka';
let lighting = 'day';
const aliases = {Lance: 'Finch', Stefanny: 'Clover', Maya: 'Robin', Mario: 'Ash'};
const privateText = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/gi;
function sanitize(value, key = '') {
  if (Array.isArray(value)) return value.map(v => sanitize(v));
  if (value && typeof value === 'object') {
    if(value.avatar && value.user_id !== '13370000-0000-4000-8000-000000000001') {
      value = structuredClone(value);
      value.avatar.portrait = {kind:'placeholder',asset_url:null,head_package_url:null,placeholder:true};
      delete value.avatar.body.head_glb_url; delete value.avatar.body.head_card_url;
    }
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, sanitize(v,k)]));
  }
  if (typeof value !== 'string') return value;
  if (/email|phone|invite_code/i.test(key)) return '[private]';
  if (/url|path|asset|package|id$/.test(key)) return value;
  let text = value.replace(privateText, '[private]');
  for (const [name, alias] of Object.entries(aliases)) text = text.replace(new RegExp(`\\b${name}\\b`, 'g'), alias);
  return text;
}
await context.route('**/*', async route => {
  const request = route.request();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
    const key = `${request.method()} ${new URL(request.url()).pathname}`;
    blocked[key] = (blocked[key] || 0) + 1;
    return route.fulfill({status: 403, contentType: 'application/json', body: JSON.stringify({detail: 'Gallery capture is read-only.'})});
  }
  const url = new URL(request.url());
  // Presence streams never finish; do not buffer them through route.fetch.
  // Keep live presence off the server; it is irrelevant to a still image.
  if (url.pathname.endsWith('/presence/stream')) return route.fulfill({status:204,body:''});
  if (url.origin === origin && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/assets/')) {
    const response = await route.fetch();
    if (response.headers()['content-type']?.includes('application/json')) {
      const data = sanitize(await response.json());
      if (/^\/api\/villages\/[^/]+$/.test(url.pathname) && data.world) {
        data.world.time_of_day = lighting;
        data.world.weather = 'clear';
      }
      return route.fulfill({response, json: data});
    }
    return route.fulfill({response});
  }
  return route.continue();
});
await context.routeWebSocket('**/*', socket => socket.close());
await context.addInitScript(() => {
  try {
  localStorage.setItem('village:seat:live', '13370000-0000-4000-8000-000000000001');
  localStorage.setItem('village:walk-hint', '1');
  } catch { /* The cover's about:blank document has no origin storage. */ }
  // Keep the app's clean view, without headless Chromium's 800x600 native fullscreen.
  HTMLElement.prototype.requestFullscreen = async () => {};
  // The runner renders in software; allow the existing head to finish mounting.
  // This changes only the browser's 30-second UI fallback deadline, not asset data.
  const originalTimeout = window.setTimeout;
  window.setTimeout = function(handler, delay, ...args) {
    return originalTimeout(handler, delay === 30000 ? 120000 : delay, ...args);
  };
});
let page;
const errors=[],rendererErrors=[],failedReads=[];
const only = new Set((process.argv.find(v=>v.startsWith('--only='))?.slice(7)||'').split(',').filter(Boolean));
const previous = only.size && existsSync(`${output}/capture-audit.json`) ? JSON.parse(await readFile(`${output}/capture-audit.json`,'utf8')) : null;
const frames = [], failures = [], segments = [], frameChecks=[];
const css = `.demo-debug-toggle,.demo-seat-switch,.player-hint,.camera-hint,.mode-badge,.user-picker,.tour-start,.toast-viewport,.village-toast,.toast-notice,.toast{display:none!important} .interior-head [role=status]{visibility:hidden!important} .portrait img,.evidence-image,.group-photo-panel img{visibility:hidden!important}`;
async function boot(name){
 if(['growth-unlock','disaster-repair','routines'].includes(name)){
  await page.goto(`${origin}/lab#${name==='growth-unlock'?'futures':name==='disaster-repair'?'disasters':'town'}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('.lab-stage canvas').waitFor({timeout:60000});await page.waitForTimeout(12000);return;
 }
 for(let attempt=0;;attempt++){try{const response=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});if(response.status()>=400)throw Error('HTTP '+response.status());break;}catch(e){if(attempt===3)throw e;await page.waitForTimeout(10000);}}
 await page.addStyleTag({content:css});
 await page.getByRole('button',{name:'My profile',exact:true}).waitFor({timeout:60000});
 await page.waitForTimeout(18000);
 await page.keyboard.press('Escape');
 await page.waitForTimeout(1000);
 const seatDialog=page.getByRole('dialog').filter({hasText:'Who are you testing as?'});
 if(await seatDialog.isVisible()){await seatDialog.getByRole('button',{name:/close/i}).click();await page.waitForTimeout(1000);}
}
async function shot(name, hold=4500, action){
 await page.mouse.move(1910,1070);await page.waitForTimeout(1800);
 if(['colosseum','competition','friends'].includes(name))await page.evaluate(()=>{
  window.__trailerFrames={running:true,count:0,stray:[]};
  const inspect=()=>{const audit=window.__trailerFrames;if(!audit.running)return;audit.count++;
   for(const el of document.querySelectorAll('.placeholder-label,[role="tooltip"]')){const rect=el.getBoundingClientRect(),style=getComputedStyle(el);if(rect.width&&rect.height&&style.visibility!=='hidden'&&style.display!=='none'&&/placeholder face/i.test(el.textContent))audit.stray.push(el.textContent);}
   requestAnimationFrame(inspect);};requestAnimationFrame(inspect);
 });
 if(new RegExp(privateText.source,'i').test(await page.locator('body').innerText())) throw Error('Private contact text');
 await page.screenshot({path:`${output}/${name}.png`,timeout:60000});
 const start=(Date.now()-recordStart)/1000;
 if(action){await action();await page.screenshot({path:`${output}/${name}-motion.png`,timeout:60000});}else await page.waitForTimeout(hold);
 if(['colosseum','competition','friends'].includes(name)){const check=await page.evaluate(()=>{window.__trailerFrames.running=false;return window.__trailerFrames;});frameChecks.push({name,...check});if(check.stray.length)throw Error('Visible placeholder label in captured animation frame');}
 segments.push({name,start,duration:(Date.now()-recordStart)/1000-start});frames.push(name);console.log(`CAPTURED ${name}`);
}
async function close(){await page.keyboard.press('Escape');await page.waitForTimeout(1500);}
let recordStart=0;
async function run(name,fn){
 if(only.size&&!only.has(name))return;
 console.log('OPENING',name);
 page=await context.newPage();recordStart=Date.now();
 page.on('pageerror',e=>errors.push(sanitize(e.message)));
 page.on('response',r=>{if(r.request().method()==='GET'&&r.status()>=400)failedReads.push({path:new URL(r.url()).pathname,status:r.status()});});
 page.on('console',m=>{if(m.type()==='error')rendererErrors.push(sanitize(m.text()).slice(0,1200));});
 try{await boot(name);await fn();}
 catch(e){failures.push({name,error:e.message.split('\n')[0]});console.log('FAILED',name,e.message.split('\n')[0]);await page.screenshot({path:`${output}/diagnostic-${name}.png`,timeout:10000}).catch(()=>{});}
 finally{const video=page.video();await page.close();const path=await video.path().catch(()=>'unavailable');for(const segment of segments.filter(s=>s.name===name))segment.video=path.split('/').at(-1);}
}
try{
 await run('growth',async()=>{await page.getByRole('button',{name:'Village',exact:true}).click();await page.waitForTimeout(4500);await shot('growth');});
 await run('growth-unlock',async()=>{await shot('growth-unlock',18000,async()=>{for(let i=0;i<4;i++){await page.getByRole('button',{name:'Next level',exact:true}).click();await page.waitForTimeout(3500);}});});
 await run('disaster-repair',async()=>{await page.getByRole('button',{name:'outbreak',exact:true}).click();await page.waitForTimeout(2500);await shot('disaster-repair',16000,async()=>{for(let i=0;i<4;i++){await page.getByRole('button',{name:'Simulate check-ins +3',exact:true}).click();await page.waitForTimeout(2200);}await page.getByRole('button',{name:'Repair',exact:true}).click();await page.waitForTimeout(3500);});});
 await run('routines',async()=>{await shot('routines',7000);});
 await run('shelter',async()=>{await page.getByRole('button',{name:'Enter clean fullscreen view'}).click();await page.mouse.dblclick(830,550,{delay:90});await page.getByTestId('location-closeup').waitFor({timeout:10000});if(!/shelter/i.test(await page.getByTestId('location-closeup').innerText()))throw Error('Selected building is not the Pet Shelter');await page.waitForTimeout(5000);await shot('shelter');});
 await run('dashboard',async()=>{await page.getByRole('button',{name:'Mayor',exact:true}).first().click();await page.getByRole('button',{name:/How.s the village doing/}).click();await page.waitForTimeout(5000);await shot('dashboard');});
 await run('walking-wide',async()=>{await page.getByRole('button',{name:'Enter clean fullscreen view'}).click();await shot('walking-wide',5000,async()=>{await page.keyboard.down('d');await page.waitForTimeout(2500);await page.keyboard.up('d');await page.waitForTimeout(2500);});});
 await run('walking',async()=>{await page.getByTestId('villager-Iraj').click();await page.waitForTimeout(5000);await page.keyboard.press('Escape');await page.waitForTimeout(2000);const label=page.locator('[data-player="true"]');const box=await label.boundingBox();if(!box)throw Error('Owner label missing');await page.mouse.move(Math.min(1700,Math.max(350,box.x+box.width/2)),Math.min(900,Math.max(180,box.y+box.height+70)));for(let i=0;i<48;i++){await page.mouse.wheel(0,-300);await page.waitForTimeout(80);}await page.waitForTimeout(2500);await page.keyboard.press('Shift+c');await page.keyboard.down('d');await page.waitForTimeout(1000);await page.keyboard.up('d');await page.waitForTimeout(2500);console.log('OWNER CAMERA',JSON.stringify(await label.boundingBox()));await shot('walking',6000,async()=>{await page.keyboard.down('d');await page.waitForTimeout(2500);await page.keyboard.up('d');await page.keyboard.down('s');await page.waitForTimeout(2500);await page.keyboard.up('s');await page.waitForTimeout(1000);});});

 await run('farm',async()=>{await page.getByRole('button',{name:'Shop',exact:true}).click();await page.getByRole('tab',{name:'Farm Store',exact:true}).click();await page.waitForTimeout(6000);await page.getByRole('button',{name:/^Try on /}).first().click();await page.waitForTimeout(2500);await shot('farm');});
 await run('town',async()=>{await page.getByRole('button',{name:'Enter clean fullscreen view'}).click();await shot('town',6000);await close();});
 for(const [label,name] of [['Check in','checkin'],['My goal','goals'],['Friends','friends'],['Reading list','reading'],['Compete','colosseum'],['Weekly review','review'],['Mayor','mayor']]){
  await run(name,async()=>{await page.getByRole('button',{name:label,exact:true}).first().click();await page.waitForTimeout(6500);await shot(name);await close();});
 }
 await run('competition',async()=>{await page.getByRole('button',{name:'Compete',exact:true}).click();await page.locator('.arena-banner').filter({hasText:'Minecraft hours'}).click();await page.waitForTimeout(6000);await shot('competition');});
 await run('gazette',async()=>{await page.locator('body').click({position:{x:20,y:100}});await page.keyboard.press('g');await page.waitForTimeout(5000);await shot('gazette');await close();});
 await run('hall',async()=>{await page.getByRole('button',{name:'Community Hall',exact:true}).click();await page.waitForTimeout(12000);await shot('hall');await page.getByRole('button',{name:/Back to village/}).click();await close();});
 await run('wardrobe',async()=>{await page.getByRole('button',{name:'Shop',exact:true}).click();await page.getByRole('button',{name:/^Try on /}).first().click();await page.waitForTimeout(6000);await shot('wardrobe');await close();});
 for (const category of ['Bottoms','Shoes','Glasses']) await run(category.toLowerCase(),async()=>{await page.getByRole('button',{name:'Shop',exact:true}).click();await page.getByRole('tab',{name:category,exact:true}).click();await page.getByRole('button',{name:/^Try on /}).first().click();await page.waitForTimeout(5000);await shot(category.toLowerCase());});
 await run('shop',async()=>{await page.getByRole('button',{name:'Shop',exact:true}).click();await page.waitForTimeout(7000);await shot('shop');});
 await run('pets',async()=>{await page.getByRole('button',{name:'Shop',exact:true}).click();await page.getByRole('tab',{name:'Farm Store',exact:true}).click();await page.waitForTimeout(7000);await page.getByRole('button',{name:'Try on Village Dog',exact:true}).click();await page.waitForTimeout(3000);await shot('pets');});
 await run('head',async()=>{await page.getByRole('button',{name:'My profile',exact:true}).click();await page.locator('.head-studio [data-head-state="ready"]').waitFor({timeout:150000});
 const painted=async()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const source=document.querySelector('.head-stage .lam-canvas canvas,.head-studio [data-head-state="ready"] .lam-canvas canvas');if(!source)return resolve(0);const copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;const ctx=copy.getContext('2d');ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,copy.width,copy.height).data,colors=new Set();for(let i=0;i<pixels.length;i+=16)if(pixels[i+3]>100)colors.add(`${pixels[i]>>3},${pixels[i+1]>>3},${pixels[i+2]>>3}`);resolve(colors.size);})));let colors=0;const deadline=Date.now()+120000;do{await page.waitForTimeout(1500);colors=await painted();}while(colors<32&&Date.now()<deadline);if(colors<32)throw Error('3D head canvas remained blank');console.log('PAINTED HEAD',colors);await page.locator('.head-studio [aria-label="Open big head view"]').first().evaluate(el=>el.click());await page.locator('.head-stage [data-head-state="ready"]').waitFor({timeout:150000});await page.waitForTimeout(6000);await shot('head',6000,async()=>{await page.mouse.move(900,500);await page.mouse.down();await page.mouse.move(1180,520,{steps:90});await page.mouse.move(760,490,{steps:120});await page.mouse.up();await page.waitForTimeout(2000);});await close();});
 await run('house',async()=>{await page.getByRole('button',{name:'My profile',exact:true}).click();await page.getByRole('tab',{name:'House',exact:true}).click();await page.getByRole('button',{name:'Go inside',exact:true}).click();await page.waitForTimeout(10000);await shot('house');await page.getByRole('button',{name:/Back to village/}).click();await close();});
 await run('house-undo',async()=>{await page.getByRole('button',{name:'My profile',exact:true}).click();await page.getByRole('tab',{name:'House',exact:true}).click();await page.getByRole('button',{name:'Go inside',exact:true}).click();await page.waitForTimeout(7000);await page.getByRole('button',{name:'Decorate',exact:true}).click();await shot('house-undo');await page.getByRole('button',{name:'Back to village',exact:true}).click();await close();});
 await run('cafe',async()=>{await page.getByRole('button',{name:'Enter clean fullscreen view'}).click();const point=JSON.parse(process.env.CAFE_POINT||'{"x":1120,"y":470}');await page.mouse.dblclick(point.x,point.y,{delay:90});await page.getByTestId('location-closeup').waitFor({timeout:8000});if(!/caf[e\u00e9]/i.test(await page.getByTestId('location-closeup').innerText()))throw Error('Closeup is not cafe');await page.waitForTimeout(5000);await shot('cafe');await close();});

}finally{
 await context.close();
 const videoPath='per-scene-recordings';
 if(previous){failures.push(...previous.failures.filter(f=>!only.has(f.name)&&!frames.includes(f.name)));for(const [key,value] of Object.entries(previous.blocked))blocked[key]=(blocked[key]||0)+value;const replaced=new Set(frames);segments.unshift(...previous.segments.filter(s=>!replaced.has(s.name)).map(s=>({...s,video:s.video||previous.video})));frames.unshift(...previous.frames.filter(s=>!replaced.has(s)));}
 await writeFile(`${output}/capture-audit.json`,JSON.stringify({source:origin,captured_at:new Date().toISOString(),viewport:[1920,1080],forwarded_mutations:0,websocket_connections_forwarded:0,frameChecks,blocked,frames,segments,failures,errors:[...new Set(errors)],failedReads,rendererErrors:[...new Set(rendererErrors)],previous_capture:previous?.captured_at,video:videoPath.split('/').at(-1)},null,2));
 await browser.close();
}
if(failures.length)process.exitCode=1;
