import { chromium, expect as baseExpect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'test-results/fix003/after';
await mkdir(out,{recursive:true});
const browser = await chromium.launch({headless:false,args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=d3d11']});
const results = [];
const expect = baseExpect.configure({timeout:15000});
let currentPage;
try {
  for (const [name,width,height] of [['wide',1920,1080],['laptop',1366,768],['phone',390,844]]) {
    console.log(`Checking ${name} (${width}x${height})`);
    const page = await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    currentPage = page;
    const errors = [], warnings = [];
    page.on('pageerror',e => errors.push(e.message));
    page.on('console',m => {if(m.type()==='warning') warnings.push(m.text().slice(0,200));});
    await page.route('**/api/**',route => ['GET','HEAD','OPTIONS'].includes(route.request().method()) ? route.continue() : route.fulfill({status:409,json:{detail:'Read-only review'}}));
    await page.goto(process.env.FIX003_URL ?? 'http://localhost:4184');
    await page.getByRole('button',{name:'My profile',exact:true}).waitFor({timeout:60000});
    await page.waitForTimeout(1500);
    await page.screenshot({path:`${out}/${name}-home.png`});
    if(width>1050) {
      const dock = await page.locator('.action-dock').boundingBox();
      if(width===1366) for(const selector of ['.feed-panel','.challenge-peek']) {
        const box=await page.locator(selector).boundingBox(); expect(box.y+box.height).toBeLessThan(dock.y);
      }
      await expect(page.locator('.feed-list')).not.toContainText('Mayor agent decision.');
    }
    for (const person of await page.locator('.neighbors-strip button').all()) {
      await person.click();
      await expect(page.locator('.profile-name h2')).toHaveText((await person.getAttribute('aria-label')).replace('Visit ',''));
      await page.getByRole('button',{name:'Close profile'}).click();
    }
    await page.getByRole('button',{name:'My profile',exact:true}).click();
    await page.getByRole('tab',{name:'Profile',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab',{name:'Wardrobe'})).toBeFocused();
    if(width===390) {
      await page.getByRole('button',{name:'Close profile'}).focus();
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(()=>!!document.activeElement?.closest('.profile-panel'))).toBe(true);
    }
    await page.screenshot({path:`${out}/${name}-profile.png`});
    await page.keyboard.press('Escape');
    await expect(page.locator('.profile-panel')).toHaveCount(0);
    await page.getByRole('button',{name:/Tour/}).click();
    for(let step=0;step<6;step++) {
      const guide=page.getByRole('region',{name:'Village tour'});
      await expect(guide).toContainText(`${step+1} / 6`);
      if(step===1) {
        await expect(page.locator('.profile-name h2')).toBeVisible();
        await expect(guide).toContainText(`${await page.locator('.profile-name h2').innerText()}’s profile`);
      }
      await page.screenshot({path:`${out}/${name}-tour-${step+1}.png`});
      await guide.getByRole('button',{name:step===5?'Finish':'Next',exact:true}).click();
    }
    await page.getByRole('button',{name:'Close dialog'}).click();
    // Start, supersede and close loads at several stages, then prove a fresh load works.
    for(let i=0;i<8;i++) {
      await page.locator('.neighbors-strip button').nth(i%2).click();
      await page.waitForTimeout([50,150,400,900][i%4]);
      await page.getByRole('button',{name:'Close profile'}).click();
    }
    await page.locator('.neighbors-strip button').first().click();
    await expect(page.locator('[data-head-state="ready"]')).toBeVisible({timeout:60000});
    await expect(page.locator('.profile-hero canvas')).toBeVisible();
    // Ready means the scene loaded; allow its first frames to draw before visual QA.
    await page.waitForTimeout(3000);
    await page.screenshot({path:`${out}/${name}-settled-head.png`});
    await page.getByRole('button',{name:'Close profile'}).click();
    await page.waitForTimeout(1000);
    const renderer = await page.locator('.scene canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable';
    });
    results.push({name,renderer,errors,warnings});
    expect(errors).toEqual([]);
    await page.close();
  }
} catch (error) {
  await currentPage?.screenshot({path:`${out}/failure.png`}).catch(()=>{});
  throw error;
} finally {
  await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
  await browser.close();
}
