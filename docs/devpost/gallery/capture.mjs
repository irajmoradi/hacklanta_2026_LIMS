// Run from apps/web through ops/remote_run.sh. No credentials required.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require('@playwright/test');
const output = fileURLToPath(new URL('./screenshots/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']});
const context = await browser.newContext({viewport: {width: 1500, height: 1000}, deviceScaleFactor: 1, serviceWorkers: 'block'});
const blocked = {};
const origin = 'https://207-246-81-187.sslip.io';
let lighting = 'day';
const aliases = {Iraj: 'Maple', Lance: 'Finch', Stefanny: 'Clover', Maya: 'Robin', Mario: 'Ash'};
const privateText = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/gi;
function sanitize(value, key = '') {
  if (Array.isArray(value)) return value.map(v => sanitize(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, sanitize(v,k)]));
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
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const rendererErrors = [];
const failedReads = [];
page.on('response', response => {
  if (response.request().method() === 'GET' && response.status() >= 400) failedReads.push({path:sanitize(new URL(response.url()).pathname),status:response.status()});
});
page.on('console', message => {
  if (message.type() === 'error') rendererErrors.push(sanitize(message.text()).slice(0,1200));
});
const only = new Set((process.argv.find(v => v.startsWith('--only='))?.slice(7) || '').split(',').filter(Boolean));
const previous = only.size ? JSON.parse(await readFile(`${output}/capture-audit.json`, 'utf8').catch(() => readFile(new URL('./capture-baseline.json', import.meta.url), 'utf8'))) : null;
const frames = [...(previous?.frames ?? [])], newFrames = [];
const failures = (previous?.failures ?? []).filter(f => !only.has(f.name));
let headPixels = previous?.head_pixels ?? null;
async function paintedHead() {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const source = document.querySelector('.head-studio [data-head-state="ready"] .lam-canvas canvas');
    if (!source || !source.width || !source.height) return resolve({colors:0,width:0,height:0});
    const copy = document.createElement('canvas'); copy.width = source.width; copy.height = source.height;
    const ctx = copy.getContext('2d'); ctx.drawImage(source,0,0);
    const pixels = ctx.getImageData(0,0,copy.width,copy.height).data;
    const colors = new Set();
    for (let i=0; i<pixels.length; i+=16) if (pixels[i+3]>100) colors.add(`${pixels[i]>>3},${pixels[i+1]>>3},${pixels[i+2]>>3}`);
    resolve({colors:colors.size,width:copy.width,height:copy.height});
  })));
}
const css = `
 .demo-debug-toggle,.demo-seat-switch,.player-hint,.camera-hint,.mode-badge,.user-picker,.tour-start{display:none!important}
 .portrait img{visibility:hidden!important}
 .portrait:not(.head-portrait)::after{content:attr(data-gallery-initial);position:absolute;inset:0;display:grid;place-items:center;color:white;font-size:13px;font-weight:700}
 .portrait{position:relative}
 .clean-view .toast-notice,.clean-view .toast{display:none!important}
 .interior-head [role=status]{visibility:hidden!important}
`;
async function privacy() {
  await page.evaluate(() => {
    document.querySelectorAll('.portrait').forEach(p => p.setAttribute('data-gallery-initial', p.querySelector('img')?.alt?.slice(0,1) || 'V'));
  });
  const body = await page.locator('body').innerText();
  if (new RegExp(privateText.source, 'i').test(body)) throw new Error('Contact details visible; capture rejected');
  if (await page.getByRole('button', {name: 'Debug menu', exact:true}).isVisible()) throw new Error('Debug menu visible');
}
async function shot(name) {
  await page.mouse.move(1490,990);
  await page.waitForTimeout(1500);
  await privacy();
  await page.screenshot({path: `${output}/${name}.png`, timeout:60000});
  frames.push(name);
  newFrames.push(name);
  console.log(`CAPTURED ${name}`);
}
async function boot() {
  await page.goto(origin, {waitUntil:'domcontentloaded', timeout:60000});
  await page.addStyleTag({content:css});
  await page.getByRole('button',{name:'My profile',exact:true}).waitFor({timeout:60000});
  await page.waitForTimeout(16000);
}
async function close() {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
}
async function run(name, fn) {
  if (only.size && !only.has(name)) return;
  try { await fn(); }
  catch(e) {
    failures.push({name, error:e.message.split('\n')[0]});
    console.log(`FAILED ${name}: ${e.message.split('\n')[0]}`);
    console.log('RENDERER ERRORS', rendererErrors.slice(-8));
    console.log('FAILED READS', failedReads);
    console.log('VISIBLE BUTTONS', await page.getByRole('button').allTextContents());
    await privacy();
    await page.screenshot({path:`${output}/diagnostic-${name}.png`,timeout:60000});
    await boot();
  }
}
try {
  await boot();
  await run('day', async () => {
    await page.getByRole('button',{name:'Enter clean fullscreen view'}).click();
    await shot('01-town-day');
    await close();
  });
  await run('profile', async () => {
    await page.getByRole('button',{name:'My profile',exact:true}).click();
    const head = page.locator('.head-studio [data-head-state="ready"],.head-studio [data-head-state="failed"]');
    await head.waitFor({timeout:150000});
    if (await head.getAttribute('data-head-state') !== 'ready') throw new Error('Generated head fell back instead of rendering');
    const deadline = Date.now() + 120000;
    do {
      await page.waitForTimeout(1000);
      headPixels = await paintedHead();
    } while (headPixels.colors < 32 && Date.now() < deadline);
    if (headPixels.colors < 32) throw new Error('Generated head reported ready but the canvas stayed blank');
    console.log('HEAD PIXELS', headPixels);
    await shot('03-profile-head');
    await close();
  });
  await run('wardrobe', async () => {
    await page.getByRole('button',{name:'Shop',exact:true}).click();
    await page.getByRole('button',{name:/^Try on /}).first().waitFor({timeout:30000});
    const preferred = page.getByRole('button',{name:/^Try on .*hoodie/i});
    await (await preferred.count() ? preferred.first() : page.getByRole('button',{name:/^Try on /}).first()).click();
    await page.waitForTimeout(8000);
    await shot('04-wardrobe-try-on');
    await close();
  });
  await run('house', async () => {
    await page.getByRole('button',{name:'My profile',exact:true}).click();
    await page.getByRole('tab',{name:'House',exact:true}).click();
    await page.getByRole('button',{name:'Go inside',exact:true}).click();
    await page.waitForTimeout(10000);
    await shot('05-house-interior');
    await page.getByRole('button',{name:'Back to village',exact:true}).click();
    await close();
  });
  for (const [label,file] of [['Compete','06-colosseum'],['Check in','07-check-in'],['Mayor','08-mayor']]) {
    await run(file, async () => {
      await page.getByRole('button',{name:label,exact:true}).click();
      if (file === '06-colosseum') await page.addStyleTag({content:'.arena-browser{display:none!important}'});
      await page.waitForTimeout(9000); await shot(file); await close();
    });
  }
  await run('gazette', async () => {
    await page.locator('body').click({position:{x:20,y:100}});
    await page.keyboard.press('g');
    await page.getByRole('heading',{name:'The Village Gazette',exact:true}).first().waitFor();
    await page.waitForTimeout(6000); await shot('09-gazette'); await close();
  });
  await run('group', async () => {
    await page.getByRole('button',{name:'Village',exact:true}).click();
    await page.getByRole('button',{name:'Our group photo',exact:true}).click();
    await page.waitForTimeout(6000);
    // Never capture an original group photograph or personal crop.
    await page.addStyleTag({content:'.group-photo-panel img,.group-photo-stage img,.group-photo-crops img{visibility:hidden!important}'});
    await shot('10-group-photo'); await close();
  });
  await run('night', async () => {
    lighting = 'night'; await boot();
    await page.getByRole('button',{name:'Enter clean fullscreen view'}).click();
    await shot('02-town-night');
  });
  if (!only.size || only.has('cover')) {
  const town = (await readFile(`${output}/01-town-day.png`)).toString('base64');
  await page.goto('about:blank');
  await page.setContent(`<!doctype html><html><style>*{box-sizing:border-box}body{margin:0;width:1500px;height:1000px;background:#183a2d;color:#f8f4e9;font-family:Arial,sans-serif;overflow:hidden}.title{position:absolute;top:76px;left:90px;z-index:2;width:700px}.eyebrow{font-size:17px;letter-spacing:4px;color:#c6d5ad;font-weight:700}h1{font-size:146px;letter-spacing:-9px;line-height:1;margin:24px 0}p{font-size:33px;line-height:1.4;width:650px;margin:0}.scene{position:absolute;left:490px;top:315px;width:1140px;height:760px;object-fit:cover;border-radius:50% 0 0 0;box-shadow:0 0 80px #081f2944}.bottom{position:absolute;bottom:82px;left:90px;font-size:19px;color:#d4dfc7;line-height:1.8;width:340px}.line{width:70px;height:4px;background:#c7d992;margin-bottom:25px}</style><img class="scene" src="data:image/png;base64,${town}"><div class="title"><div class="eyebrow">YOUR PEOPLE. A PLACE TO BELONG.</div><h1>Village</h1><p>A small town for your group chat, with a Mayor who notices when you disappear.</p></div><div class="bottom"><div class="line"></div>Small goals. Familiar faces.<br>A reason to check back.</div></html>`);
  await shot('00-cover');
  }
  if (!only.size || only.has('imessage')) {
  await page.goto('about:blank');
  await page.setContent(await readFile(new URL('./imessage.html',import.meta.url),'utf8'));
  await shot('11-imessage-placeholder');
  }
} finally {
  const uniqueFrames = [...new Set(frames)];
  await writeFile(`${output}/capture-audit.json`, JSON.stringify({source:origin,captured_at:new Date().toISOString(),viewport:[1500,1000],head_warmup_grace_ms:120000,head_pixels:headPixels,forwarded_mutations:0,websocket_connections_forwarded:0,blocked,privacy_checks_passed:uniqueFrames.length,frames:uniqueFrames,new_frames:newFrames,failures,errors:[...new Set(errors)],renderer_errors:[...new Set(rendererErrors)].slice(-20),failed_reads:failedReads,...(previous ? {previous_run:previous} : {})},null,2));
  await browser.close();
}
if (failures.length || new Set(frames).size !== 12) process.exitCode = 1;
