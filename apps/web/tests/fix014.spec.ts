import { expect, test, type Locator } from '@playwright/test';

async function expectContained(panel: Locator) {
  const overflow = await panel.evaluate(root => {
    const bounds = root.getBoundingClientRect();
    return Array.from(root.querySelectorAll('*')).flatMap(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return [];
      // Ellipsized text can have a larger scrollWidth without escaping its box.
      const clipped = ['hidden', 'clip'].includes(getComputedStyle(el).overflowX);
      return r.left < bounds.left - 1 || r.right > bounds.right + 1 || (!clipped && el.scrollWidth > el.clientWidth + 1)
        ? [`${el.tagName}.${el.getAttribute('class') ?? ''}: ${Math.round(r.left)}..${Math.round(r.right)}, scroll ${el.scrollWidth}/${el.clientWidth}`] : [];
    });
  });
  expect(overflow).toEqual([]);
}

for (const width of [1280, 1440, 1920, 390, 320]) test(`all profile tabs fit at ${width}px`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/**', route => new URL(route.request().url()).pathname.startsWith('/api/') ? route.abort() : route.continue());
  await page.route('**/models/**', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/tests/fix014.html');
  const panel = page.locator('.profile-panel');
  await expect(panel.getByText('Learned something new')).toBeVisible();
  const before = process.env.FIX014_BEFORE === '1';
  for (const tab of ['Overview', 'Outfit', 'House', 'Rewards', 'Activity']) {
    await panel.getByRole('tab', { name: tab, exact: true }).click();
    await expect(panel.getByRole('tabpanel')).not.toContainText(/Loading|Catching up/);
    await panel.screenshot({ path: `artifacts/fix014/${before ? 'before' : 'after'}-${width}-${tab.toLowerCase()}.png` });
    if (!before) await expectContained(panel);
  }
  if (before) return;
  await panel.getByRole('tab', { name: 'Overview', exact: true }).click();
  const card = panel.getByRole('region', { name: 'Accomplishments', exact: true });
  await expect(card.locator('article')).toHaveCount(2);
  for (const row of await card.locator('article').all()) await expect(row).toHaveCSS('border-bottom-width', '0px');
  await card.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: `artifacts/fix014/after-${width}-accomplishments.png` });
  await card.getByRole('button', { name: 'Add reaction', exact: true }).first().click();
  await expectContained(panel);
  await expect(panel.locator('.profile-name').getByRole('button', { name: 'Profile settings' })).toHaveCount(1);
  await panel.getByRole('button', { name: 'Profile settings' }).click();
  await expect(page.getByRole('status').filter({hasText:'Settings opened'})).toHaveText('Settings opened');
  await page.goto('/tests/fix014.html?peer&long');
  await expect(panel.getByText('Learned something new')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Profile settings' })).toHaveCount(0);
  await expectContained(panel);
  expect(errors).toEqual([]);
});
