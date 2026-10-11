import { expect, test } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

test('coins buy an item without spending XP; debug grants coins; offline assets work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/models/**', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.getByTestId('my-xp')).toHaveText('420');
  await expect(page.getByTestId('my-coins')).toContainText('420 coins');
  await expect(page.locator('.wallet-balances')).toContainText('devnet · test');
  await page.screenshot({ path: 'tests/screenshots/FEAT-007/hud.png' });
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByRole('button', { name: 'Buy Village Cap', exact: true }).click();
  await expect(page.getByTestId('shop-balance')).toHaveText('395');
  await expect(page.getByTestId('my-xp')).toHaveText('420');
  await expect(page.locator('.shop-intro [data-currency="coins"]')).toBeVisible();
  await page.locator('.shop-intro').evaluate(el => el.scrollIntoView({block: 'start'}));
  await page.screenshot({ path: 'tests/screenshots/FEAT-007/shop.png' });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Debug menu', exact: true }).click();
  await page.getByRole('button', { name: '+500 coins', exact: true }).click();
  await expect(page.getByTestId('my-coins')).toContainText('895 coins');
  await expect(page.getByTestId('my-xp')).toHaveText('420');
  await page.screenshot({ path: 'tests/screenshots/FEAT-007/debug.png' });
  expect(errors).toEqual([]);
});

test('competition pots show SOL test amounts without XP stakes or signing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compete', exact: true }).click();
  await page.getByRole('button', { name: /\+ Create/ }).click();
  await page.getByLabel('Competition title').fill('Coin era challenge');
  await page.getByLabel('Terms', { exact: true }).fill('One focused session with evidence.');
  await page.getByLabel('Optional SOL entry intent').fill('0.01');
  await page.getByRole('button', { name: 'Create competition with these terms' }).click();
  // New competitions open the current standings; invitations live under Open.
  await page.getByRole('navigation', {name:'Competition list filters'}).getByRole('button', {name:'Open', exact:true}).click();
  const terms = page.getByLabel('Competition terms', { exact: true });
  await expect(terms).toContainText('Progress only · never staked');
  await expect(terms).toContainText('0.01 SOL');
  await expect(terms).toContainText('devnet · test');
  await expect(terms.locator('[data-currency="SOL"]').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/FEAT-007/competition.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'tests/screenshots/FEAT-007/competition-mobile.png' });
});
