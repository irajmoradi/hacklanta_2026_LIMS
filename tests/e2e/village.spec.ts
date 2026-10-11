import { expect, test, type Page } from '@playwright/test';
import { ok, owner, users, village, profile, shop, note } from '../support/api';

async function openVillage(page: Page, v: any) {
  // No synthetic API responses: select only the real QA membership in /me.
  // Restrict the real membership response to this test's village.
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.slice(4);
    const requestedVillage = path.match(/^\/villages\/([^/]+)/)?.[1];
    if ((requestedVillage && requestedVillage !== v.id) ||
        (request.method() !== 'GET' && !path.startsWith(`/villages/${v.id}/`))) {
      await route.abort('blockedbyclient');
      throw new Error(`Isolation guard blocked ${request.method()} ${path}`);
    }
    const headers = { ...request.headers(), 'x-demo-user': owner };
    if (path === '/me') {
      const response = await route.fetch({ headers });
      expect(response.ok()).toBe(true);
      const identity = await response.json();
      identity.villages = identity.villages.filter((entry: any) => entry.id === v.id);
      expect(identity.villages).toHaveLength(1);
      await route.fulfill({ response, json: identity });
    } else await route.continue({ headers });
  });
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Village', { exact: true })).toHaveValue(v.id);
  await expect(page.getByLabel('Village', { exact: true }).locator('option:checked')).toHaveText(v.name);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Visit QA\u00b7Friend5', exact: true })).toBeVisible();
  await page.getByLabel('Play as').selectOption(owner);
  await expect(page.getByLabel('Play as')).toHaveValue(owner);
  await expect(page.locator('.self-heading')).toContainText('Hey, QA\u00b7Friend5');
}

