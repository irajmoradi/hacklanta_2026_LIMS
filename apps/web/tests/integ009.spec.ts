import { expect, test } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

test('dashboard and corner popout keep currency balances in sync', async ({ page }) => {
  await page.goto('/');
  const corner = page.locator('[data-widget="corner"]');
  await expect(corner.getByTestId('my-xp')).toHaveText('420');
  await expect(corner.getByTestId('my-coins')).toContainText('420 coins');
  for (const currency of ['XP', 'coins', 'SOL']) {
    await expect(corner.locator(`[data-currency="${currency}"]`).first()).toBeVisible();
  }
  await page.getByRole('button', { name: 'Pop out Your corner', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Your corner', exact: true });
  await expect(popup.locator('.wallet-balances')).toContainText('420 coins');
  await expect(popup.locator('.wallet-balances')).toContainText('devnet · test');
  await expect(page.getByTestId('my-xp')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await corner.getByRole('button', { name: 'Check in today', exact: true }).click();
  await page.locator('textarea').first().fill('Finished the integration checks.');
  await page.getByRole('button', { name: /Share check-in/ }).click();
  await expect(corner.getByTestId('my-xp')).not.toHaveText('420');
  await expect(corner.getByTestId('my-coins')).not.toContainText('420 coins');
  await page.screenshot({ path: 'artifacts/integ009/dashboard-currencies.png' });
});
