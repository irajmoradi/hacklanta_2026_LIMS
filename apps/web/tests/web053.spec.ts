import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
test.afterEach(({}, info) => { for (const error of info.errors) console.log(error.message); });
async function pose(page: Page) {
  return page.evaluate(async () => (await import('/tests/web053Scene.ts' as string)).inspect());
}
for (const width of [1440, 1280, 390]) test(`live plaza overlay, dashboard and exact return ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.goto('/?quality=low');
  await expect(page.getByTestId('village-scene')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(async () => (await import('/src/api/client.ts' as string)).api.mode)).toBe('mock');
  await expect.poll(async () => (await pose(page)).zoom).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Mayor', exact: true }).evaluate(async button => {
    const { inspect } = await import('/tests/web053Scene.ts' as string);
    button.addEventListener('click', () => { (window as any).__mayorBefore = inspect(); }, { capture: true, once: true });
  });
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  const before = await page.evaluate(() => (window as any).__mayorBefore);
  const dialog = page.getByRole('dialog', { name: 'A visit to the Mayor' });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => (await pose(page)).zoom, { timeout: 30000 }).toBeGreaterThan(80);
  const during = await pose(page);
  expect(during.zoom).toBeGreaterThan(before.zoom * 2);
  expect(during.enabled).toBe(false);
  expect(during.screen[1]).toBeGreaterThan(width === 390 ? .45 : .15);

  const samples = await page.evaluate(async () => {
    const { inspect } = await import('/tests/web053Scene.ts' as string);
    const poses = [], start = performance.now();
    while (performance.now() - start < 2000 || poses.length < 24) {
      await new Promise(requestAnimationFrame);
      poses.push(inspect());
    }
    return poses;
  });
  const ys = samples.map(p => p.position[1]);
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(.02);
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(.06);
  for (const p of samples) expect(p.position[1] - p.statue[1]).toBeCloseTo(during.position[1] - during.statue[1], 4);
  expect(await dialog.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await page.screenshot({ path: `artifacts/web053/mayor-${width}.png` });
  if (width === 390) expect((await dialog.boundingBox())!.y).toBeGreaterThan(240);
  await page.keyboard.press('2');
  await expect(dialog.getByRole('region', { name: 'Village health dashboard' })).toBeVisible();
  expect(await dialog.locator('.mayor-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(dialog.locator('.mayor-content')).toHaveCSS('opacity', '1');
  await expect(dialog.locator('.scene-speech > span').first()).toHaveText(await dialog.locator('.scene-speech').getAttribute('aria-label') ?? '');
  await page.screenshot({ path: `artifacts/web053/dashboard-${width}.png` });
  const a11y = await new AxeBuilder({ page }).include('.mayor-stage').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(a11y.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(', ')}`)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog.locator('.mayor-menu button').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await pose(page)).enabled).toBe(true);
  const after = await pose(page);
  for (let i = 0; i < 3; i++) { expect(after.position[i]).toBeCloseTo(before.position[i], 5); expect(after.target[i]).toBeCloseTo(before.target[i], 5); }
  expect(after.zoom).toBeCloseTo(before.zoom, 5);
  // Changing the preference while open must stop the existing bounce too.
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => (await pose(page)).zoom).toBeGreaterThan(80);
  await page.waitForTimeout(300);
  const still = await pose(page);
  await page.waitForTimeout(500);
  const stopped = await pose(page);
  stopped.position.forEach((value: number, i: number) => expect(value).toBeCloseTo(still.position[i], 8));
  await page.screenshot({ path: `artifacts/web053/reduced-${width}.png` });
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).toHaveCount(0);
});

test('fixture plaza without models, all choices, and check-in still work with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/models/*.glb*', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/?quality=low');
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'A visit to the Mayor' });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => (await pose(page)).zoom).toBeGreaterThan(80);
  for (const choice of [1, 2, 3, 4, 5, 6]) {
    await page.keyboard.press(String(choice));
    await expect(dialog.locator('.mayor-content')).toBeFocused();
    await expect(dialog.getByText(/Opening the village journal/)).toHaveCount(0);
    await dialog.getByRole('button', { name: /Back$/ }).click();
    await expect(dialog.locator('.mayor-menu button').nth(choice - 1)).toBeFocused();
  }
  await page.screenshot({ path: 'artifacts/web053/fixture-no-models.png' });
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await pose(page)).enabled).toBe(true);
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'A moment with your villager' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await pose(page)).enabled).toBe(true);
});
