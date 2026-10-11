import { writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

test('arena first, preview, create, cost confirmation, filters, evidence, and return', async ({page}, info) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Compete',exact:true}).click();
  await expect(page.getByLabel('Colosseum',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Friends today. Rivals all week.'})).toBeVisible();
  await expect(page.locator('.arena-scene canvas')).toBeVisible();
  await page.screenshot({path:info.outputPath('arena-empty.png')});
  await page.locator('.arena-scene canvas').evaluate(c=>c.setAttribute('data-persistent','yes'));
  const banners=page.getByLabel('Competition banners');
  await banners.getByRole('button',{name:/The seven-day sprint/}).hover();
  await expect(page.getByRole('button',{name:'Inspect Lance',exact:true})).toBeVisible();
  await banners.getByRole('button',{name:/The seven-day sprint/}).click();
  await page.getByRole('button',{name:'Current',exact:true}).click();
  await page.getByRole('button',{name:'Progress of Lance'}).click();
  await expect(page.getByLabel('Participant evidence',{exact:true})).toContainText('Rank #1');
  await page.screenshot({path:info.outputPath('arena-evidence.png')});
  await page.keyboard.press('Escape');
  await banners.getByRole('button',{name:'Open',exact:true}).click();
  await expect(banners).toContainText('The next chapter');
  await expect(banners).toContainText('The seven-day sprint');
  await banners.getByRole('button',{name:'Past',exact:true}).click();
  await expect(banners).toContainText('No competitions yet');
  await banners.getByRole('button',{name:'Mine',exact:true}).click();
  await expect(banners).toContainText('The seven-day sprint');
  await banners.getByRole('button',{name:/\+ Create/}).click();
  await page.getByLabel('Competition title').fill('Arena challenge');
  await page.getByLabel('Terms',{exact:true}).fill('One focused session. Show your evidence.');
  await page.getByLabel('Optional SOL entry intent').fill('0.01');
  await page.screenshot({path:info.outputPath('arena-create.png')});
  await page.getByRole('button',{name:'Create competition with these terms'}).click();
  await banners.getByRole('button',{name:'Open',exact:true}).click();
  await expect(page.getByLabel('Competition terms',{exact:true})).toContainText('One focused session');
  await page.getByRole('button',{name:'Join · 0.01 SOL devnet · test intent',exact:true}).click();
  await expect(page.getByRole('alertdialog')).toContainText('No SOL transaction is signed or sent');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByLabel('Leaderboard',{exact:true})).toContainText('No participants yet');
  await page.getByRole('button',{name:'Join · 0.01 SOL devnet · test intent',exact:true}).click();
  await page.getByRole('button',{name:'Confirm join · 0.01 SOL devnet · test intent'}).click();
  await expect(page.getByLabel('Leaderboard',{exact:true})).toContainText('Iraj');
  await expect(page.locator('.arena-scene canvas')).toHaveAttribute('data-persistent','yes');
  await page.getByRole('button',{name:'Submit / manage competition'}).click();
  await page.getByLabel('Entry description').fill('Finished my focused session');
  await expect(page.getByRole('button',{name:'Submit entry',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('arena-mobile.png')});
  await page.getByRole('button',{name:'← Village',exact:true}).click();
  await expect(page.getByTestId('village-scene')).toBeVisible();
  await expect(page.getByLabel('Colosseum',{exact:true})).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('reduced motion, missing models and Escape',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/models/*.glb*',route=>route.fulfill({status:404,body:''}));
  await page.goto('/');await page.getByRole('button',{name:'Compete',exact:true}).click();
  await page.getByRole('button',{name:/The seven-day sprint/}).click();
  await page.getByRole('button',{name:'Progress of Lance'}).click();
  await expect(page.getByLabel('Participant evidence',{exact:true})).toContainText('Rank #1');
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await expect(page.getByLabel('Colosseum',{exact:true})).not.toBeVisible();
});

test('record transition frame intervals with trace',async({page},info)=>{
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Compete',exact:true})).toBeVisible();
  await expect(page.locator('.arena-scene canvas')).toHaveAttribute('data-arena-ready','true');
  await page.waitForTimeout(200);
  const profiler=process.env.VILLAGE_PROFILE ? await page.context().newCDPSession(page) : null;
  if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
  await page.evaluate(()=>{
    const samples:{start:number;end:number;ms:number}[]=[];
    let previous=performance.now();
    (window as any).__arenaFrames=samples;
    (window as any).__arenaSampling=true;
    performance.mark('arena-transition-start');
    const sample=(now:number)=>{
      samples.push({start:previous,end:now,ms:now-previous});previous=now;
      if((window as any).__arenaSampling)requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.getByRole('button',{name:'Compete',exact:true}).click();
  await page.getByRole('button',{name:/The seven-day sprint/}).click();
  await page.getByRole('button',{name:'Current',exact:true}).click();
  await page.getByRole('button',{name:'Progress of Lance'}).click();
  await page.waitForTimeout(450);
  const stats=await page.evaluate(()=>{
    (window as any).__arenaSampling=false;
    performance.mark('arena-transition-end');
    performance.measure('arena-transitions','arena-request','arena-transition-end');
    const request=performance.getEntriesByName('arena-request').at(-1)!.startTime;
    const samples:{start:number;end:number;ms:number}[]=(window as any).__arenaFrames;
    // Keep raw pre-click samples for audit. The budget starts with the actual
    // click, including the frame spanning it, not Playwright's actionability wait.
    const frames=samples.filter(f=>f.end>=request).map(f=>f.ms);
    const sorted=[...frames].sort((a,b)=>a-b);
    const canvas=document.querySelector<HTMLCanvasElement>('.arena-scene canvas')!;
    const gl=canvas.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {
      samples,frames,
      marks:performance.getEntriesByType('mark').filter(m=>m.name.startsWith('arena-')).map(m=>({name:m.name,startTime:m.startTime})),
      maxMs:Math.max(...frames),over50:frames.filter(n=>n>50).length,
      medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.floor(sorted.length*.95)],
      renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',
    };
  });
  if(profiler){const {profile}=await profiler.send('Profiler.stop');await writeFile(info.outputPath('transition.cpuprofile'),JSON.stringify(profile));}
  await writeFile(info.outputPath('transition-performance.json'),JSON.stringify(stats,null,2));
  await info.attach('transition-performance.json',{body:JSON.stringify(stats,null,2),contentType:'application/json'});
  if(process.env.VILLAGE_BROWSER_GPU === 'hardware')expect(stats.renderer).not.toMatch(/SwiftShader|llvmpipe|software/i);
  const time=(name:string)=>stats.marks.find(m=>m.name===name)!.startTime;
  expect(time('arena-warm-end')).toBeLessThan(time('arena-request'));
  expect(time('arena-town-paused')).toBeLessThan(time('arena-enter'));
  expect.soft(stats.maxMs,'No transition frame may exceed 50ms; inspect renderer and trace if this machine misses budget').toBeLessThanOrEqual(50);
});
