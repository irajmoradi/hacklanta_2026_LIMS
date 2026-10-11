import { chromium } from '../../apps/web/node_modules/playwright-core/index.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(root, 'ops/demo/artifacts');
const rehearsal = process.argv.includes('--rehearse');
const scale = rehearsal ? 0.18 : 1;
const api = new URL(process.env.VILLAGE_API_URL || 'http://invalid');
if (api.hostname !== '127.0.0.1' || ['8010', '80', '443'].includes(api.port)) throw Error('Disposable loopback API required');
if (!/^run_[a-f0-9]+$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw Error('Runner scratch DB required');
const health = await fetch(new URL('/api/health', api));
if (!health.ok) throw Error('Scratch API unhealthy');
await mkdir(out, {recursive:true});
const preview = spawn(process.execPath, [path.join(root,'apps/web/node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4175','--strictPort','--outDir',path.join(out,'build')], {cwd:path.join(root,'apps/web'),stdio:'inherit'});
let browser, context, page;
const markerColors=['#ff2020','#20ff20','#2020ff','#ffff20','#20ffff','#ff20ff','#ff9020','#9020ff','#909090'];
const evidence = {markerColors, mode:'browser fixtures; disposable seeded Postgres/API health verified', rehearsal, shots:[], errors:[], blocked:[]};
try {
  for (let i=0;i<100;i++) { try { if ((await fetch('http://127.0.0.1:4175')).ok) break; } catch {} await new Promise(r=>setTimeout(r,200)); }
  browser = await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--disable-dev-shm-usage']});
  context = await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:path.join(out,'raw'),size:{width:1920,height:1080}}, serviceWorkers:'block'});
  await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    // Keep the production CSS offline: its optional Google Fonts import uses the system fallback.
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({status:200,contentType:'text/css',body:'/* Offline capture: system font fallback. */'});
    if (u.origin !== 'http://127.0.0.1:4175' || (u.pathname.startsWith('/api/') && route.request().method() !== 'GET')) {
      evidence.blocked.push({method:route.request().method(),path:u.pathname}); return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(() => {
    localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000004');
    localStorage.setItem('village:walk-hint','1');
    // Select the app's existing low-core quality path before the first WebGL frame.
    Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>2});
    // Leave CPU time for video encoding and input on the software-rendered runner.
    const raf=window.requestAnimationFrame.bind(window), cancel=window.cancelAnimationFrame.bind(window);
    let next=0; const pending=new Map();
    window.requestAnimationFrame=callback=>{const id=++next;const entry={timer:0,frame:0};pending.set(id,entry);entry.timer=setTimeout(()=>{entry.frame=raf(time=>{pending.delete(id);callback(time);});},33);return id;};
    window.cancelAnimationFrame=id=>{const entry=pending.get(id);if(entry){clearTimeout(entry.timer);cancel(entry.frame);pending.delete(id);}};
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', e=>evidence.errors.push(e.message));
  const video = page.video();
  await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button',{name:'My profile',exact:true}).waitFor();
  await page.waitForTimeout(5000);
  await page.addStyleTag({content:`*{cursor:none!important} [aria-label="Debug menu"],.tour-start{visibility:hidden!important} #demo-caption{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483647;background:#102b2bf5;color:#fff;padding:16px 30px;border:1px solid #b8dbb8;border-radius:16px;font:500 25px/1.4 system-ui;max-width:1320px;text-align:center;pointer-events:none;box-shadow:0 8px 40px #0003} #demo-label{position:fixed;top:76px;left:26px;z-index:2147483647;background:#123d35;color:#ecffcf;border-radius:10px;padding:12px 18px;font:600 19px system-ui;pointer-events:none} #demo-slide{position:fixed;inset:125px 180px 160px;z-index:2147483646;border-radius:28px;background:#fcfaef;box-shadow:0 20px 100px #102b2b66;padding:65px;color:#183b35;font:26px/1.55 system-ui} #demo-slide h1{font-size:58px;line-height:1.15;margin:12px 0 32px} #demo-slide h2{font-size:28px;color:#50776a} #demo-slide .flow{display:flex;gap:20px;margin:45px 0} #demo-slide .flow div{flex:1;background:#e3eddb;padding:26px;border-radius:18px} #demo-slide small{font-size:21px;color:#52665e}`});
  await page.addStyleTag({content:'#demo-caption,#demo-label{margin:0;width:max-content;height:auto;overflow:visible} #demo-caption{top:auto;right:auto;bottom:90px} #demo-label{bottom:auto;right:auto}'});
  await page.addStyleTag({content:'#demo-marker{position:fixed;inset:auto auto 0 0;margin:0;width:32px;height:16px;padding:0;border:0;background:#000;pointer-events:none;transition:none}'});
  await page.evaluate(()=>{
    const overlays=[];
    for (const [id,text] of [['demo-marker',''],['demo-caption',''],['demo-label','Fixture simulation · Maya · GPU offline']]) {
      const el=document.createElement('div');el.id=id;el.textContent=text;el.popover='manual';document.body.append(el);el.showPopover();overlays.push(el);
    }
    // Native modal dialogs enter the top layer. Keep editorial captions above that layer too.
    new MutationObserver(records=>{
      if(records.some(r=>r.target instanceof HTMLDialogElement)) {
        for(const el of overlays){el.hidePopover();el.showPopover();}
      }
    }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  });
  const button = name => page.getByRole('button',{name,exact:true});
  const activate = async locator => {
    await locator.waitFor({state:'visible'});
    await locator.evaluate(el=>{if(el.disabled) throw Error('Disabled capture control');el.click();});
  };
  const close = async()=>{
    await page.getByRole('button',{name:/^(Close dialog|Close profile)$/}).evaluateAll(nodes=>{
      const node=nodes[0];if(node && !node.disabled) node.click();
    });
    await page.waitForTimeout(350);
  };
  const caption = text => page.evaluate(({text,color})=>{document.getElementById('demo-caption').textContent=text;document.getElementById('demo-marker').style.backgroundColor=color;},{text,color:markerColors[evidence.shots.length]});
  const slide = html=>page.evaluate(html=>{document.getElementById('demo-slide')?.remove();if(html){const e=document.createElement('section');e.id='demo-slide';e.innerHTML=html;document.body.append(e);}},html);
  const wait = ms=>page.waitForTimeout(ms*scale);
  if(!rehearsal) {
    // Compile scene shaders and load panels before the timed take. These are read-only UI visits.
    await activate(button('My profile'));await page.getByRole('heading',{name:'Maya',exact:true}).waitFor();await close();
    await activate(button('Shop'));
    await activate(page.locator('[data-item-id="hat_beanie"]').getByRole('button',{name:'Try on Cozy Beanie',exact:true}));
    await page.locator('.try-on-pane canvas').waitFor();await page.waitForTimeout(1500);
    await activate(page.locator('.try-on-pane').getByRole('button',{name:'Done',exact:true}));await close();
    await activate(button('Compete'));await activate(page.getByRole('button',{name:/The seven-day sprint/}));
    await page.waitForTimeout(1500);await activate(button('← Village'));await page.waitForTimeout(500);
    await activate(button('Check in'));await activate(page.getByRole('button',{name:/Goal progress/}));
    await page.locator('#checkin-body').waitFor();await close();
    await activate(button('Weekly review'));await page.getByRole('heading',{name:'Weekly review'}).waitFor();await close();
    await page.waitForTimeout(3000);
    console.log('Scene pre-roll complete; beginning the 150-second take.');
  }
  const started = Date.now();
  const trimStart = await page.evaluate(()=>performance.now()/1000);
  evidence.trimStart=trimStart;
  async function shot(start, end, title, action) {
    const actualStart=(Date.now()-started)/1000;
    await caption(title);
    await action();
    evidence.shots.push({start,end,title,actualStart,actualActionEnd:(Date.now()-started)/1000});
    console.log(`Shot ${start}-${end}: action complete at ${evidence.shots.at(-1).actualActionEnd.toFixed(2)}s`);
    const remaining = end*1000*scale-(Date.now()-started);
    evidence.shots.at(-1).overrunSeconds=Math.max(0,-remaining/1000);
    if (remaining>0) await page.waitForTimeout(remaining);
  }
  await shot(0,15,'A small town for the people in your group chat.',async()=>{await wait(6000);await activate(button('My profile'));await page.getByRole('heading',{name:'Maya',exact:true}).waitFor();});
  await shot(15,35,'The CV pipeline · This recording uses preset avatars.',async()=>{await close();await slide('<h2>VILLAGE / THE AVATAR PIPELINE</h2><h1>One photo. A familiar neighbor.</h1><div class="flow"><div>Consented photo<br>↓<br>SAM 3 segmentation</div><div>Hunyuan<br>↓<br>Stylized walking head</div><div>LAM portrait<br>+ ElevenLabs voice<br>+ Audio2Expression</div></div><p>Preset body and portrait keep the town working when the GPU is offline.</p><small>Architecture diagram · No personal media or generated speech in this capture.</small>');});
  await shot(35,55,'A weekly goal. Small check-ins. Coins now, XP over time.',async()=>{
    await slide('');await activate(button('My goal'));await wait(4000);await close();
    evidence.coinsBefore=await page.getByTestId('my-coins').innerText();
    await activate(button('Check in'));const goal=page.getByRole('button',{name:/Goal progress/});
    if(await goal.isEnabled()) await activate(goal);
    await page.locator('#checkin-body').fill('Finished the first mix.');await wait(2500);
    await activate(page.getByRole('button',{name:/Share check-in/}));
    await page.getByRole('dialog').waitFor({state:'hidden'});
    evidence.coinsAfter=await page.getByTestId('my-coins').innerText();
    if(evidence.coinsBefore===evidence.coinsAfter) throw Error('Check-in did not award coins');
    await activate(button('My goal'));
  });
  await shot(55,75,'Try an outfit, turn it around, then leave without buying.',async()=>{
    await close();await activate(button('Shop'));
    await activate(page.locator('[data-item-id="hat_beanie"]').getByRole('button',{name:'Try on Cozy Beanie',exact:true}));
    const preview=page.locator('.try-on-pane .wardrobe-preview');await preview.waitFor();
    await preview.evaluate(async el=>{
      for(let i=0;i<8;i++){el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await new Promise(r=>setTimeout(r,150));}
    });
    const previewHold=72500*scale-(Date.now()-started);
    if(previewHold>0) await page.waitForTimeout(previewHold);
    await activate(page.locator('.try-on-pane').getByRole('button',{name:'Done',exact:true}));
  });
  await shot(75,95,'The Mayor uses recorded activity. Simulated output; people keep the final say.',async()=>{
    await close();await activate(page.locator('.headline-ticker'));await page.locator('.gazette-paper').waitFor();
    await wait(6500);await close();await activate(button('AI at work'));await page.getByRole('heading',{name:'AI at work'}).waitFor();
  });
  await shot(95,115,'Villager-grams require consent. Preview / simulated transport; handset delivery unverified.',async()=>{
    await close();await activate(button('Shop'));await activate(page.getByText('Photo gifts & villager-grams',{exact:true}));
    await page.locator('.villagergram').evaluate(el=>el.scrollIntoView({block:'center'}));await wait(6500);
    await close();await activate(button('Open Settings'));await page.getByRole('switch',{name:/Friends may use my avatar/}).evaluate(el=>el.scrollIntoView({block:'center'}));
  });
  await shot(115,135,'The Colosseum: human review, game coins and XP. SOL is devnet intent, not payment.',async()=>{
    await close();await activate(button('Compete'));await activate(page.getByRole('button',{name:/The seven-day sprint/}));
    await wait(7000);await activate(button('← Village'));await page.waitForTimeout(500);await activate(button('Weekly review'));
    await page.getByRole('heading',{name:'Weekly review'}).waitFor();
  });
  await shot(135,145,'Measured in isolated tests. A village that works with the GPU off.',async()=>{await close();await slide('<h2>VILLAGE / MEASURED, NOT ESTIMATED</h2><h1>Built to keep the town running.</h1><div class="flow"><div><b>114.48 ms</b><br>Village read p95<br><small>5 seeded villagers · 20 warm ASGI reads · excludes network</small></div><div><b>1,520 outfits</b><br>3,040 front / side views<br><small>Factor-pair fit matrix · 606 → 0 measured failures</small></div><div><b>GPU offline</b><br>Preset avatars<br><small>Shown throughout this recording</small></div></div><small>Prior measurements: FIX-006 API report and FIX-008 outfit report, linked in docs/devpost/SUBMISSION.md.</small>');});
  await shot(145,150,'Make checking on a friend feel like dropping by.',async()=>{await slide('');});
  evidence.actualDuration=(Date.now()-started)/1000;
  if(!rehearsal && evidence.actualDuration>151) throw Error('The full take exceeded its 150-second timeline');
  evidence.trimStart = trimStart;
  await page.waitForTimeout(20000); // Flush delayed software-rendered closing frames.
  await context.close();context=null;
  const raw=await video.path();
  evidence.raw=path.basename(raw);
  await writeFile(path.join(out,rehearsal?'rehearsal.json':'full-capture.json'),JSON.stringify(evidence,null,2));
  await writeFile(path.join(out,'capture.json'),JSON.stringify(evidence,null,2));
  if(evidence.errors.length || evidence.blocked.length) throw Error('Capture had page errors or blocked requests; inspect capture.json');
  if (!rehearsal) {
    execFileSync('python3',[path.join(root,'ops/demo/export.py'),out],{stdio:'inherit'});
  }
} catch(error) {
  evidence.failure=String(error);
  if(page && !page.isClosed()) {
    await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
    evidence.visibleText=await page.locator('body').innerText().catch(()=>'Unavailable');
  }
  await writeFile(path.join(out,'capture.json'),JSON.stringify(evidence,null,2));throw error;
}
finally {if(context) await context.close();if(browser) await browser.close();preview.kill('SIGTERM');}
