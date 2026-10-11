import { expect, test } from '@playwright/test';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID } from '../src/api/fixtures';

test.beforeEach(async ({page}) => { await page.addInitScript((id) => localStorage.setItem('village:seat:live', id), DEMO_USER_ID); });

test('Hear them plays authenticated audio, moves jaw and adopts a delayed expression track', async ({ page }) => {
  const backend = new MockApi(); let posts = 0, expressions = 0;
  // Synthetic PCM tone: exercises real WebAudio without provider calls or recorded voices.
  const rate = 16000, count = rate * 4, wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(Math.sin(i * 440 * 2 * Math.PI / rate) * 6000), 44 + i * 2);
  await page.route(url => url.pathname.includes('/packages/lam-renderer/src/index.ts'), route => route.fulfill({ contentType: 'application/javascript', body: `
    export async function mountLamHead(host) {
      const canvas = document.createElement('canvas'); host.append(canvas);
      return { setAudio(audio) { window.__headAudio = audio; }, setExpr(expr) { window.__headExpr = expr; }, dispose() { canvas.remove(); } };
    }` }));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(4) + url.search;
    if (path.startsWith('/assets/test/avatar.zip')) return route.fulfill({status:404,body:'Synthetic renderer stub owns this portrait'});
    if (path === '/voice/lines') { posts++; return route.fulfill({ json: { id: 'test-line', audio_url: '/api/assets/test-line.wav' } }); }
    if (path === '/assets/test-line.wav') { expect(req.headers()['x-demo-user']).toBe(DEMO_USER_ID); return route.fulfill({ contentType: 'audio/wav', body: wav }); }
    if (path.endsWith('line_expr.json')) {
      expect(req.headers()['x-demo-user']).toBe(DEMO_USER_ID); expressions++;
      return expressions === 1 ? route.fulfill({ status: 404 }) : route.fulfill({ json: { names: ['jawOpen'], frames: [{ weights: [0.42] }], metadata: { fps: 30 } } });
    }
    const result = await backend.request<any>(req.method(), path, DEMO_USER_ID, req.postData() ? req.postDataJSON() : undefined);
    if (result.villager) result.villager.avatar.portrait = { kind: 'lam_head', head_package_url: '/api/assets/test/avatar.zip' };
    await route.fulfill({ json: result });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'My profile' }).click();
  await expect(page.locator('[data-head-state="ready"]')).toBeVisible();
  expect(posts).toBe(0);
  await page.getByRole('button', { name: 'Hear them' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__headExpr?.frames[0].weights[0] ?? 0)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as any).__headExpr?.names.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as any).__headExpr?.frames[0].weights[0])).toBe(0.42);
  await expect(page.getByText('AI-generated voice', { exact: true })).toBeVisible();
  expect(posts).toBe(1); expect(expressions).toBe(2);
  await page.getByRole('button', { name: 'Close profile' }).click();
  expect(await page.evaluate(() => (window as any).__headAudio.paused)).toBe(true);
});

test('shop retries initial failures and refreshes balance, ownership and profile after 409', async ({ page }) => {
  const backend = new MockApi(); let retryAllowed = false, conflict = false;
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(4) + url.search;
    if (path.endsWith('/shop/buy')) { conflict = true; return route.fulfill({ status: 409, json: { detail: 'Insufficient coins' } }); }
    if (path.endsWith('/shop') && !retryAllowed) return route.fulfill({ status: 500, json: { detail: 'Temporary shop failure' } });
    const result = await backend.request<any>(req.method(), path, DEMO_USER_ID, req.postData() ? req.postDataJSON() : undefined);
    if (conflict && path.endsWith('/shop')) { result.balance = 10; result.items[0].owned = true; }
    if (conflict && result.villager) result.villager.coins = 10;
    await route.fulfill({ json: result });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.locator('.equipment-panel').getByRole('alert')).toContainText('Temporary shop failure');
  await expect(page.getByRole('button', {name: 'Retry shop'})).toBeVisible();
  retryAllowed = true;
  await page.getByRole('button', { name: 'Retry shop' }).click();
  await expect(page.getByTestId('shop-balance')).toHaveText('420');
  await page.getByRole('button', { name: /^Buy / }).filter({ hasText: /coins$/ }).first().click();
  await expect(page.locator('.equipment-panel').getByRole('alert')).toContainText('Insufficient coins');
  await expect(page.getByTestId('shop-balance')).toHaveText('10');
  await expect(page.getByTestId('my-coins')).toContainText('10 coins');
  await expect(page.locator('.shop-item').first()).toContainText('Owned');
  await expect(page.getByRole('button', { name: /^Buy / }).filter({ hasText: /^Need/ }).first()).toBeDisabled();
});

