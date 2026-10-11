import { test, expect, type Page } from '@playwright/test';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID } from '../src/api/fixtures';

test.beforeEach(async ({ page }) => {
  const api = new MockApi();
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    try {
      const data = await api.request<unknown>(request.method(), url.pathname.slice(4) + url.search, request.headers()['x-demo-user'] ?? DEMO_USER_ID, request.postDataJSON() ?? undefined);
      if (data && typeof data === 'object' && 'entry_lamports' in data) Object.assign(data, { pot_address: '11111111111111111111111111111111' });
      await route.fulfill({ json: data });
    } catch (e) { await route.fulfill({ status: (e as { status?: number }).status ?? 500, json: { detail: String(e) } }); }
  });
  await page.route('**/models/**', r => r.fulfill({ status: 404, body: 'Offline' }));
  await page.route('https://api.devnet.solana.com/**', () => { throw new Error('Tests must never call RPC'); });
  await page.addInitScript(() => { window.walletTest = { signed: 0, simulations: 0 }; });
});

test('Gazette ticker, archive, profile links and mobile print layout', async ({ page }, info) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Village', exact: true }).click();
  await page.getByRole('button', { name: /Today's headline/ }).click();
  await expect(page.getByRole('heading', { name: 'The weekly goals are in' })).toBeVisible();
  await expect(page.getByText('AI-generated · Model: scripted-demo')).toBeVisible();
  await page.getByLabel('Past issues').selectOption({ index: 1 });
  await expect(page.getByRole('heading', { name: 'Around the village' })).toBeVisible();
  if (info.project.name === 'flag-off') await page.screenshot({ path: 'tests/artifacts/web012-gazette-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  if (info.project.name === 'flag-off') await page.screenshot({ path: 'tests/artifacts/web012-gazette-mobile.png' });
  await page.getByRole('button', { name: 'Visit Lance →', exact: true }).click();
  await expect(page.locator('dialog.modal')).not.toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Villager profile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lance', exact: true })).toBeVisible();
});
test('memory and recoverable event tiers are visible', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: 'AI at work', exact: true }).click();
  const memory = page.getByRole('region', { name: "Mayor's memory" });
  await expect(memory.getByText('Our village', { exact: true })).toBeVisible();
  await expect(memory.getByText('Lance', { exact: true })).toBeVisible();
  await expect(memory.locator('time')).toHaveCount(6);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  for (const text of ['group', '2 hours', '30–60 XP', 'Recovery: Share one group check-in to clear the fog.']) await expect(page.getByText(text, { exact: true })).toBeVisible();
});
async function competition(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: 'Compete', exact: true }).click();
  await page.getByRole('button', { name: 'Create competition', exact: true }).click();
  await page.getByLabel('Competition title').fill('Garden sprint'); await page.getByLabel('Terms', { exact: true }).fill('Share a small step.');
  await page.getByLabel('Optional SOL entry intent').fill('0.01');
  await page.getByRole('button', { name: 'Create competition with these terms' }).click();
}
test('both Solana flag states and separate simulation/signature actions', async ({ page }, info) => {
  await competition(page);
  if (info.project.name === 'flag-off') {
    await expect(page.getByText('On-chain pot: coming soon (devnet)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join pot with wallet' })).toHaveCount(0); return;
  }
  await page.getByRole('button', { name: 'Join pot with wallet' }).click();
  await expect(page.getByRole('button', { name: 'Approve signature' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Simulate join on DEVNET' }).click();
  await expect(page.getByRole('heading', { name: 'Simulation succeeded · DEVNET' })).toBeVisible();
  await expect(page.getByText('0.010000000 SOL', { exact: true })).toBeVisible();
  await expect(page.getByText('0.000005000 SOL', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.walletTest?.signed)).toBe(0);
  await page.screenshot({ path: 'tests/artifacts/web012-wallet-review.png' });
  await page.getByRole('button', { name: 'Approve signature' }).click();
  await expect(page.getByText('Signed locally; not broadcast. You have not joined the on-chain pot.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve signature' })).toBeDisabled();
  expect(await page.evaluate(() => window.walletTest?.signed)).toBe(1);
});
test('actual wallet hooks mount without a wallet, RPC, or React version conflicts', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await competition(page); await page.getByRole('button', { name: 'Join pot with wallet' }).click();
  await expect(page.getByText('No compatible wallet found.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve signature' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('failed simulations and missing fees cannot request a signature', async ({ page }, info) => {
  test.skip(info.project.name === 'flag-off', 'Signature controls only exist with the flag enabled');
  await competition(page); await page.getByRole('button', { name: 'Join pot with wallet' }).click();
  await page.evaluate(() => { window.walletTest!.failed = true; });
  await page.getByRole('button', { name: 'Simulate join on DEVNET' }).click();
  await expect(page.getByRole('heading', { name: 'Simulation failed · DEVNET' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve signature' })).toBeDisabled();
  await page.evaluate(() => { window.walletTest!.failed = false; window.walletTest!.noFee = true; });
  await page.getByRole('button', { name: 'Simulate join on DEVNET' }).click();
  await expect(page.getByRole('heading', { name: 'Simulation succeeded · DEVNET' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve signature' })).toBeDisabled();
  expect(await page.evaluate(() => window.walletTest?.signed)).toBe(0);
});
test('unavailable Gazette and memory can retry without fabricated live content', async ({ page }) => {
  await page.route('**/api/villages/*/gazette**', r => r.fulfill({ status: 503, json: { detail: 'Not published' } }));
  await page.route('**/api/villages/*/mayor/memory', r => r.fulfill({ status: 503, json: { detail: 'Memory offline' } }));
  await page.goto('/', { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: 'Gazette', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Not published');
  await page.unroute('**/api/villages/*/gazette**'); await page.getByRole('button', { name: 'Retry Gazette' }).click();
  await expect(page.getByRole('heading', { name: 'The weekly goals are in' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click(); await page.getByRole('button', { name: 'AI at work', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Memory offline');
  await page.unroute('**/api/villages/*/mayor/memory'); await page.getByRole('button', { name: 'Retry memory' }).click();
  await expect(page.getByText('Our village', { exact: true })).toBeVisible();
});
