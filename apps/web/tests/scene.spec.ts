import { expect, test } from '@playwright/test';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID } from '../src/api/fixtures';

for (const night of [false, true]) test(`${night ? 'night' : 'day'} town: missing assets, camera and 1080p screenshot`, async ({page}) => {
  const backend = new MockApi(), errors: string[] = [], requested = new Set<string>();
  page.on('pageerror', e => errors.push(e.message));
  if (process.env.SCENE_HARDWARE !== '1') await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', {get: () => 4}));
  await page.route('**/models/*.glb*', route => { requested.add(new URL(route.request().url()).pathname); return route.fulfill({status: 404}); });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url());
    const value = await backend.request<any>(route.request().method(), url.pathname.slice(4) + url.search, DEMO_USER_ID, route.request().postData() ? route.request().postDataJSON() : undefined);
    if (value.villagers) { value.world = { level: 5, unlocked: night ? ['ferris_wheel', 'pet_shelter'] : ['ferris_wheel'], weather: night ? 'festival_night' : 'clear', time_of_day: night ? '22:00' : '12:00' }; value.active_events = []; }
    await route.fulfill({json: value});
  });
  await page.goto('/');
  await expect(page.locator('[data-head-kind]')).toHaveCount(5);
  await expect.poll(() => requested.has('/models/ferris_wheel.glb')).toBe(true);
  await page.waitForTimeout(1800);
  expect(requested.has('/models/pet_shelter.glb')).toBe(true); // Registry unlocks the shelter at level 4.
  await page.screenshot({path: `src/scene/artifacts/web013-fallback-${night ? 'night' : 'day'}.png`});
  await page.getByRole('button', {name: 'Visit Iraj', exact: true}).click();
  await expect(page.getByRole('complementary', {name: 'Villager profile'})).toBeVisible();
  await page.getByRole('button', {name: 'Close profile'}).click();
  await page.getByRole('button', {name: 'Reset camera'}).click();
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  const fps = await page.evaluate(() => new Promise<number>(resolve => { let start = 0, frames = 0; const sample = (t: number) => { start ||= t; frames++; if (t - start >= 3000) resolve((frames - 1) * 1000 / (t - start)); else requestAnimationFrame(sample); }; requestAnimationFrame(sample); }));
  console.log(`${night ? 'night' : 'day'} foreground frame rate: ${fps.toFixed(1)} fps (${process.env.SCENE_HARDWARE === '1' ? 'hardware' : 'software'}, adaptive effects)`);
  if (process.env.SCENE_HARDWARE === '1') {
    const renderer = await page.evaluate(() => { const gl = document.querySelector('canvas')!.getContext('webgl2')!; const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
    console.log(renderer);
    expect(fps).toBeGreaterThanOrEqual(50);
  }
  expect(errors).toEqual([]);
});

test('newly arriving GLBs replace missing prop and instanced nature fallbacks without a reload', async ({page}) => {
  const backend = new MockApi(); let arrived = false;
  const counts = {ferris_wheel: 0, tree_c: 0};
  const {headFixture} = await import('./headFixture');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install();
  await page.route('**/models/*.glb*', route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!.replace('.glb', '');
    if (name in counts) { counts[name as keyof typeof counts]++; return arrived ? route.fulfill({contentType: 'model/gltf-binary', body: headFixture()}) : route.fulfill({status: 404}); }
    return route.continue();
  });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url());
    const value = await backend.request<any>(route.request().method(), url.pathname.slice(4) + url.search, DEMO_USER_ID, route.request().postData() ? route.request().postDataJSON() : undefined);
    if (value.villagers) value.world = {...value.world, level: 5, unlocked: ['ferris_wheel']};
    await route.fulfill({json: value});
  });
  await page.goto('/');
  await expect(page.locator('[data-head-kind]')).toHaveCount(5);
  await expect.poll(() => counts).toEqual({ferris_wheel: 1, tree_c: 1});
  arrived = true;
  await page.clock.fastForward(36000);
  await expect.poll(() => counts).toEqual({ferris_wheel: 2, tree_c: 2});
  // Give GLTFLoader time to parse; a successfully mounted model stops retrying.
  await page.waitForTimeout(1000);
  await page.clock.fastForward(36000);
  await page.waitForTimeout(500);
  expect(counts).toEqual({ferris_wheel: 2, tree_c: 2});
  expect(errors).toEqual([]);
});

test('locked registry buildings keep their lot without requesting the gated GLB', async ({page}) => {
  const backend = new MockApi(), requested = new Set<string>();
  await page.route('**/models/*.glb*', route => { requested.add(new URL(route.request().url()).pathname); return route.fulfill({status:404}); });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url());
    const value = await backend.request<any>(route.request().method(), url.pathname.slice(4) + url.search, DEMO_USER_ID, route.request().postData() ? route.request().postDataJSON() : undefined);
    if (value.villagers) value.world = {level:1,unlocked:[],time_of_day:12};
    await route.fulfill({json:value});
  });
  await page.goto('/');
  await expect(page.locator('[data-head-kind]')).toHaveCount(5);
  await expect(page.getByText('Coming soon', {exact:true})).toHaveCount(0);
  await expect(page.getByTestId('building-label')).toHaveCount(0);
  expect(requested.has('/models/ferris_wheel.glb')).toBe(false);
  expect(requested.has('/models/pet_shelter.glb')).toBe(false);
});
