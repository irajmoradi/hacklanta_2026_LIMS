import {useDemoSeat} from './demoSeat';
useDemoSeat();
import { expect, test } from '@playwright/test';
const photo = { name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lS8AAAAASUVORK5CYII=', 'base64') };

test('AI journal, selected event rewards, goal status, and review overrides', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'AI at work' }).click();
  await expect(page.getByRole('heading', { name: 'AI at work' })).toBeVisible();
  await expect(page.getByText('Weekly recap scheduled')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'test-results/village-ai-panel.png', animations: 'disabled' });
  await page.getByRole('checkbox', { name: 'Iraj', exact: true }).check();
  await page.getByRole('button', { name: 'Mark event complete' }).click();
  await expect(page.getByTestId('my-xp')).toHaveText('470');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Check in', exact: true }).last().click();
  await page.getByRole('button', {name:/Daily note/}).click();
  await page.locator('#checkin-body').fill('My evidence belongs to this check-in.');
  await page.getByLabel('Upload evidence photo').setInputFiles(photo);
  await page.getByRole('button', { name: 'Share check-in' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'My profile' }).click();
  await expect(page.locator('.review-badge.verified')).toBeVisible();
  await page.getByRole('button', { name: 'Override review' }).click();
  await page.getByLabel('Override reason').fill('I checked the full result.');
  await page.getByRole('button', { name: 'Save review override' }).click();
  await expect(page.locator('.review-badge.verified')).toHaveAttribute('title', 'I checked the full result.');
  await page.getByRole('button', { name: 'Mark done', exact: true }).click();
  await expect(page.getByText('Goal: done')).toBeVisible();
  await page.getByRole('button', { name: 'Close profile' }).click();
  await page.getByLabel('Play as').selectOption({ label: 'Lance' });
  await page.getByRole('button', { name: 'AI at work' }).click();
  await expect(page.getByText('Owner · complete a village event')).not.toBeVisible();
});