test('header lists every membership, switches villages and joins by invite with retry', async ({ page }) => {
  const backend = new MockApi();
  const first = await backend.request<any>('GET', '/me', DEMO_USER_ID);
  const second = await backend.request<any>('POST', '/villages', DEMO_USER_ID, { name: 'Second garden' });
  let invite = '', joined = false;
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(4) + url.search;
    if (path === '/villages/join') {
      invite = req.postDataJSON().invite_code;
      if (invite !== 'WELCOME') return route.fulfill({ status: 404, json: { detail: 'Invite not found' } });
      joined = true; return route.fulfill({ json: { village: { ...second.village, id: first.villages[0].id } } });
    }
    const result = await backend.request<any>(req.method(), path, DEMO_USER_ID, req.postData() ? req.postDataJSON() : undefined);
    await route.fulfill({ json: result });
  });
  await page.goto('/');
  const picker = page.getByRole('combobox', {name:'Village',exact:true});
  await expect(picker.locator('option')).toHaveCount(3);
  await page.getByRole('button', { name: 'My profile' }).click();
  await picker.selectOption(second.village.id);
  await expect(picker).toHaveValue(second.village.id);
  await expect(page.getByRole('complementary', { name: 'Villager profile' })).not.toBeVisible();
  await picker.selectOption('__join');
  await page.getByLabel('Invite code').fill('BAD');
  await page.getByRole('button', { name: 'Join village', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invite not found');
  await page.getByLabel('Invite code').fill('WELCOME');
  await page.getByRole('button', { name: 'Join village', exact: true }).click();
  await expect(picker).toHaveValue(first.villages[0].id);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(invite).toBe('WELCOME'); expect(joined).toBe(true);
});

test('avatar job updates the crop and LAM slot renders authenticated frame packages', async ({ page }) => {
  const backend = new MockApi(); let polls = 0, lam = false, uploaded = false;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lS8AAAAASUVORK5CYII=', 'base64');
  const imageHeaders: string[] = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new URL(request.url()).pathname.slice(4);
    if (path.startsWith('/assets/')) {
      imageHeaders.push(request.headers()['x-demo-user']);
      if (path.endsWith('.json')) return route.fulfill({ json: { frames: ['crop.png', 'crop.png'], fps: 2 } });
      return route.fulfill({ contentType: 'image/png', body: png });
    }
    if (path.endsWith('/photo')) { uploaded = true; expect(request.postData()).toContain('consent'); return route.fulfill({ json: { job_id: 'synthetic-job' } }); }
    if (path.startsWith('/jobs/')) return route.fulfill({ json: { id: 'synthetic-job', stage: 'head', status: ++polls < 2 ? 'running' : 'ready', error: null } });
    const result = await backend.request<any>('GET', path, DEMO_USER_ID);
    const avatar = result.villager?.avatar ?? (path.startsWith('/avatars/') ? result : null);
    if (avatar && uploaded && polls > 1) { avatar.portrait = { kind: lam ? 'lam_head' : 'photo', asset_url: '/api/assets/avatars/synthetic/crop.png', head_package_url: '/api/assets/avatars/synthetic/head.json' }; avatar.generation = { segment: 'ready', head: 'ready', body: 'none' }; }
    await route.fulfill({ json: result });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'My profile' }).click();
  await page.getByRole('tab', {name:'Outfit',exact:true}).click();
  await page.getByRole('button', { name: 'Customize my avatar' }).click();
  await page.getByLabel('Avatar photo').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('checkbox', { name: /my photo and voice/ }).check();
  await page.getByRole('button', { name: 'Build my avatar' }).click();
  await expect(page.getByText(/Your villager is being built/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Build your avatar' }).locator('[data-portrait-kind="photo"] img')).toBeVisible();
  await expect(page.getByText('Your avatar is ready.')).toBeVisible();
  await page.getByRole('button', { name: 'Close profile' }).click(); lam = true;
  await page.getByRole('button', { name: 'My profile' }).click();
  await expect(page.locator('.profile-hero [data-portrait-kind="lam_head"] img')).toBeVisible();
  await expect(page.locator('.profile-hero .head-coming')).not.toBeVisible();
  expect(imageHeaders.length).toBeGreaterThan(2);
  expect(imageHeaders.every(value => value === DEMO_USER_ID)).toBe(true);
});

