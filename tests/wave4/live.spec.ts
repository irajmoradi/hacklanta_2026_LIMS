import {test, expect} from '../../apps/web/node_modules/@playwright/test/index.mjs';

const fixture = JSON.parse(process.env.QA_WAVE4 || '{}');
test.beforeEach(async ({page}) => {
  if (!fixture.village?.name.startsWith('QA-002 ') || fixture.users?.length !== 3) throw Error('Run wave4_live.py --browser');
  const id = fixture.village.id;
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname.slice(4);
    const vid = path.match(/^\/villages\/([^/]+)/)?.[1];
    if ((vid && vid !== id) || path.startsWith('/assets/') ||
        (req.method() !== 'GET' && !new RegExp(`^/villages/${id}/(messages|presence/heartbeat)`).test(path))) {
      await route.abort(); throw Error(`Isolation guard: ${req.method()} ${path}`);
    }
    const headers = {...req.headers(), 'x-demo-user': fixture.users[0]};
    if (path === '/me') {
      const response = await route.fetch({headers});
      const identity = await response.json();
      identity.villages = identity.villages.filter((v: any) => v.id === id);
      await route.fulfill({response, json: identity});
    } else await route.continue({headers});
  });
  await page.goto('/');
  await expect(page.getByText('Connected', {exact: true})).toBeVisible();
  await expect(page.getByLabel('Village', {exact: true})).toHaveValue(id);
});

test('live Gazette latest/archive, mobile layout and Mayor memory', async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', {name: 'Gazette', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'QA4 edition 0', exact: true})).toBeVisible();
  await page.getByLabel('Past issues').selectOption({index: 1});
  await expect(page.getByRole('heading', {name: 'QA4 edition 1', exact: true})).toBeVisible();
  await expect(page.getByText('QA4 small steps').first()).toBeVisible();
  await page.screenshot({path: info.outputPath('gazette-desktop.png')});
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({path: info.outputPath('gazette-mobile.png')});
  await page.getByRole('button', {name: 'Close dialog'}).click();
  await page.setViewportSize({width: 1440, height: 900});
  const memoryResponse = page.waitForResponse(r => r.url().endsWith('/mayor/memory'));
  await page.getByRole('button', {name: 'AI at work', exact: true}).click();
  const memory = await (await memoryResponse).json();
  // Event completion refreshes durable memory; compare the rendered live response.
  expect(memory.document.facts.length).toBeGreaterThan(0);
  for (const fact of memory.document.facts) {
    await expect(page.getByRole('region', {name: "Mayor's memory"})).toContainText(`${fact.checkins ?? 0} check-ins, ${fact.wins ?? 0} weekly wins`);
  }
  await page.screenshot({path: info.outputPath('memory.png')});
  expect(errors).toEqual([]);
});

test('live rectangular town, clickable villagers, messages, pokes and cheers', async ({page}, info) => {
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('villager-QA4 Friend 1')).toBeVisible();
  await page.screenshot({path: info.outputPath('town.png')});
  // Click the scene's projected villager label, not just the neighbor strip.
  await page.getByTestId('villager-QA4 Friend 1').click();
  await expect(page.getByRole('complementary', {name: 'Villager profile'})).toBeVisible();
  await page.getByRole('button', {name: /Poke/}).click();
  await expect(page.getByText('Poke sent!', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: /Cheer/}).click();
  await expect(page.getByText('Cheer sent!', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Message', exact: true}).click();
  await page.getByLabel('Your message').fill('QA4 browser hello');
  await page.getByRole('button', {name: 'Send message', exact: true}).click();
  await expect(page.getByText('QA4 browser hello', {exact: true})).toBeVisible();
  await page.screenshot({path: info.outputPath('messages.png')});
});
