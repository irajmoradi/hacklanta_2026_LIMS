import { chromium } from '@playwright/test';
const phase = process.argv[2] ?? 'after';
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after as the capture phase.');
const baseURL = process.env.POLISH_BASE_URL ?? 'http://localhost:5176';
const browser = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for (const [name, width, height] of [['desktop',1440,900], ['mobile',390,844]]) {
 const page = await browser.newPage({viewport:{width,height}, reducedMotion:'reduce'});
 await page.goto(baseURL);
 await page.getByRole('button',{name:'My profile',exact:true}).waitFor();
 await page.waitForTimeout(2500);
 await page.screenshot({path:`tests/screenshots/POLISH-001/${phase}-${name}.png`});
 await page.getByRole('button',{name:'Check in',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.screenshot({path:`tests/screenshots/POLISH-001/${phase}-${name}-dialog.png`});
 await page.close();
}
await browser.close();
