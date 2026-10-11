import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) test(`repair banner and Lab at ${width}`, async ({page}, info) => {
  await page.setViewportSize({width, height: 1000});
  await page.goto('/tests/repair-harness.html');
  await expect(page.getByRole('region', {name: 'Village alerts'})).toBeVisible();
  await page.getByText('Why the Mayor chose these').click();
  await expect(page.getByText('offline example', {exact: false})).toBeVisible();
  await page.screenshot({path: info.outputPath(`banner-${width}.png`), fullPage: true});
  await page.goto('/lab#disasters');
  let calls = 0;
  await page.route('**/api/lab/repair-plan', async route => {
    calls++;
    await route.fulfill({status: 429, body: '{}'});
  });
  await page.getByRole('button', {name: 'blackout', exact: true}).click();
  expect(calls).toBe(0);
  await page.getByRole('button', {name: 'Ask the Mayor', exact: true}).click();
  await expect(page.getByText('Using an example plan. The Mayor is offline or capped.')).toBeVisible();
  await expect(page.locator('.lab-status')).toContainText('0/2 tasks complete');
  expect(calls).toBe(1);
  await page.getByText('Why the Mayor chose these').click();
  await page.screenshot({path: info.outputPath(`lab-${width}.png`), fullPage: true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', {name: 'Simulate Share a photo of what you did today'}).click();
  await page.getByRole('button', {name: 'Simulate Share a photo of what you did today'}).click();
  await expect(page.getByRole('button', {name: 'Repair', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: 'Simulate Call a friend for 30 min'}).click();
  await page.getByRole('button', {name: 'Repair', exact: true}).click();
  await expect(page.getByText('The village is thriving.')).toBeVisible();
});
