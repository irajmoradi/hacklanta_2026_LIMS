import { test } from 'bun:test';
import { chromium, expect } from '../../apps/web/node_modules/@playwright/test/index.mjs';
import { fileURLToPath } from 'node:url';

// External HTTPS only: no Vite/API ports or shared test DB. The runner can safely
// execute this Bun-hosted Playwright test independently of fixed-port suites.
test('public staging fixture village renders without remote mutations', async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    // Exercise the app's supported low-power quality path on software WebGL.
    await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
    const errors: string[] = [], writes: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push(r.url()); });
    const response = await page.goto('https://stage.207-246-81-187.sslip.io/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('.mode-badge')).toHaveText('Demo village', { timeout: 60000 });
    await page.getByRole('dialog', { name: 'Who are you testing as?' }).getByRole('button', { name: 'Ir Iraj', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open Settings' })).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: fileURLToPath(new URL('../../docs/infra/screenshots/deploy-stage.png', import.meta.url)), timeout: 90000 });
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  } finally {
    await browser.close();
  }
}, 180000);
