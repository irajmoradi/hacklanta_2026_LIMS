import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
const shots = 'artifacts/web042';
async function ready(page: Page) {
  await page.goto('/tests/web042.html');
  await expect(page.getByRole('button', { name: 'Mayor', exact: true })).toBeVisible();
  expect(await page.evaluate(async () => (await import('/src/api/client.ts' as string)).api.mode)).toBe('mock');
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  return page.getByRole('dialog', { name: 'A visit to the Mayor' });
}
for (const width of [1440, 1280, 390]) test(`every Mayor option and keyboard flow at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1280 ? 800 : 900 });
  if (width === 390) await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const scene = await ready(page);
  await expect(scene.locator('.mayor-menu button')).toHaveCount(6);
  await expect(scene.locator('.mayor-menu button').first()).toBeFocused();
  expect(await scene.locator('.mayor-menu').innerText()).not.toMatch(/\p{Extended_Pictographic}/u);
  await expect(scene.locator('.scene-speech > span').first()).toHaveText(await scene.locator('.scene-speech').getAttribute('aria-label') ?? '');
  await page.screenshot({ path: `${shots}/menu-${width}.png` });
  for (let choice = 1; choice <= 6; choice++) {
    await page.keyboard.press(String(choice));
    await expect(scene.locator('.mayor-content')).toBeFocused();
    await expect(scene.getByText('Opening the village journal…', { exact: true })).toHaveCount(0);
    if (choice === 1) await expect(scene.getByRole('heading', { name: 'The weekly goals are in' })).toBeVisible();
    if (choice === 2) {
      await expect(scene.getByRole('region', { name: 'Village health dashboard' })).toBeVisible();
      await expect(scene.locator('.mayor-leader')).toHaveCount(3);
      await expect(scene.locator('.mayor-goal-ring')).toHaveAttribute('aria-label', /weekly goals completed/);
    }
    if (choice === 3) {
      await expect(scene.getByLabel('Pray to the Mayor')).toBeVisible();
      await expect(scene.getByRole('heading', { name: 'A word with the Mayor' })).toHaveCount(0);
      expect(await scene.locator('label[for=prayer]').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
    if (choice === 4) {
      await expect(scene.getByRole('button', { name: 'Visit the Colosseum challenges' })).toBeVisible();
      expect(await scene.locator('.event-card p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
      expect(await scene.locator('.event-card .section-label').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
    if (choice === 5) await expect(scene.getByRole('button', { name: 'Review offering' })).toBeDisabled();
    if (choice === 6) await expect(scene.locator('.mayor-rumour')).toContainText('noticeboard');
    expect(await scene.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await scene.locator('.mayor-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(scene.locator('.scene-speech > span').first()).toHaveText(await scene.locator('.scene-speech').getAttribute('aria-label') ?? '');
    await page.screenshot({ path: `${shots}/option-${choice}-${width}.png` });
    if ([1, 2, 4, 6].includes(choice)) {
      await scene.locator('.mayor-content').evaluate(el => el.scrollTo({ top: el.scrollHeight }));
      await page.screenshot({ path: `${shots}/option-${choice}-${width}-lower.png` });
      await scene.locator('.mayor-content').evaluate(el => el.scrollTo({ top: 0 }));
    }
    if (choice === 3) {
      await scene.getByLabel('Pray to the Mayor').fill('123456 — a little encouragement.');
      await scene.getByRole('button', { name: 'Send wish', exact: true }).click();
      await expect(scene.locator('.mayor-response')).toContainText('Request received');
      await expect(scene.locator('.mayor-response')).toBeFocused();
      await page.screenshot({ path: `${shots}/prayer-result-${width}.png` });
      await scene.getByRole('button', { name: "Dismiss Mayor's answer" }).click();
      await expect(scene.locator('.mayor-response')).toHaveCount(0);
    }
    if (choice === 5) {
      await scene.getByLabel('Offering amount').fill('10');
      await scene.getByLabel('Your wish', { exact: true }).fill('A sunny afternoon for everyone.');
      await scene.getByRole('button', { name: 'Review offering' }).click();
      await expect(scene.locator('.mayor-bribe-review')).toBeFocused();
      await expect(scene.getByRole('button', { name: 'Confirm · spend 10 coins' })).toBeVisible();
      await page.screenshot({ path: `${shots}/bribe-confirm-${width}.png` });
      await scene.getByRole('button', { name: 'Edit offering' }).click();
      await expect(scene.getByLabel('Offering amount')).toBeFocused();
      await scene.getByRole('button', { name: 'Review offering' }).click();
      await scene.getByRole('button', { name: 'Confirm · spend 10 coins' }).click();
      await expect(scene.locator('.mayor-receipt')).toContainText('10 coins spent');
      await expect(scene.locator('.mayor-receipt')).toBeFocused();
      await scene.locator('.mayor-receipt').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${shots}/bribe-receipt-${width}.png` });
    }
    if (width === 390) {
      const a11y = await new AxeBuilder({ page }).include('.mayor-stage').withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(a11y.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(', ')}`)).toEqual([]);
    }
    await page.keyboard.press('Escape');
    await expect(scene.locator('.mayor-menu button').nth(choice - 1)).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(scene).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('noticeboard errors retry, late reads do not replace another option, and rumours have an empty state', async ({ page }) => {
  const scene = await ready(page);
  await page.evaluate(async () => {
    const { api } = await import('/src/api/client.ts' as string);
    api.gazetteLatest = async () => { throw new Error('Noticeboard is offline.'); };
  });
  await page.keyboard.press('1');
  await expect(scene.getByRole('alert')).toContainText('Noticeboard is offline.');
  await page.screenshot({ path: `${shots}/noticeboard-error.png` });
  await page.evaluate(async () => {
    const { api } = await import('/src/api/client.ts' as string);
    api.gazetteLatest = () => new Promise(resolve => { (window as any).__finishGazette = () => resolve(null); });
  });
  await scene.getByRole('button', { name: 'Try again' }).click();
  await expect(scene.getByText('Opening the village journal…')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('2');
  await page.evaluate(() => (window as any).__finishGazette());
  await expect(scene.getByRole('region', { name: 'Village health dashboard' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('6');
  await expect(scene.locator('.mayor-rumour')).toContainText('No fresh rumours');
});

test('review never spends; pending confirmation blocks exit and duplicate requests', async ({ page }) => {
  const scene = await ready(page);
  await page.evaluate(async () => {
    const { api } = await import('/src/api/client.ts' as string);
    const original = api.bribe.bind(api);
    (window as any).__bribeCalls = 0;
    api.bribe = async (...args: unknown[]) => {
      (window as any).__bribeCalls++;
      await new Promise<void>(resolve => { (window as any).__releaseBribe = resolve; });
      return original(...args);
    };
  });
  await page.keyboard.press('5');
  await scene.getByLabel('Offering amount').fill('7');
  await scene.getByLabel('Your wish', { exact: true }).fill('A tiny wish.');
  await scene.getByRole('button', { name: 'Review offering' }).click();
  expect(await page.evaluate(() => (window as any).__bribeCalls)).toBe(0);
  await scene.getByRole('button', { name: 'Confirm · spend 7 coins' }).click();
  await expect(scene.getByRole('button', { name: 'Offering coins…' })).toBeDisabled();
  await expect(scene.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(scene.locator('.mayor-bribe-review')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__bribeCalls)).toBe(1);
  await page.evaluate(() => (window as any).__releaseBribe());
  await expect(scene.locator('.mayor-receipt')).toContainText('7 coins spent');
});

test('failed offering explains uncertainty and prevents a second spend', async ({ page }) => {
  const scene = await ready(page);
  await page.evaluate(async () => {
    const { api } = await import('/src/api/client.ts' as string);
    (window as any).__bribeCalls = 0;
    api.bribe = async () => { (window as any).__bribeCalls++; throw new Error('Connection lost.'); };
  });
  await page.keyboard.press('5');
  await scene.getByLabel('Offering amount').fill('5');
  await scene.getByLabel('Your wish', { exact: true }).fill('A rainy day indoors.');
  await scene.getByRole('button', { name: 'Review offering' }).click();
  await scene.getByRole('button', { name: 'Confirm · spend 5 coins' }).click();
  await expect(scene.getByRole('alert')).toContainText('Coins may have been spent');
  await expect(scene.getByRole('button', { name: 'Confirm · spend 5 coins' })).toBeDisabled();
  await scene.getByRole('button', { name: 'Edit offering' }).click();
  await expect(scene.getByRole('button', { name: 'Review offering' })).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__bribeCalls)).toBe(1);
  await page.screenshot({ path: `${shots}/bribe-error.png` });
});

test('spending the mock purse leaves a clear zero-balance state', async ({ page }) => {
  const scene = await ready(page);
  await page.keyboard.press('5');
  const amount = scene.getByLabel('Offering amount');
  const balance = (await amount.getAttribute('max'))!;
  await amount.fill(balance);
  await scene.getByLabel('Your wish', { exact: true }).fill('One last wish for today.');
  await scene.getByRole('button', { name: 'Review offering' }).click();
  await scene.getByRole('button', { name: `Confirm · spend ${balance} coins` }).click();
  await expect(scene.locator('.mayor-purse strong')).toHaveText('0 coins');
  await expect(scene.locator('.mayor-cost')).toHaveText('Cost: 0 coins · Remaining: 0 coins');
  await expect(scene.getByRole('button', { name: 'Review offering' })).toBeDisabled();
  await expect(scene.getByText('Check in to earn coins before making an offering.')).toBeVisible();
  await scene.locator('.mayor-content').evaluate(el => el.scrollTo({ top: 0 }));
  await page.screenshot({ path: `${shots}/bribe-empty.png` });
});
