import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const label = process.env.WEB023_LABEL ?? 'after';
const out = 'test-results/web023';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = { label, loads: [], zipRequests: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => localStorage.setItem('village:seat:live', '13370000-0000-4000-8000-000000000001'));
  page.on('pageerror', error => console.error(error.message));
  page.on('request', request => { if (/\.zip(?:\?|$)/.test(request.url())) results.zipRequests.push(request.url()); });
  for (let i = 0; i < 2; i++) {
    await page.goto(process.env.WEB023_URL ?? 'http://127.0.0.1:5323');
    await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('village-scene')).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(8000);
    results.loads.push(await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const assets = resources.filter(r => r.name.includes('/api/assets/'));
      return { totalTransferBytes: resources.reduce((sum, r) => sum + r.transferSize, 0),
        assetTransferBytes: assets.reduce((sum, r) => sum + r.transferSize, 0),
        assets: assets.map(r => ({ path: new URL(r.name).pathname, transferBytes: r.transferSize })) };
    }));
  }
  expect(results.zipRequests).toEqual([]);
  results.townZipRequests = results.zipRequests.slice();
  if (label === 'after') {
    await page.getByRole('button', { name: 'My profile', exact: true }).click();
    await page.getByRole('tab', { name: 'Wardrobe', exact: true }).click();
    const preview = page.locator('.wardrobe-preview');
    await expect(preview.locator('canvas')).toBeVisible({ timeout: 30000 });
    await preview.scrollIntoViewIfNeeded();
    const state = () => page.evaluate(async () => {
      const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
      const state = _roots.get(document.querySelector('.wardrobe-preview canvas')).store.getState();
      return { yaw: state.scene.getObjectByName('outfit-rotation').rotation.y, zoom: state.camera.zoom };
    });
    const box = await preview.boundingBox();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.mouse.down();
    const initial = await state();
    await page.waitForTimeout(250);
    expect((await state()).yaw).toBeCloseTo(initial.yaw, 4);
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 12 });
    await expect.poll(async () => Math.abs((await state()).yaw - initial.yaw)).toBeGreaterThan(0.3);
    const dragged = await state();
    await page.mouse.up(); await page.mouse.wheel(0, -300); await page.waitForTimeout(100);
    await expect.poll(async () => (await state()).zoom).toBeGreaterThan(initial.zoom);
    await preview.dblclick(); await page.waitForTimeout(100);
    await expect.poll(async () => (await state()).yaw).toBeCloseTo(0, 3);
    expect((await state()).zoom).toBe(1);
    results.drag = { initial, dragged, reset: await state() };
    const cdp = await page.context().newCDPSession(page);
    const touch = (x, y, id) => ({ x, y, id });
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(center.x - 25, center.y, 1), touch(center.x + 25, center.y, 2)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(center.x - 50, center.y, 1), touch(center.x + 50, center.y, 2)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await state()).zoom).toBeGreaterThan(1);
    await preview.dblclick();
    await expect.poll(async () => (await state()).yaw).toBeCloseTo(0, 3);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(center.x - 40, center.y, 1)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(center.x + 40, center.y, 1)] });
    await expect.poll(async () => Math.abs((await state()).yaw)).toBeGreaterThan(0.3);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    results.touch = await state();
    await preview.dblclick();
    await page.screenshot({ path: `${out}/wardrobe.png` });
  }
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: `${out}/failure.png` });
    await writeFile(`${out}/failure.txt`, await page.locator('body').innerText());
  }
  throw error;
} finally {
  await writeFile(`${out}/${label}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ label, loads: results.loads.map(({ assets, ...rest }) => rest), drag: results.drag, touch: results.touch }));
  await browser.close();
}
