import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('four real generated heads, every head/face item, front side and back', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', route => route.request().method() === 'GET' ? route.continue() : route.abort());
  await page.goto('/tests/fix005.html');
  await page.waitForFunction(() => !!(window as any).fitReview);
  const items = await page.evaluate(() => (window as any).fitReview.items as string[]);
  const output = 'test-results/fix005'; await mkdir(output, { recursive: true });
  const results = [];
  for (const [name, seat] of [['Iraj', 1], ['Lance', 2], ['Stefanny', 3], ['Mario', 5]] as const) {
    await page.evaluate(([name, seat]) => (window as any).fitReview.person(name, seat), [name, seat]);
    for (const item of items) {
      const metrics = await page.evaluate(item => (window as any).fitReview.outfit(item), item);
      expect(metrics.neckGap).toBeLessThanOrEqual(0);
      expect(metrics.neckGap).toBeGreaterThan(-metrics.headHeight * 0.015);
      expect(metrics.headHeight).toBeGreaterThan(0.1);
      if (item.startsWith('glasses') || item === 'auditor_badge') expect(metrics.widthRatio).toBeCloseTo(0.9, 3);
      await page.screenshot({ path: `${output}/${name.toLowerCase()}-${item}.png` });
      results.push({ name, item, ...metrics });
    }
  }
  expect(errors).toEqual([]);
  await writeFile(`${output}/measurements.json`, JSON.stringify(results, null, 2));
});