test('API join → live village → profile → goal → status/retry → purchase', async ({ page }, info) => {
  const v = await village('browser', users.slice(0, 4));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openVillage(page, v);
  await page.getByRole('button', { name: 'My profile', exact: true }).click();
  await expect(page.getByRole('complementary').getByRole('heading', { name: 'QA\u00b7Friend5', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('profile.png') });
  await page.getByRole('button', { name: 'Close profile' }).click();
  await page.getByRole('button', { name: 'Weekly goal', exact: true }).click();
  await page.locator('#goal-title').fill('QA browser weekly goal');
  await page.getByRole('button', { name: 'Save weekly goal' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('my-xp')).toHaveText('20');
  expect((await profile(v.id)).goal.title).toBe('QA browser weekly goal');
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await page.locator('#checkin-body').fill('QA browser synthetic daily note');
  const sent = page.waitForResponse(r => r.url().endsWith(`/villages/${v.id}/check-ins`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Share check-in', exact: true }).click();
  const response = await sent;
  expect(response.status()).toBe(200);
  const first = await response.json();
  expect(first.xp_awarded).toBe(10);
  await expect(page.getByTestId('my-xp')).toHaveText('30');
  const retry = await ok(`/villages/${v.id}/check-ins`, owner, response.request().postDataJSON());
  expect(retry.xp_awarded).toBe(0);
  expect(retry.check_in.id).toBe(first.check_in.id);
  const p = await profile(v.id);
  expect(p.villager.xp).toBe(30);
  expect(p.check_ins.filter((c: any) => c.id === first.check_in.id)).toHaveLength(1);
  const inventory = await shop(v.id);
  const item = inventory.items.find((i: any) => !i.requires && i.price_xp > 0 && i.price_xp <= 30);
  expect(item, 'Catalog needs an affordable starter item after goal + daily note').toBeDefined();
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByRole('button', { name: `Buy ${item.name}`, exact: true }).click();
  await expect(page.getByTestId('shop-balance')).toHaveText(String(30 - item.price_xp));
  await expect(page.getByTestId('my-xp')).toHaveText(String(30 - item.price_xp));
  expect((await shop(v.id)).balance).toBe(30 - item.price_xp);
  await page.screenshot({ path: info.outputPath('purchase.png') });
  expect(errors).toEqual([]);
});

test('real insufficient-funds race displays server error without losing balance', async ({ page }, info) => {
  const v = await village('insufficient');
  const items = (await shop(v.id)).items.filter((i: any) => !i.requires && i.price_xp > 0).sort((a: any, b: any) => a.price_xp - b.price_xp);
  const [first, second] = items;
  expect(second).toBeDefined();
  await ok(`/villages/${v.id}/goals`, owner, { title: 'QA race funding goal' });
  await ok(`/villages/${v.id}/check-ins`, owner, note('QA race funding daily note'));
  expect(second.price_xp).toBeLessThanOrEqual(30);
  await openVillage(page, v);
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.getByRole('button', { name: `Buy ${second.name}`, exact: true })).toBeEnabled();
  // Another client spends the balance after this dialog fetched it. No mocked 409.
  const spent = await ok(`/villages/${v.id}/shop/buy`, owner, { item_id: first.id });
  expect(spent.balance).toBeLessThan(second.price_xp);
  const rejected = page.waitForResponse(r => r.url().endsWith('/shop/buy'));
  await page.getByRole('button', { name: `Buy ${second.name}`, exact: true }).click();
  expect((await rejected).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText(/insufficient/i);
  expect((await shop(v.id)).balance).toBe(spent.balance);
  await expect(page.getByTestId('shop-balance')).toHaveText(String(spent.balance));
  await page.screenshot({ path: info.outputPath('insufficient.png') });
});

test('fresh QA identity reads live settings and weekly audit without generation', async ({ page }, info) => {
  const v = await village('settings-week', users.slice(0, 4));
  await openVillage(page, v);
  await page.getByRole('button', { name: 'My profile', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('QA\u00b7Friend5');
  await page.screenshot({ path: info.outputPath('settings.png') });
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Close profile', exact: true }).click();
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This week', exact: true })).toBeVisible();
  await expect(page.locator('.audit-banner')).toContainText('Auditor:');
  expect(users).toContain((await ok(`/villages/${v.id}/weekly/current`)).auditor_id);
  await page.screenshot({ path: info.outputPath('weekly.png') });
});

test('QA-003 village owner can reach group photo upload on mobile', async ({ page }, info) => {
  const v = await village('wave3-owner');
  await openVillage(page, v);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Village', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Village growth' })).toBeVisible();
  await expect(page.locator('.growth-level')).toContainText('Level 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: info.outputPath('live-mobile-growth.png') });
  await page.getByRole('button', { name: 'Our group photo', exact: true }).click();
  await page.screenshot({ path: info.outputPath('live-owner-group-photo.png') });
  await expect(page.getByLabel('Group photo', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find our people' })).toBeDisabled();
});

test('Mayor prayer returns and renders a real event (explicit opt-in; one call)', async ({ page }, info) => {
  test.skip(process.env.QA_ALLOW_MAYOR !== '1', 'Set QA_ALLOW_MAYOR=1 for one explicitly authorized provider call; canned fallback accepted.');
  const v = await village('mayor');
  await openVillage(page, v);
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  await page.getByLabel('Pray to the Mayor').fill('QA smoke test: suggest one small positive activity.');
  const pending = page.waitForResponse(r => r.url().endsWith('/mayor/pray'));
  await page.getByRole('button', { name: 'Send a little wish' }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  const event = await response.json();
  expect(event.id).toBeTruthy();
  expect(['challenge', 'recap', 'random_event', 'prayer_response']).toContain(event.kind);
  expect(Number.isInteger(event.reward_xp)).toBe(true);
  expect(event.reward_xp).toBeGreaterThanOrEqual(0);
  expect(event.reward_xp).toBeLessThanOrEqual(500);
  await expect(page.locator('.mayor-response')).toContainText(event.title);
  expect((await ok(`/villages/${v.id}`)).active_events.some((e: any) => e.id === event.id)).toBe(true);
  await page.screenshot({ path: info.outputPath('mayor.png') });
});

test('worker actually down → live village and selectable fallback', async ({ page }) => {
  const health = await ok('/health');
  test.skip(health.gpu_worker !== 'down', 'Worker is up; task prohibits stopping/restarting it.');
  const v = await village('offline-browser');
  await openVillage(page, v);
  await page.getByRole('button', { name: 'Visit QA\u00b7Friend5', exact: true }).click();
  await expect(page.getByRole('complementary').getByRole('heading', { name: 'QA\u00b7Friend5', exact: true })).toBeVisible();
});
