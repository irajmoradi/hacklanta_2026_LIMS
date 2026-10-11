import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page = await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});
 await page.route('**/api/**', r => ['GET','HEAD','OPTIONS'].includes(r.request().method()) ? r.continue() : r.fulfill({status:409,json:{detail:'Read-only visual check'}}));
 await page.goto('http://localhost:5190');
 await expect(page.locator('.mode-badge')).toContainText('Connected',{timeout:30000});
 await expect(page.locator('.villager-label .portrait img').first()).toBeVisible({timeout:30000});
 await expect.poll(()=>page.locator('.villager-label .portrait img').evaluateAll(imgs=>imgs.filter(i=>i.naturalWidth>0).length)).toBeGreaterThan(0);
 await mkdir('test-results/web015',{recursive:true});
 await page.screenshot({path:'test-results/web015/live-name-tags.png'});
 console.log('Live protected portrait images loaded:',await page.locator('.villager-label .portrait img').count());
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/web015/live-phone-people.png'});
} finally { await browser.close(); }