test('new identity joins by invitation and reaches avatar onboarding', async ({ page }) => {
  const backend = new MockApi(); let joined = false;
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.slice(4) + url.search;
    if (path.includes('/scene-voice/')) return route.fulfill({json:{audio_url:null}});
    const body = request.postData() ? request.postDataJSON() : undefined;
    const result = await backend.request<any>(request.method(), path, DEMO_USER_ID, body);
    if (path === '/me' && request.method() === 'GET' && !joined) result.villages = [];
    if (path === '/villages/join') joined = true;
    await route.fulfill({ json: result });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your friends live here.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/village-onboarding.png', animations: 'disabled' });
  await page.getByLabel('Display name').fill('New neighbor');
  await page.getByLabel('Invite code').fill('hacklanta');
  await page.getByRole('button', { name: 'Join village' }).click();
  await expect(page.getByRole('region', { name: 'Build your avatar' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter village' }).click();
  await expect(page.getByTestId('villager-New neighbor')).toBeVisible();
});

test('bearer transport never sends demo identity and authenticates private media', async ({ page }) => {
  const backend = new MockApi();
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url()), path = url.pathname.slice(4) + url.search;
    if (path.startsWith('/assets/')) return route.fulfill({ contentType: 'image/png', body: Buffer.from([1, 2, 3]) });
    await route.fulfill({ json: await backend.request('GET', path, DEMO_USER_ID) });
  });
  await page.goto('/');
  await expect(page.getByTestId('my-xp')).toBeVisible();
  const headers: Record<string, string>[] = [];
  const paths: string[] = [];
  page.on('request', r => { const path = new URL(r.url()).pathname; if (path === '/api/me' || path === '/api/assets/avatars/synthetic.png') { headers.push(r.headers()); paths.push(path); } });
  await page.evaluate(async () => {
    // @ts-expect-error Vite runtime module
    const { api } = await import('/src/api/client.ts');
    api.tokenProvider = async () => 'synthetic-test-token';
    await api.me(); await api.asset('avatars/synthetic.png');
  });
  // Capture the explicit probes; background requests started before the token swap retain their original auth snapshot.
  expect(paths).toContain('/api/me');
  expect(paths).toContain('/api/assets/avatars/synthetic.png');
  expect(headers.every(h => h.authorization === 'Bearer synthetic-test-token' && !h['x-demo-user'])).toBe(true);
});

test('unavailable health endpoint automatically opens the offline village', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({ status: 503, json: { detail: 'Offline' } }));
  await page.goto('/');
  await expect(page.getByText('Demo village', { exact: true })).toBeAttached();
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await expect(page.getByTestId('my-xp')).toHaveText('420');
});

test('live fetch sends demo identity; lost response retry retains key and earns XP once', async ({ page }) => {
  const backend = new MockApi();
  const headers: string[] = [], keys: string[] = [];
  let loseResponse = true;
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice(4) + url.search;
    const user = request.headers()['x-demo-user'];
    if (path !== '/health') headers.push(user);
    if (path.includes('/scene-voice/')) return route.fulfill({json:{audio_url:null}});
    const body = request.postData() ? request.postDataJSON() : undefined;
    const data = await backend.request(request.method(), path, user || DEMO_USER_ID, body);
    if (path.endsWith('/check-ins')) {
      keys.push(body.idempotency_key);
      if (loseResponse) { loseResponse = false; await route.abort('connectionreset'); return; }
    }
    await route.fulfill({ json: data });
  });
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeAttached();
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await page.getByRole('button', {name:/Daily note/}).click();
  await page.getByLabel('What’s on your mind today?').fill('Even a lost response cannot stop a small win.');
  await page.getByRole('button', { name: 'Share check-in' }).click();
  // A keyed check-in now recovers automatically using the same key.
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('my-xp')).toHaveText('430');
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(headers.length).toBeGreaterThan(4);
  expect(headers.every(value => value === DEMO_USER_ID)).toBe(true);
  await expect(page.getByText('Connected', { exact: true })).toBeAttached();
});

test('live authorization errors stay visible without silently switching to fixtures', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    if (new URL(route.request().url()).pathname.endsWith('/health')) await route.fulfill({ json: { ok: true, db: 'up', gpu_worker: 'down', build: 'test' } });
    else await route.fulfill({ status: 403, json: { detail: 'Not a village member' } });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText('Not a village member');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByTestId('my-xp')).not.toBeVisible();
});
