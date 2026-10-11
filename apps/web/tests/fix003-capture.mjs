import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const phase = process.argv[2] ?? 'before';
const out = `test-results/fix003/${phase}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [name, width, height] of [['wide',1920,1080],['laptop',1366,768],['phone',390,844]]) {
    const page = await browser.newPage({ viewport: {width,height}, reducedMotion:'reduce' });
    await page.route('**/api/**', route => ['GET','HEAD','OPTIONS'].includes(route.request().method()) ? route.continue() : route.fulfill({status:409,json:{detail:'Read-only visual review'}}));
    await page.goto(process.env.FIX003_URL ?? 'http://localhost:4183');
    await page.getByRole('button',{name:'My profile',exact:true}).waitFor({timeout:60000});
    await page.waitForTimeout(2500);
    await page.screenshot({path:`${out}/${name}-home.png`});
    await page.close();
  }
} finally { await browser.close(); }
