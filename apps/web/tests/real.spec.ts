import { expect, test } from '@playwright/test';

test('WEB-006 real generated heads render without mutations', async ({page, request}) => {
  test.setTimeout(90000);
  let available = false;
  try { const health = await request.get('http://127.0.0.1:8010/api/health', {timeout:4000}); available = health.ok() && (await health.json()).ok; } catch { /* Offline is an explicit skip. */ }
  test.skip(!available, 'Village API :8010 is down.');
  const mutations: string[] = [];
  page.on('request', r => { if (['POST', 'PATCH', 'DELETE'].includes(r.method())) mutations.push(r.url()); });
  await page.goto('/'); await page.bringToFront();
  await expect(page.getByText('Connected', {exact:true})).toBeVisible();
  const manifests = await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const me = await api.me();
    const {defaultVillage} = await import('/src/api/villagePreference.ts' as string);
    const world = await api.village(defaultVillage(me));
    return await Promise.all(world.villagers.map((v: {user_id: string}) => api.avatar(v.user_id)));
  });
  const ready = manifests.filter((m: any) => m.body.head_glb_url).length;
  test.skip(!ready, 'No generated head GLBs are ready in the live village.');
  await expect(page.locator('[data-head-kind="glb"]')).toHaveCount(ready, {timeout:60000});
  await page.waitForTimeout(1500);
  await page.screenshot({path:'test-results/web006-world-real.png'});
  expect(mutations).toEqual([]);
});

