import { expect, test } from '@playwright/test';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID } from '../src/api/fixtures';

test.beforeEach(async ({page}) => { await page.addInitScript((id) => localStorage.setItem('village:seat:live', id), DEMO_USER_ID); });
import { headFixture } from './headFixture';

test('authenticated heads, URL cache, card/preset fallback, placeholder tooltip and live manifest refresh', async ({page}) => {
  test.setTimeout(75000);
  const backend = new MockApi(); let headFetches = 0, late = false, polls = 0;
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { const revoke = URL.revokeObjectURL.bind(URL); (window as any).revokedHeads = 0; URL.revokeObjectURL = url => { (window as any).revokedHeads++; revoke(url); }; });
  await page.route('**/models/villager_base.glb*', route => route.fulfill({contentType: 'model/gltf-binary', body: headFixture(true)}));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(4) + url.search;
    if (path.startsWith('/assets/')) {
      expect(req.headers()['x-demo-user']).toBe(DEMO_USER_ID);
      if (path.endsWith('good.glb')) { headFetches++; return route.fulfill({contentType: 'model/gltf-binary', body: headFixture()}); }
      if (path.endsWith('card.svg')) return route.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="orange"/></svg>'});
      return route.fulfill({status:404, json:{detail:'Missing synthetic asset'}});
    }
    const value = await backend.request<any>(req.method(), path, DEMO_USER_ID, req.postData() ? req.postDataJSON() : undefined);
    const update = (manifest: any) => {
      const slot = Number(manifest.user_id.slice(-1));
      manifest.body.head_glb_url = slot === 1 || slot === 5 || (slot === 4 && late) ? '/api/assets/test/good.glb' : slot === 4 ? undefined : '/api/assets/test/missing.glb';
      manifest.body.head_card_url = slot === 2 ? '/api/assets/test/card.svg' : undefined;
      manifest.portrait.placeholder = slot === 1; manifest.revision = late ? 10 : 9;
    };
    if (value.villagers) value.villagers.forEach((v: any) => update(v.avatar));
    if (path.startsWith('/avatars/')) { polls++; update(value); }
    await route.fulfill({json: value});
  });
  await page.goto('/');
  const villagers = page.locator('[data-head-kind]');
  await expect(villagers).toHaveCount(5);
  await expect(page.locator('[data-head-kind="glb"]')).toHaveCount(2);
  await expect(page.locator('[data-head-kind="card"]')).toHaveCount(1);
  await expect(page.locator('[data-head-kind="preset"]')).toHaveCount(2);
  expect(headFetches).toBe(1);
  await expect(villagers.first()).toHaveAttribute('title', 'placeholder face (CC0)');
  await expect(villagers.nth(1)).not.toHaveAttribute('title');
  await expect.poll(() => polls).toBeGreaterThanOrEqual(5);
  late = true;
  await expect(page.locator('[data-head-kind="glb"]')).toHaveCount(3, {timeout:40000});
  expect(headFetches).toBe(1);
  expect(await page.evaluate(() => (window as any).revokedHeads)).toBeGreaterThanOrEqual(2);
  await page.screenshot({path: 'test-results/web006-heads-mock.png'});
  await page.getByRole('button', {name: 'Reset camera'}).click();
  await expect(page.locator('[data-head-kind="glb"]')).toHaveCount(3);
  // Reset restores only the view; mounted avatars and their cached assets stay alive.
  await expect.poll(() => headFetches).toBe(1);
  expect(errors).toEqual([]);
});
