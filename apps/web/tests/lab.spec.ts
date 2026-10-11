import { expect, test } from '@playwright/test';

test('judge scenes run locally, including disasters, every future and 100 residents', async ({page}, info) => {
  const writes: string[] = [], sockets: string[] = [], apiReads: string[] = [], errors: string[] = [];
  page.on('request', r => {if (!['GET', 'HEAD'].includes(r.method())) writes.push(`${r.method()} ${r.url()}`); if (new URL(r.url()).pathname.startsWith('/api/')) apiReads.push(r.url());});
  page.on('websocket', ws => {if (new URL(ws.url()).pathname !== '/') sockets.push(ws.url());}); // Vite HMR is not a village room.
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/lab');
  await expect(page.getByRole('heading', {name: 'A little place. A lot of life.'})).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('slider', {name: 'Population'}).fill('3');
  await expect(page.getByTestId('lab-fps')).toContainText('100 neighbors');
  await page.waitForTimeout(12000); // shader warmup and at least one governor window
  await expect(page.getByTestId('lab-fps')).toContainText(/\d+ FPS/);
  await page.screenshot({path: info.outputPath('town-100.png'), fullPage: true});
  await info.attach('software-renderer-fps', {body: await page.getByTestId('lab-fps').innerText(), contentType:'text/plain'});
  await page.getByRole('button', {name: /Disasters & repair/}).click();
  for (const kind of ['scorch', 'outbreak', 'blackout', 'blight']) {
    await page.getByRole('button', {name: kind, exact: true}).click();
    await expect(page.getByRole('button', {name: 'Repair', exact: true})).toBeDisabled();
    await page.waitForTimeout(1500);
    await page.screenshot({path: info.outputPath(`disaster-${kind}.png`), fullPage: true});
    for (let i = 0; i < 4; i++) await page.getByRole('button', {name: 'Simulate check-ins +3'}).click();
    await expect(page.getByRole('progressbar', {name: 'Repair progress'})).toHaveAttribute('value', '12');
    await page.getByRole('button', {name: 'Repair', exact: true}).click();
    await expect(page.getByText('The village is thriving.')).toBeVisible();
  }
  await page.getByRole('button', {name: 'scorch', exact: true}).click();
  await page.getByRole('button', {name: 'Clear', exact: true}).click();
  await expect(page.getByText('The village is thriving.')).toBeVisible();
  await page.getByRole('button', {name: /Village futures/}).click();
  await expect(page.getByRole('slider', {name: 'Village level'})).toHaveValue('1');
  await expect(page.getByTestId('lab-fps')).toContainText(/\d+ FPS/, {timeout: 30000});
  await page.mouse.move(280, 20);
  await page.screenshot({path: info.outputPath('futures-level-1.png'), fullPage: true});
  for (let level = 2; level <= 6; level++) {
    await page.getByRole('button', {name: 'Next level'}).click();
    await expect(page.getByRole('slider', {name: 'Village level'})).toHaveValue(String(level));
    await expect(page.locator('.lab-status')).toContainText('Unlocked this level:');
  }
  await expect(page.getByText(/New building unlocked:/).last()).toBeVisible();
  await page.screenshot({path: info.outputPath('futures-level-6.png'), fullPage: true});
  await page.getByRole('button', {name: 'Autoplay', exact: true}).click();
  await expect(page.getByRole('slider', {name: 'Village level'})).toHaveValue('1');
  await expect(page.getByRole('slider', {name: 'Village level'})).toHaveValue('2', {timeout: 10000});
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  expect(apiReads).toEqual([]); // town, disasters and futures are fully local
  for (const name of ['Your first day', 'Avatar studio']) {
    await page.getByRole('button', {name: new RegExp(name)}).click();
    await expect(page.getByRole('heading', {name: 'Coming soon'})).toHaveCount(0);
    await page.screenshot({path: info.outputPath(`${name.replaceAll(' ', '-')}.png`), fullPage: true});
  }
  // The avatar studio may read member media (GET only); nothing ever writes or opens the live room.
  expect(writes).toEqual([]); expect(sockets).toEqual([]); expect(errors).toEqual([]);
});

test('390px rail and controls fit, and reloading resets the sandbox', async ({page}, info) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/lab#disasters');
  await page.getByRole('button', {name: 'blight', exact: true}).click();
  await page.getByRole('button', {name: 'Simulate check-ins +3'}).click();
  await expect(page.locator('.lab-status')).toContainText('3/12');
  await page.screenshot({path:info.outputPath('mobile-disaster.png'), fullPage:true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.lab-controls').evaluateAll(els => els.every(el => el.getBoundingClientRect().right <= innerWidth))).toBe(true);
  await page.locator('.lab-status').scrollIntoViewIfNeeded();
  await expect(page.locator('.lab-status')).toBeInViewport();
  await page.reload();
  await expect(page.getByText('The village is thriving.')).toBeVisible();
  await expect(page.getByRole('link', {name:'Back to the village'})).toHaveAttribute('href','/');
});


test('fixture geometry works when all model assets are unavailable', async ({page}, info) => {
  await page.route('**/models/**', route => route.fulfill({status: 404, body: ''}));
  await page.goto('/lab#futures');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('lab-fps')).toContainText(/\d+ FPS/, {timeout: 30000});
  await page.getByRole('button', {name: 'Next level'}).click();
  await expect(page.locator('.lab-status')).toContainText('Level 2');
  await page.screenshot({path:info.outputPath('fallback-no-models.png'),fullPage:true});
  await expect(page.getByText('The 3D view needs WebGL.', {exact:false})).toHaveCount(0);
});
