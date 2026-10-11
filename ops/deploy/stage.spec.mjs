import { test, expect } from '../../apps/web/node_modules/@playwright/test/index.mjs';
import { fileURLToPath } from 'node:url';

test('staging serves the fixture village with GPU and paid services unused', async ({ page, request }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  const errors = [];
  const writes = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push(r.url()); });
  expect((await request.get('/')).status()).toBe(200);
  await page.goto('/');
  // Desktop CSS hides this status badge; its text still verifies mock mode.
  await expect(page.locator('.mode-badge')).toHaveText('Demo village', { timeout: 60000 });
  await page.getByRole('dialog', { name: 'Who are you testing as?' }).getByRole('button', { name: 'Ir Iraj', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Settings' })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: fileURLToPath(new URL('../../docs/infra/screenshots/deploy-stage.png', import.meta.url)), timeout: 90000 });
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});
