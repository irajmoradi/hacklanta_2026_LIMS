import {chromium, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
const out='test-results/web016'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const [name,width,height] of [['wide',1920,1080],['laptop',1366,768],['phone',390,844]]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.fulfill({status:409,json:{detail:'Read-only capture'}}));
  await page.goto(process.env.WEB016_URL ?? 'http://127.0.0.1:5198');
  await expect(page.getByText('Connected',{exact:true})).toBeAttached({timeout:60000});
  await expect(page.locator('.house-nameplate').first()).toBeVisible({timeout:60000});
  await page.waitForTimeout(8000);
  await page.screenshot({path:`${out}/real-${name}-village.png`});
  // On phones the people list provides an independent 44px target.
  if(width<700) await page.locator('.neighbors-strip button').nth(1).click();
  else await page.locator('.house-nameplate').nth(1).click();
  const outfit=page.getByRole('region',{name:'Villager showcase',exact:true});
  await expect(outfit).toBeVisible({timeout:30000}); await outfit.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.screenshot({path:`${out}/real-${name}-outfit.png`});
  expect(await page.locator('.profile-panel').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await expect(outfit.locator('canvas')).toBeVisible();
  await expect(outfit.getByRole('button',{name:/^(Equip|Unequip) /})).toHaveCount(0);
  results.push({name,errors,profile:await page.locator('.profile-name h2').innerText()});
  expect(errors).toEqual([]); await page.close();
 }
} finally {await writeFile(`${out}/real-results.json`,JSON.stringify(results,null,2)); await browser.close();}
