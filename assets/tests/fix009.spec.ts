import { expect, test, type Page } from '../../apps/web/node_modules/@playwright/test';
import { useDemoSeat } from '../../apps/web/tests/demoSeat';
useDemoSeat();

async function art(page: Page, id: string) {
  const card = page.locator(`.shop-item[data-item-id="${id}"]`);
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('img')).toHaveAttribute('src', `/thumbs/${id}.png`);
  await expect(card.locator('img')).toHaveJSProperty('naturalWidth', 512);
  await expect(card.locator('canvas')).toHaveCount(0);
}

test('regular shop and farm department show pets, all farm animals, outfits and consumables', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  for (const id of ['pet_dog', 'pet_dog_b', 'outfit_hoodie', 'revival_potion']) await art(page, id);
  for (const id of ['photo_token', 'villagergram']) {
    const img = page.locator(`img[src="/thumbs/${id}.png"]`);
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveJSProperty('naturalWidth', 512);
  }
  await art(page, 'pet_dog');
  await page.screenshot({ path: 'assets/previews/fix009-shop.png' });
  await page.getByRole('tab', { name: 'Farm Store', exact: true }).click();
  for (const id of ['house_paddock', 'goat_kid', 'goat_kid_friend', 'duckling', 'duckling_friend', 'calf', 'calf_friend', 'chicken', 'chicken_friend']) await art(page, id);
  await art(page, 'goat_kid');
  await page.screenshot({ path: 'assets/previews/fix009-farm.png' });
});

test('farm building opens the same cards directly in its store menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.evaluate(async () => {
    const { api } = await import('/src/api/client.ts' as string);
    const village = await api.village('11111111-1111-4111-8111-111111111111');
    const profile = await api.profile(village.id, api.user);
    for (let i = 0; i < 25; i++) await api.checkIn(village.id, {
      kind: 'progress', goal_id: profile.goal.id, body: 'Thumbnail fixture', idempotency_key: `fix009-${i}`,
    });
  });
  // Use the real R3F building click handler, avoiding camera-dependent screen coordinates.
  await expect.poll(() => page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    const scene = _roots.get(document.querySelector('canvas'))?.store.getState().scene;
    return !!scene?.getObjectByName('unlocked:farm_store');
  }), { timeout: 30000 }).toBe(true);
  await page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    const scene = _roots.get(document.querySelector('canvas')).store.getState().scene;
    scene.getObjectByName('unlocked:farm_store').__r3f.handlers.onClick({stopPropagation() {}});
  });
  await expect(page.getByRole('tab', { name: 'Farm Store', exact: true })).toHaveAttribute('aria-selected', 'true');
  await art(page, 'goat_kid');
  await page.screenshot({ path: 'assets/previews/fix009-farm-entry.png' });
});

test('missing farm images keep icons and purchase controls with models offline', async ({ page }) => {
  await page.route('**/thumbs/**', route => route.abort());
  await page.route('**/models/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByRole('tab', { name: 'Farm Store', exact: true }).click();
  const card = page.locator('.shop-item[data-item-id="goat_kid"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('.item-thumbnail svg')).toBeVisible();
  await expect(card.locator('canvas')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Buy Goat Kid', exact: true })).toBeVisible();
});
