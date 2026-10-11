import { expect, test } from '../../apps/web/node_modules/@playwright/test/index.mjs';

test('API-007 done photo exposes crop claim controls', async ({ page }, info) => {
  await page.goto('/');
  await page.evaluate(async () => {
    // @ts-expect-error Vite runtime import
    const { api } = await import('/src/api/client.ts');
    // Exact API-007 status/crop shape; synthetic pixels, no upload or GPU request.
    api.groupPhoto = async () => ({
      job_id: 'qa-done-photo', status: 'done', error: null,
      crops: [{ crop_id: 'a', url: '/qa-crop.svg', bbox: [0, 0, 64, 64], claimed_by: null }],
    });
  });
  await page.route('**/qa-crop.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="orange"/></svg>' }));
  await page.getByRole('button', { name: 'Village', exact: true }).click();
  await page.getByRole('button', { name: 'Our group photo', exact: true }).click();
  await page.getByText('Open a shared photo job', { exact: true }).click();
  await page.getByLabel('Photo job ID').fill('qa-done-photo');
  await page.getByRole('button', { name: 'Open photo', exact: true }).click();
  await expect(page.getByText('Loading shared photo…', { exact: true })).toHaveCount(0);
  await page.getByRole('dialog').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.screenshot({ path: info.outputPath('api007-done-photo.png') });
  await expect(page.getByRole('button', { name: 'This is me: person 1' })).toBeVisible();
});
