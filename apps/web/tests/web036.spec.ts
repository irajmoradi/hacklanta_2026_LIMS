import { test, expect, type Page } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

async function outbreak(page: Page) {
  await page.getByRole('button', { name: 'Debug menu' }).click();
  await page.getByText('Trigger disaster', { exact: false }).click();
  await page.getByRole('button', { name: 'outbreak', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
}

test('screenshots and alert interactions', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  await outbreak(page);
  await page.screenshot({ animations: 'disabled', path: `tests/screenshots/WEB-036/${process.env.WEB036_BASELINE ? 'before' : 'after'}-town.png` });
  if (!process.env.WEB036_BASELINE) {
    const badge = page.getByRole('button', { name: /Alerts, \d+ active/ });
    const dropdown = page.getByRole('region', { name: 'Village alerts' });
    await expect(badge).toHaveAccessibleName('Alerts, 2 active, repair 0%');
    const icon = badge.locator('[data-icon="warning"]');
    await expect(icon).toHaveCSS('width', '18px');
    await expect(icon).toHaveCSS('transform', 'none');
    await badge.click();
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('[data-disaster="outbreak"] [data-icon="paw"]')).toBeVisible();
    await page.getByRole('button', { name: 'Minimize alerts' }).click();
    await expect(dropdown).toBeHidden();
    await badge.click();
    await expect(dropdown).toBeVisible();
    await page.getByTestId('village-scene').dispatchEvent('pointerdown');
    await expect(dropdown).toBeHidden();
    await badge.click();
    await expect(dropdown).toBeHidden({ timeout: 8000 });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await badge.click();
      await expect(dropdown).toBeVisible();
      const panel = (await dropdown.boundingBox())!;
      const scene = (await page.getByTestId('village-scene').boundingBox())!;
      const bar = (await page.locator('.topbar').boundingBox())!;
      const icon = (await badge.boundingBox())!;
      expect(icon.y).toBeGreaterThanOrEqual(bar.y);
      expect(icon.y + icon.height).toBeLessThanOrEqual(bar.y + bar.height);
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      expect(panel.y).toBeGreaterThanOrEqual(icon.y + icon.height);
      expect(panel.y + panel.height).toBeLessThan(scene.y + scene.height / 2);
      await page.screenshot({ animations: 'disabled', path: `tests/screenshots/WEB-036/after-dropdown-${width}.png` });
      await page.getByRole('button', { name: 'Minimize alerts' }).click();
      await page.screenshot({ animations: 'disabled', path: `tests/screenshots/WEB-036/after-badge-${width}.png` });
    }
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await page.getByRole('button', { name: 'Compete', exact: true }).click();
  await page.getByRole('button', { name: /The seven-day sprint/ }).click();
  await expect(page.getByLabel('Auditor booth', {exact:true})).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: `tests/screenshots/WEB-036/${process.env.WEB036_BASELINE ? 'before' : 'after'}-auditor.png` });
  if (!process.env.WEB036_BASELINE) {
    const booth = page.getByLabel('Auditor booth', {exact:true});
    await expect(booth).toContainText('Review 1/4');
    await booth.getByRole('button', { name: 'Auditor help' }).focus();
    await expect(booth.getByRole('tooltip').filter({ hasText: 'J / K' })).toBeVisible();
    await booth.getByRole('button', { name: 'Next review' }).click();
    await expect(booth).toContainText('Review 2/4');
    await booth.getByRole('button', { name: 'Previous review' }).click();
    await expect(booth).toContainText('Points: set by you');
    await expect(booth.getByLabel('Auditor note')).toHaveAttribute('placeholder', 'Why?');
    await booth.getByLabel('Auditor note').fill('Evidence checked.');
    await booth.getByLabel('Award points').fill('40');
    await booth.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(booth).toContainText('Review 1/3');
    await expect(page.getByRole('button', { name: 'Progress of Lance' })).toContainText('70 points');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ animations: 'disabled', path: 'tests/screenshots/WEB-036/after-auditor-mobile.png' });
  }
});

test('challenge badge survives repair and opens event details', async ({ page }) => {
  await page.goto('/');
  const badge = page.getByRole('button', { name: /Alerts, \d+ active/ });
  await expect(badge).toHaveAccessibleName('Alerts, 1 active');
  await outbreak(page);
  await expect(badge).toHaveAccessibleName('Alerts, 2 active, repair 0%');
  await page.getByRole('button', { name: 'Debug menu' }).click();
  await page.getByRole('button', { name: 'Repair now', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(badge).toHaveAccessibleName('Alerts, 1 active');
  await badge.click();
  await page.getByRole('button', { name: 'View challenge →' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

