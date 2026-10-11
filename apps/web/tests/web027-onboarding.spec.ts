import { test, expect } from '@playwright/test';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID } from '../src/api/fixtures';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

test('new neighbor can confirm a camera selfie and enter with a preset', async ({page}) => {
  const backend = new MockApi(); let joined = false;
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), url = new URL(request.url());
    const path = url.pathname.slice(4) + url.search;
    const body = request.postData() ? request.postDataJSON() : undefined;
    const result = await backend.request<any>(request.method(), path, DEMO_USER_ID, body);
    if (path === '/me' && !joined) result.villages = [];
    if (path === '/villages/join') joined = true;
    await route.fulfill({json: result});
  });
  await page.goto('/');
  await page.getByLabel('Invite code').fill('hacklanta');
  await page.getByRole('button', {name: 'Join village', exact: true}).click();
  await page.getByRole('button', {name: 'Take a photo', exact: true}).click();
  const sheet = page.getByRole('dialog', {name: 'Capture your avatar'});
  await sheet.getByRole('button', {name: 'Open camera', exact: true}).click();
  await sheet.getByRole('button', {name: 'Take photo', exact: true}).click();
  await sheet.getByRole('button', {name: 'Confirm photo'}).click();
  await expect(page.getByText('Selected: photo.jpg')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Build my avatar'})).toBeDisabled();
  await page.getByRole('button', {name: 'Enter village'}).click();
  await expect(page.getByRole('button', {name: 'My profile', exact: true})).toBeVisible();
});