test('avatar consent is explicit; construction and failure preserve the preset', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'My profile' }).click();
  await page.getByRole('tab', {name:'Outfit', exact:true}).click();
  await page.getByRole('button', { name: 'Customize my avatar' }).click();
  await page.getByLabel('Avatar photo').setInputFiles(photo);
  await expect(page.getByRole('button', { name: 'Build my avatar' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /my photo and voice/ }).check();
  await page.getByRole('button', { name: 'Build my avatar' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/village-avatar.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Build my avatar' }).click();
  await expect(page.getByText(/The GPU worker is offline in demo mode/)).toBeVisible();
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await page.evaluate(async () => {
    // @ts-expect-error Vite runtime module
    const { api } = await import('/src/api/client.ts');
    api.job = async () => ({ id: 'job', stage: 'head', status: 'running', error: null });
  });
  await page.getByRole('button', { name: 'Build my avatar' }).click();
  await expect(page.getByText(/Your villager is being built/)).toBeVisible();
  await page.getByRole('button', { name: 'Close profile' }).click();
  await page.getByRole('button', { name: 'Check in', exact: true }).last().click();
  await page.getByRole('button', {name:/Daily note/}).click();
  await expect(page.locator('#checkin-body')).toBeVisible();
});

test('missing or malformed GLBs keep procedural village functional', async ({ page }) => {
  const requests = new Set<string>();
  await page.route('**/models/*.glb*', async route => { requests.add(new URL(route.request().url()).pathname); await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Not a model</html>' }); });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await expect.poll(() => requests.has('/models/villager_base.glb')).toBe(true);
  await page.getByTestId('villager-Iraj').click();
  await expect(page.getByRole('heading', { name: 'Iraj', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});


test('WEB-009 group-photo consent, shared claims and simulated avatar progress', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Village',exact:true}).click();
  await page.getByRole('button', {name:'Our group photo',exact:true}).click();
  await page.getByLabel('Group photo', {exact:true}).setInputFiles(photo);
  await expect(page.getByRole('button', {name:'Find our people'})).toBeDisabled();
  await page.getByRole('checkbox', {name:/Everyone in this group/}).check();
  await page.getByRole('button', {name:'Find our people'}).click();
  await expect(page.getByRole('img', {name:'Shared group photo'})).toBeVisible();
  await expect(page.locator('.crop-outline')).toHaveCount(3);
  await page.getByRole('button', {name:'This is me: person 1'}).click();
  await expect(page.getByText('Claimed by Iraj', {exact:true})).toBeVisible();
  await expect(page.getByText(/Your villager is being built/)).toBeVisible();
  await expect(page.getByRole('list', {name:'Avatar stages'})).toContainText('stylized head');
  await expect(page.getByText(/Demo build complete/)).toBeVisible({timeout:15000});
  await page.getByRole('button', {name:'Close dialog'}).click();
  await page.getByLabel('Play as').selectOption({label:'Lance'});
  await page.getByRole('button', {name:'Village',exact:true}).click();
  await page.getByRole('button', {name:'Our group photo',exact:true}).click();
  await expect(page.getByLabel('Group photo', {exact:true})).toHaveCount(0);
  await expect(page.getByText('Claimed by Iraj', {exact:true})).toBeVisible();
  await expect(page.getByRole('button', {name:'This is me: person 1'})).toHaveCount(0);
  await page.getByRole('button', {name:'This is me: person 2'}).click();
  await expect(page.getByText('Claimed by Lance', {exact:true})).toBeVisible();
  await page.getByRole('heading', {name:'Our group photo'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'tests/artifacts/web009-group-photo.png'});
});

test('WEB-009 growth refresh celebrates each new building once', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Village',exact:true}).click();
  await expect(page.getByRole('progressbar', {name:'Village level progress'})).toBeVisible();
  await expect(page.locator('.toast-moment')).toHaveCount(0);
  await page.evaluate(async () => {
    // @ts-expect-error Vite runtime module
    const { api } = await import('/src/api/client.ts');
    const original = api.village.bind(api);
    api.village = async (id: string) => { const v = await original(id); return {...v, world:{...v.world, unlocked:[...v.world.unlocked,{id:'observatory',name:'Observatory'}],upcoming:[]}}; };
  });
  await page.getByRole('button', {name:'Refresh village'}).click();
  await expect(page.locator('.toast-moment')).toContainText('New building unlocked: Observatory');
  await expect(page.locator('dialog .toast-confetti')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('.toast-moment')).toBeVisible();
  await page.screenshot({path:'tests/artifacts/web009-unlock.png'});
  await expect(page.locator('.building-list')).toContainText(['Observatory', '']);
  await expect(page.locator('.toast-moment')).toHaveCount(0, {timeout:12000});
  await page.getByRole('button', {name:'Refresh village'}).click();
  await expect(page.getByRole('button', {name:'Refresh village'})).toBeEnabled();
  await expect(page.locator('.toast-moment')).toHaveCount(0);
});

test('WEB-009 mobile bottom sheet, full-screen profile and interactive canvas', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  await expect(page.getByRole('button', {name:'Compete',exact:true})).toBeVisible();
  await page.screenshot({path:'tests/artifacts/web009-mobile-expanded.png'});
  for (const button of await page.locator('.action-dock button').all()) {
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', {name:'Collapse dashboard',exact:true}).click();
  const canvas = page.getByTestId('village-scene').locator('canvas'); await expect(canvas).toBeVisible();
  // The accessible people strip now owns the lower band; the village center stays draggable.
  expect(await canvas.evaluate(el => {const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height*0.65) === el;})).toBe(true);
  await page.mouse.move(195,640); await page.mouse.down(); await page.mouse.move(240,660,{steps:8}); await page.mouse.up();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({path:'tests/artifacts/web009-mobile-390x844.png'});
  await page.getByRole('button', {name:'My profile'}).click();
  await expect(page.getByRole('button', {name:'Close profile'})).toBeVisible();
  expect(await page.locator('.profile-panel').boundingBox()).toMatchObject({x:0,y:0,width:390,height:844});
  await page.screenshot({path:'tests/artifacts/web009-mobile-profile.png'});
  await page.getByRole('button', {name:'Close profile'}).click();
  await page.getByRole('button', {name:'Village',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Village growth'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({path:'tests/artifacts/web009-mobile-growth.png'});
});


test('WEB-009 photo polling failures can be retried without another upload', async ({page}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    // @ts-expect-error Vite runtime module
    const {api} = await import('/src/api/client.ts');
    let reads = 0;
    api.groupPhoto = async () => { if (++reads === 1) throw new Error('Photo service temporarily unavailable'); return {status:'ready',crops:[]}; };
  });
  await page.getByRole('button', {name:'Village',exact:true}).click();
  await page.getByRole('button', {name:'Our group photo',exact:true}).click();
  await page.getByText('Open a shared photo job', {exact:true}).click();
  await page.getByLabel('Photo job ID').fill('shared-job');
  await page.getByRole('button', {name:'Open photo',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Photo service temporarily unavailable');
  await page.getByRole('button', {name:'Refresh photo'}).click();
  await expect(page.getByText(/No people were found/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
