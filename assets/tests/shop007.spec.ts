import { expect, test } from '../../apps/web/node_modules/@playwright/test';
import { useDemoSeat } from '../../apps/web/tests/demoSeat';
useDemoSeat();

async function decodedArt(page: import('../../apps/web/node_modules/@playwright/test').Page) {
  await page.locator('.item-thumbnail img').evaluateAll(async images => {
    await Promise.all(images.map(async node => {
      const image = node as HTMLImageElement;
      image.loading = 'eager';
      await image.decode().catch(() => {});
    }));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

test('shop, wardrobe and showcase use real thumbnails without per-card canvases', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  const cap = page.locator('.shop-item[data-item-id="hat_cap"]');
  await cap.scrollIntoViewIfNeeded();
  await expect(cap.locator('img')).toHaveJSProperty('naturalWidth', 512);
  await expect(cap.locator('canvas')).toHaveCount(0);
  await expect(cap.locator('.item-thumbnail')).toHaveAttribute('data-rarity', 'common');
  await decodedArt(page);
  await expect(page.locator('.shop-grid canvas')).toHaveCount(0);
  await page.screenshot({ path: 'assets/previews/shop_ui.png' });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'My profile', exact: true }).click();
  const tile = page.locator('.showcase-tile[data-item-id="hat_headphones"]').first();
  await tile.scrollIntoViewIfNeeded();
  await expect(tile.locator('img')).toHaveJSProperty('naturalWidth', 512);
  await page.getByRole('tab', { name: 'Wardrobe', exact: true }).click();
  const owned = page.locator('.shop-item[data-item-id="hat_headphones"]');
  await owned.scrollIntoViewIfNeeded();
  await expect(owned.locator('img')).toHaveJSProperty('naturalWidth', 512);
  await decodedArt(page);
  await page.screenshot({ path: 'assets/previews/shop_wardrobe_ui.png' });
});

test('missing thumbnail loads the live model; purchase still works with every asset offline', async ({ page }) => {
  await page.route('**/thumbs/hat_cap.png', r => r.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  const card = page.locator('.shop-item[data-item-id="hat_cap"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('.item-live-fallback')).toHaveAttribute('data-model', 'hat_cap');
  await expect(card.locator('canvas')).toBeVisible();
  // Inspect the live Three scene: a loaded named mesh proves this is not just a canvas shell.
  await expect.poll(() => page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    const canvas = document.querySelector('.shop-item[data-item-id="hat_cap"] canvas');
    return !!_roots.get(canvas)?.store.getState().scene.getObjectByName('bill');
  })).toBe(true);
  await decodedArt(page);
  await page.screenshot({ path: 'assets/previews/shop_fallback_ui.png' });
  await page.route('**/thumbs/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('**/models/**', r => r.fulfill({ status: 404, body: '' }));
  await page.reload();
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByRole('button', { name: 'Buy Village Cap', exact: true }).click();
  await expect(page.locator('.shop-item[data-item-id="hat_cap"]')).toContainText('Equipped');
});