test('WEB-005 live settings, evidence and world screenshots without provider mutations', async ({page}) => {
  test.setTimeout(90000);
  const models = new Set<string>(), mutations: string[] = [];
  page.on('response', r => { if (r.ok() && r.url().includes('/models/')) models.add(r.url().split('/').pop()!); });
  page.on('request', r => { if (r.url().includes('/api/') && ['POST','PATCH','DELETE'].includes(r.method())) mutations.push(r.url()); });
  await page.addInitScript(() => localStorage.setItem('village:last:13370000-0000-4000-8000-000000000001', '13370000-0000-4000-8000-000000000000'));
  await page.goto('/'); await page.bringToFront();
  await expect(page.getByText('Connected',{exact:true})).toBeVisible();
  await expect(page.locator('.scene-auditor')).toContainText('Auditor');
  await expect.poll(() => ['pet_dog.glb','crater.glb','hat_crown.glb'].every(name => models.has(name)), {timeout:30000}).toBe(true);
  await page.waitForTimeout(3000);
  const fps = await page.evaluate(() => new Promise<number>(resolve => { let frames = 0; const start = performance.now(); const frame = (now: number) => { frames++; if (now - start >= 3000) resolve(frames * 1000 / (now-start)); else requestAnimationFrame(frame); }; requestAnimationFrame(frame); }));
  console.log(`WEB-005 live browser RAF: ${fps.toFixed(1)} fps (host hardware, not an iGPU certification)`);
  await page.screenshot({path:'test-results/web005-world.png'});
  await page.getByRole('button',{name:'My profile'}).click(); await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Display name',{exact:true})).toHaveValue('Iraj');
  await page.screenshot({path:'test-results/web005-settings.png'});
  await page.getByRole('button',{name:'Close dialog'}).click(); await page.getByRole('button',{name:'Close profile'}).click();
  await page.getByRole('button',{name:'Visit Lance',exact:true}).click(); await page.getByRole('button',{name:'View evidence',exact:true}).first().click();
  await expect(page.getByRole('dialog',{name:'Evidence review'}).getByText('AI verdict: suspicious')).toBeVisible();
  await expect(page.getByAltText('Full check-in evidence')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Evidence review'}).getByText(/Model: demo-fixture/)).toBeVisible();
  await page.screenshot({path:'test-results/web005-evidence.png'});
  expect(mutations).toEqual([]);
});

test('Mario profile renders a real authenticated LAM canvas', async ({ page, request }) => {
  test.setTimeout(120000);
  let available = false;
  try { const health = await request.get('http://127.0.0.1:8010/api/health', { timeout: 4000 }); available = health.ok() && (await health.json()).ok; } catch { /* Offline is an intentional skip. */ }
  test.skip(!available, 'Village API :8010 is down.');
  await page.goto('/'); await page.bringToFront();
  const zip = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/head/avatar.zip'));
  await page.getByRole('button', { name: 'Visit Mario', exact: true }).click();
  expect((await zip).request().headers()['x-demo-user']).toBe('13370000-0000-4000-8000-000000000001');
  await expect(page.locator('.profile-hero [data-head-state="ready"]')).toBeVisible({ timeout: 90000 });
  await expect(page.locator('.profile-hero canvas')).toBeVisible();
  await expect(page.locator('[data-lam-host]')).toHaveCount(1);
  // Allow the visible-tab renderer to draw after its package finishes loading.
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/dev-profile-lam.png' });
  await page.getByRole('button', { name: 'Close profile' }).click();
  await expect(page.locator('[data-lam-host]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Visit Mario', exact: true }).click();
  await expect(page.locator('.profile-hero [data-head-state="ready"]')).toBeVisible({ timeout: 90000 });
  await expect(page.locator('[data-lam-host]')).toHaveCount(1);
});

test('real seeded village accepts a check-in and updates its feed', async ({ page, request }) => {
  let available = false;
  try { const health = await request.get('http://127.0.0.1:8010/api/health', { timeout: 4000 }); available = health.ok() && (await health.json()).ok; } catch { /* Offline is an intentional skip. */ }
  test.skip(!available, 'Village API :8010 is down.');
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Play as')).toHaveValue('13370000-0000-4000-8000-000000000001');
  const note = `WEB-002 real smoke: a small step together ${Date.now()}`;
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await page.locator('#checkin-body').fill(note);
  const posted = page.waitForResponse(r => r.url().endsWith('/check-ins') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Share check-in', exact: true }).click();
  const result = await posted;
  expect(result.status()).toBeLessThan(300);
  expect(result.request().headers()['x-demo-user']).toBe('13370000-0000-4000-8000-000000000001');
  await expect(page.getByRole('region', { name: 'Village feed' })).toContainText(note);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Village feed' })).toContainText(note);
  await page.getByRole('button', { name: 'AI at work' }).click();
  await expect(page.getByRole('heading', { name: 'AI at work' })).toBeVisible();
  await expect(page.getByText('AI activity is not available on this server yet.')).not.toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Iraj', exact: true })).toBeVisible();
});

test('real weekly current is readable without generation or grading', async ({page, request}) => {
  let available = false;
  try {const response = await request.get('http://127.0.0.1:8010/api/health', {timeout:4000}); available = response.ok() && (await response.json()).ok;} catch { /* Skip only if down. */ }
  test.skip(!available, 'Village API :8010 is down.');
  const mutations: string[] = []; page.on('request', r => {if (r.method() === 'POST' && /weekly|competitions/.test(r.url())) mutations.push(r.url());});
  const current = page.waitForResponse(r => r.url().endsWith('/weekly/current'));
  await page.goto('/'); const response = await current; expect(response.ok()).toBe(true); const week = await response.json();
  expect(week.week_start).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(Array.isArray(week.goals)).toBe(true);
  await page.getByRole('button',{name:'Weekly review',exact:true}).click(); await expect(page.getByRole('heading',{name:'Weekly review',exact:true})).toBeVisible();
  await expect(page.locator('.audit-banner').getByText(/Auditor:/)).toBeVisible(); expect(mutations).toEqual([]);
});


test('WEB-010 live dressed plaza without mutations', async ({page, request}) => {
  test.setTimeout(90000);
  let available = false;
  try { const health = await request.get('http://127.0.0.1:8010/api/health', {timeout:4000}); available = health.ok() && (await health.json()).ok; } catch { /* Explicit offline skip. */ }
  test.skip(!available, 'Village API :8010 is down.');
  const mutations: string[] = []; page.on('request', r => { if (['POST','PATCH','DELETE'].includes(r.method())) mutations.push(r.url()); });
  await page.addInitScript(() => localStorage.setItem('village:last:13370000-0000-4000-8000-000000000001', '13370000-0000-4000-8000-000000000000'));
  await page.goto('/'); await page.bringToFront();
  await expect(page.getByText('Connected', {exact:true})).toBeVisible();
  for (const [name, item] of [['Iraj','hat_headphones'],['Iraj','glasses_round'],['Lance','hat_festival'],['Stefanny','hat_crown'],['Stefanny','scarf'],['Maya','jacket_denim'],['Dev','hat_cap']]) {
    await expect(page.getByTestId(`villager-${name}`)).toHaveAttribute('data-cosmetics', new RegExp(item), {timeout:60000});
  }
  const headNames = await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const village = await api.village('13370000-0000-4000-8000-000000000000');
    return village.villagers.filter((v: any) => v.avatar.body.head_glb_url).map((v: any) => v.display_name);
  });
  for (const name of headNames) await expect(page.getByTestId(`villager-${name}`)).toHaveAttribute('data-head-kind', 'glb', {timeout:60000});
  await page.waitForTimeout(2000);
  await page.screenshot({path:'test-results/web010-plaza-real.png'});
  await page.mouse.move(1050, 600);
  for (let step = 0; step < 12; step++) { await page.mouse.wheel(0, -180); await page.waitForTimeout(80); }
  await page.waitForTimeout(1800);
  await page.screenshot({path:'test-results/web010-outfits-real.png'});
  expect(mutations).toEqual([]);
});
