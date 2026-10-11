import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/submission/video/data/demo');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--autoplay-policy=no-user-gesture-required'] });
console.log('Chromium launched');
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.route('**/api/**', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
  await page.goto('http://localhost:4173/?tour=1');
  await page.getByText('Connected', { exact: true }).waitFor();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${output}/inspect-world.png` });
  await page.getByRole('button', { name: 'End tour', exact: true }).click();
  await page.getByRole('button', { name: 'Visit Dev', exact: true }).click();
  await page.locator('.profile-hero [data-head-state="ready"]').waitFor({ timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${output}/inspect-dev.png` });
  await writeFile(`${output}/inspect.txt`, await page.locator('body').innerText());
  console.log('Read-only preview and LAM head inspection passed.');
} finally { await browser.close(); }
