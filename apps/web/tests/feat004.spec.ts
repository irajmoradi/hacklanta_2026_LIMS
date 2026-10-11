import { test, expect } from '@playwright/test';

test('mobile seat and debug controls stay in the header and remain reachable', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('dialog', {name:'Who are you testing as?'}).getByRole('button', {name:'Iraj'}).click();
  const seat = page.getByRole('button', {name:'Testing as Iraj · switch'});
  await seat.click();
  await page.getByRole('dialog', {name:'Who are you testing as?'}).getByRole('button', {name:'Maya'}).click();
  const debug = page.getByRole('button', {name:'Debug menu'});
  await expect(debug).toBeVisible();
  const header = (await page.locator('.topbar').boundingBox())!;
  for (const control of [page.getByRole('button', {name:'Testing as Maya · switch'}), debug]) {
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(390);
    expect(box.y+box.height).toBeLessThanOrEqual(header.y+header.height);
  }
  await debug.click();
  await expect(page.getByRole('dialog', {name:'Debug · Maya',exact:true})).toBeVisible();
  await page.getByRole('dialog', {name:'Debug · Maya',exact:true}).getByRole('button', {name:'Close dialog'}).click();
  await page.screenshot({path:'tests/screenshots/FEAT-004-mobile.png'});
});

test('seat persists, select stays in sync, and debug actions refresh the village', async ({ page }) => {
  await page.goto('/');
  const picker = page.getByRole('dialog', {name: 'Who are you testing as?'});
  await expect(picker).toBeVisible();
  await expect(picker.locator('.portrait')).toHaveCount(5);
  await picker.getByRole('button', {name: 'Lance'}).click();
  await expect(page.getByRole('button', {name: 'Testing as Lance · switch'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', {name: 'Testing as Lance · switch'})).toBeVisible();
  await expect(picker).not.toBeVisible();
  await page.getByLabel('Play as').selectOption({label: 'Maya'});
  await expect(page.getByRole('button', {name: 'Testing as Maya · switch'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Debug menu'})).toBeVisible();
  await page.keyboard.press('Control+Shift+D');
  const debug = page.getByRole('dialog', {name: 'Debug · Maya', exact: true});
  await expect(debug).toBeVisible();
  await debug.getByRole('button', {name: '+500 XP +500 coins', exact: true}).click();
  await expect(debug.getByRole('button', {name: '+500 XP +500 coins', exact: true})).toBeEnabled();
  await debug.getByRole('button', {name: 'Mark my goal done'}).click();
  await debug.getByRole('button', {name: 'Toggle festival night'}).click();
  await expect(debug.getByRole('button', {name: 'Toggle festival night'})).toBeEnabled();
  await page.screenshot({path: 'tests/screenshots/FEAT-004-debug.png'});
  await debug.getByRole('button', {name: 'Close dialog'}).click();
  await expect(page.getByRole('progressbar', {name: "Maya's level progress"}).first()).toHaveAttribute('aria-valuenow', '850');
});

test('switch picker shows all five seats', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('village:seat:mock', '00000000-0000-4000-8000-000000000001'));
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Debug menu'})).toBeVisible();
  await page.getByRole('button', {name: 'Testing as Iraj · switch'}).click();
  await expect(page.getByRole('dialog', {name: 'Who are you testing as?'})).toBeVisible();
  await page.screenshot({path: 'tests/screenshots/FEAT-004-seats.png'});
});


test('seat conflicts warn without blocking and an API-disabled debug menu stays hidden', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('dialog', {name: 'Who are you testing as?'}).getByRole('button', {name: 'Iraj'}).click();
  await page.evaluate(async () => {
    const modulePath = '/src/api/client.ts';
    const {api} = await import(modulePath);
    const original = api.request.bind(api);
    api.request = (method: string, path: string, body?: unknown) => {
      if (path === '/demo/debug') return Promise.reject(new Error('Not found'));
      if (path === '/demo/seat') return Promise.resolve({conflict: true});
      return original(method, path, body);
    };
  });
  await page.getByLabel('Play as').selectOption({label: 'Lance'});
  await expect(page.getByText('Another tester chose Lance in the last 10 minutes.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Debug menu'})).toHaveCount(0);
  await page.keyboard.press('Control+Shift+D');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const headers = await page.evaluate(async () => {
    const modulePath = '/src/api/client.ts';
    return (await import(modulePath)).api.authHeaders();
  });
  expect(headers['X-Demo-User']).toBe('00000000-0000-4000-8000-000000000002');
});
