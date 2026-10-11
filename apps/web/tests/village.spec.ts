import { useDemoSeat } from './demoSeat';
useDemoSeat();
import { expect, test } from '@playwright/test';

for (const touch of [false, true]) {
  test.describe(touch ? 'touch labels' : 'desktop labels', () => {
    test.use({ hasTouch: touch, viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
    test('HUD wins overlapping label hit tests and villagers remain selectable', async ({ page }, info) => {
      await page.goto('/');
      // This test deliberately relocates a label; automatic collision spacing must
      // not move that synthetic target while pointer/touch hit order is checked.
      await page.addStyleTag({content: '.villager-label { translate: none !important; }'});
      const label = page.getByTestId('villager-Mario');
      await expect(label).toBeVisible();
      const profile = page.getByRole('button', { name: 'My profile', exact: true });
      // Exercise an actual projected label over the HUD regardless of camera/layout changes.
      const box = (await profile.boundingBox())!;
      await label.evaluate((el, box) => {
        const rect = el.getBoundingClientRect();
        el.style.position = 'relative';
        el.style.left = `${box.x - rect.x}px`;
        el.style.top = `${box.y - rect.y}px`;
        el.style.width = `${box.width}px`;
        el.style.height = `${box.height}px`;
      }, box);
      if (touch) await profile.tap(); else await profile.click();
      await expect(page.getByRole('heading', { name: 'Iraj', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Close profile' }).click();
      if (touch) await page.getByRole('button', {name:'Collapse dashboard', exact:true}).click();
      // Place the same label in clear scene space, then use real pointer/touch input.
      await label.evaluate(el => {
        ['position','left','top','width','height'].forEach(key => el.style.removeProperty(key));
        const rect = el.getBoundingClientRect();
        el.style.position = 'relative';
        // The mobile self-card occupies the viewport center. Use open space
        // below it and left of the card, keeping the real HUD in front.
        el.style.left = `${innerWidth * (innerWidth < 700 ? .12 : .5) - rect.x}px`;
        el.style.top = `${innerHeight * (innerWidth < 700 ? .68 : .5) - rect.y}px`;
      });
      if (touch) await label.tap(); else await label.click();
      await expect(page.getByRole('heading', { name: 'Mario', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Close profile' }).click();
      await label.evaluate(el => ['position','left','top','width','height'].forEach(key => el.style.removeProperty(key)));
      await page.screenshot({ path: info.outputPath('hud-labels.png') });
    });
  });
}

test('village → profile → check-in exactly once → shop purchase', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your friends./ })).toBeVisible();
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await expect(page.getByTestId('village-scene').locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/village-overview.png', animations: 'disabled' });
  await page.getByTestId('villager-Stefanny').click();
  const panel = page.getByRole('complementary', { name: 'Villager profile' });
  await expect(panel.getByRole('heading', { name: 'Stefanny', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', {name:'Make a little art every day',exact:true})).toBeVisible();
  await page.locator('.village-main').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  await page.screenshot({ path: 'test-results/village-profile.png', animations: 'disabled' });
  await panel.getByRole('button', { name: 'Hear them' }).click();
  await expect(panel.getByText('Their voice is not connected yet. Come back soon.')).toBeVisible();
  await page.getByRole('button', { name: 'Close profile' }).click();

  const before = Number(await page.getByTestId('my-xp').textContent());
  // Observe the same client boundary used by the form, keeping real mock state and UI behavior.
  await page.evaluate(async () => {
    // @ts-expect-error Browser-served Vite source module.
    const { api } = await import('/src/api/client.ts');
    const original = api.checkIn.bind(api);
    (window as unknown as { lastCheckIn: unknown }).lastCheckIn = null;
    api.checkIn = async (vid: string, body: unknown) => {
      (window as unknown as { lastCheckIn: unknown }).lastCheckIn = { vid, body };
      return original(vid, body);
    };
  });
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await page.getByRole('button', { name: /Goal progress/ }).click();
  await page.getByLabel('What did you make progress on?').fill('Built a cozy little village with my friends.');
  await page.getByRole('button', { name: 'Share check-in', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('my-xp')).toHaveText(String(before + 25));
  await expect(page.locator('.village-toast[data-kind=reward]')).toContainText('+25 XP');
  const retried = await page.evaluate(async () => {
    // @ts-expect-error Browser-served Vite source module.
    const { api } = await import('/src/api/client.ts');
    const { vid, body } = (window as unknown as { lastCheckIn: { vid: string; body: unknown } }).lastCheckIn;
    const result = await api.checkIn(vid, body);
    const profile = await api.profile(vid, api.user);
    return { award: result.xp_awarded, xp: profile.villager.xp, count: profile.check_ins.filter((c: { body: string }) => c.body === 'Built a cozy little village with my friends.').length };
  });
  expect(retried).toEqual({ award: 0, xp: before + 25, count: 1 });
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.getByTestId('shop-balance')).toHaveText(String(before + 25));
  await page.getByRole('button', { name: 'Buy Village Crown', exact: true }).click();
  await expect(page.getByTestId('shop-balance')).toHaveText(String(before + 25 - 250));
  await expect(page.getByRole('button', { name: 'Buy Village Crown' })).toBeDisabled();
  await expect(page.getByTestId('my-xp')).toHaveText(String(before + 25));
  expect(errors).toEqual([]);
});

test('goal edits, Mayor, evidence, switching users and feed collapse', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'My goal', exact: true }).click();
  await page.getByLabel('This week, I want to…').fill('Walk outside every day');
  await page.getByRole('button', { name: 'Save my goal' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Visit Iraj' }).click();
  await expect(page.getByRole('heading', { name: 'Walk outside every day' })).toBeVisible();
  await expect(page.getByTestId('my-xp')).toHaveText('420'); // Existing seeded goal was already rewarded.
  await page.getByRole('button', { name: 'Close profile' }).click();
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  await page.getByRole('button', {name:/Make a prayer/}).click();
  await page.getByLabel('Pray to the Mayor').fill('A little motivation for tomorrow');
  await page.getByRole('button', { name: 'Send wish' }).click();
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();
  await page.getByRole('button', { name: 'Weekly recap', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This week in the village' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', {name: /Testing as Iraj/}).click();
  await page.getByRole('dialog').getByRole('button', {name: /Maya/}).click();
  await expect(page.getByTestId('my-xp')).toHaveText('350');
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await page.getByRole('button', {name:/Daily note/}).click();
  await page.getByLabel('What’s on your mind today?').fill('Happy to be here.');
  await page.getByLabel('Upload evidence photo').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lS8AAAAASUVORK5CYII=', 'base64') });
  await expect(page.getByText('Your photo will be attached to this check-in', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Share check-in' }).click();
  await expect(page.getByTestId('my-xp')).toHaveText('360');
  await page.getByRole('button', { name: 'Collapse dashboard' }).click();
  await expect(page.locator('.dashboard')).toHaveAttribute('data-collapsed', 'true');
});

test('1920 × 1080 layout and keyboard dialog focus', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expect(page.getByTestId('villager-Mario')).toBeVisible();
  await page.screenshot({ path: 'test-results/village-overview-1920.png', animations: 'disabled' });
  await page.getByTestId('villager-Mario').click();
  await expect(page.getByRole('heading', { name: 'Mario', exact: true })).toBeVisible();
  await page.locator('.village-main').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  await page.screenshot({ path: 'test-results/village-profile-1920.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.profile-panel')).not.toBeVisible();
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await page.getByRole('button', {name:/Daily note/}).click();
  await expect(page.getByLabel('What’s on your mind today?')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
