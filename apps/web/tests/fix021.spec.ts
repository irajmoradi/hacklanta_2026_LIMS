import { test, expect } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    localStorage.setItem('village:sound', JSON.stringify({ muted: true }));
  });
  await page.route(url => url.pathname.startsWith('/api/'), route => route.abort());
  await page.goto('/');
});

test('reward locks explain how to earn without internal identifiers', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  const badge = page.locator('.shop-item').filter({ hasText: 'Auditor Badge' });
  await expect(badge).toBeVisible();
  await expect(badge.locator('.shop-reasons')).not.toContainText('earned:');
  await expect(badge.locator('.shop-reasons')).toContainText(/audit/i);
  const mantle = page.locator('.shop-item').filter({ hasText: 'Champion Mantle' });
  await expect(mantle.locator('.shop-reasons')).toContainText(/weekly crown/i);
  await expect(page.locator('.shop-grid')).not.toContainText(/Earn-only:|earned:|event:/);
  await page.screenshot({ path: `tests/artifacts/fix021/shop-${info.project.name}.png` });
});

test('leaving the interior restores Go inside focus', async ({ page }, info) => {
  await page.getByRole('button', { name: 'My profile', exact: true }).click();
  await page.getByRole('tab', { name: 'House', exact: true }).click();
  const opener = page.getByRole('button', { name: 'Go inside', exact: true });
  for (const escape of [true, false]) {
    await opener.click();
    await expect(page.getByRole('status').filter({ hasText: 'Offline room' })).toBeVisible();
    if (escape) await page.keyboard.press('Escape');
    else await page.getByRole('button', { name: 'Back to village', exact: true }).click();
    await expect(page.locator('.interior-dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
  await page.screenshot({ path: `tests/artifacts/fix021/house-${info.project.name}.png` });
});

test('cancelling join restores the initiating Join button', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Compete', exact: true }).click();
  await page.getByRole('button', { name: /\+ Create/ }).click();
  await page.getByLabel('Competition title').fill('Focus return challenge');
  await page.getByLabel('Terms', { exact: true }).fill('A fixture challenge for cancelling the join dialog.');
  await page.getByRole('button', { name: 'Create competition with these terms' }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  const opener = page.getByRole('button', { name: /^Join / });
  for (const escape of [false, true]) {
    await opener.click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    if (escape) await page.keyboard.press('Escape');
    else await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(page.getByLabel('Leaderboard', { exact: true })).toContainText('No participants yet');
  }
  await page.screenshot({ path: `tests/artifacts/fix021/join-${info.project.name}.png` });
});
