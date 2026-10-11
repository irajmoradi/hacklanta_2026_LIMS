import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('read-only production judge sweep', async ({ page, context }, info) => {
  const followup = process.env.QA015_FOLLOWUP === '1';
  const dir = resolve('tests/screenshots/QA-015', info.project.name + (followup ? '-followup' : ''));
  mkdirSync(dir, { recursive: true });
  const events: any[] = [], snapshots: any[] = [], blocked: string[] = [];
  let surface = 'first-load';
  const clean = (url: string) => { const u = new URL(url); return u.origin + u.pathname; };
  await context.route('**/*', async route => {
    const r = route.request();
    if (r.method() !== 'GET') {
      blocked.push(`${r.method()} ${clean(r.url())}`);
      events.push({ surface, kind: 'blocked-write', method: r.method(), url: clean(r.url()) });
      await route.abort('blockedbyclient'); return;
    }
    const headers = { ...r.headers() };
    if (new URL(r.url()).pathname.startsWith('/api/')) headers['x-demo-user'] = '13370000-0000-4000-8000-000000000001';
    await route.continue({ headers });
  });
  // Preserve real handshake/incoming data, but never send presence, movement or room writes.
  await context.routeWebSocket('**/*', ws => {
    const server = ws.connectToServer();
    ws.onMessage(() => {});
    server.onMessage(message => ws.send(message));
  });
  await context.addInitScript(() => {
    localStorage.setItem('village:seat:live', '13370000-0000-4000-8000-000000000001');
  });
  page.on('pageerror', e => events.push({ surface, kind: 'pageerror', message: e.message }));
  page.on('console', m => { if (m.type() === 'error') events.push({ surface, kind: 'console', message: m.text() }); });
  page.on('response', async r => {
    if (r.request().method() === 'GET' && /\/api\/villages\/[^/]+$/.test(new URL(r.url()).pathname) && r.ok()) {
      const village = await r.json().catch(() => null);
      if (village) events.push({surface, kind:'live-disaster-state', disaster: village.world?.disaster ?? null});
    }
  });
  page.on('response', r => { if (r.status() >= 400) events.push({ surface, kind: 'http', status: r.status(), url: clean(r.url()) }); });
  page.on('requestfailed', r => events.push({ surface, kind: 'network', url: clean(r.url()), error: r.failure()?.errorText }));
  page.on('requestfinished', r => { const t = r.timing(); if (t.responseEnd > 3000) events.push({ surface, kind: 'slow-request', ms: Math.round(t.responseEnd), url: clean(r.url()) }); });
  async function snap(name: string) {
    surface = name;
    await page.waitForTimeout(3000);
    // Do not commit real people's photos or contact values with QA evidence.
    // CSS covers native dialog top layers as well as ordinary DOM portraits.
    const privacy = await page.addStyleTag({ content: 'img:not([src$=".svg"]), .portrait, .lam-head, .lam-canvas, video, input[type="tel"], input[name*="phone"] { visibility: hidden !important; }' });
    await page.waitForTimeout(150);
    try {
      await page.screenshot({ path: resolve(dir, `${name}.png`), timeout: 45000,
        mask: [page.locator('img:not([src$=".svg"]), .portrait, video, input[type="tel"], input[name*="phone"]')],
        maskColor: '#9ba596' });
    } finally { await privacy.evaluate(el => el.parentNode?.removeChild(el)); }
    snapshots.push({ name, url: page.url(), text: await page.locator('body').innerText(),
      buttons: await page.getByRole('button').allTextContents(),
      tabs: await page.getByRole('tab').allTextContents(),
      brokenImages: await page.locator('img').evaluateAll(imgs => imgs.filter((i): i is HTMLImageElement => i instanceof HTMLImageElement && i.complete && i.naturalWidth === 0).map(i => i.alt)),
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    writeFileSync(resolve(dir, 'observations.json'), JSON.stringify({ capturedAt: new Date().toISOString(), snapshots, events, blocked }, null, 2));
    console.log(`${info.project.name}: ${name}`);
  }
  async function step(name: string, action: () => Promise<void>) {
    surface = name;
    const start = Date.now();
    try { await action(); await snap(name); }
    catch (e) { events.push({ surface, kind: 'navigation-failure', message: String(e) }); await snap(`${name}-failed`).catch(() => {}); }
    events.push({ surface: name, kind: 'step-duration', ms: Date.now() - start });
  }
  async function close() {
    for (let n = 0; n < 3; n++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
    const profile = page.getByRole('button', { name: 'Close profile', exact: true });
    if (await profile.isVisible()) await profile.click();
  }
  async function button(name: string) { await page.getByRole('button', { name, exact: true }).click(); }
  try {
    if (!followup) {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await snap('first-load');
    await page.waitForTimeout(15000);
    events.push({ kind: 'initial-observation', ms: Date.now() - start });
    await snap('village');
    await close();
    await snap('dashboard');
    events.push({surface,kind:'repair-tasks-visible',count:await page.getByRole('region',{name:'Repair tasks',exact:true}).count()});
    if (await page.getByRole('region',{name:'Repair tasks',exact:true}).count()) await snap('live-repair-tasks');
    events.push({surface,kind:'navigation-geometry',rows:await page.locator('.topbar-right, .action-dock').evaluateAll(rows=>rows.map(el=>({className:el.className,width:el.clientWidth,scrollWidth:el.scrollWidth,buttons:[...el.querySelectorAll('button')].map(b=>({label:b.getAttribute('aria-label')||b.textContent,left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right}))})))});

    await step('topbar-alerts', async () => { await page.getByRole('button', { name: /^Alerts/ }).click(); });
    await close();
    await step('profile-overview', async () => { await button('My profile'); });
    for (const tab of ['Accomplishments', 'Outfit', 'House', 'Rewards', 'Activity', 'Overview']) {
      await step(`profile-${tab.toLowerCase()}`, async () => { await page.getByRole('tab', { name: tab, exact: true }).click(); });
      if (tab === 'House') {
        await step('house-interior', async () => { await button('Go inside'); });
        await step('house-exit', async () => { await button('Back to village'); });
      }
    }
    await close();
    await step('community-hall', async () => { await button('Community Hall'); });
    await step('hall-exit', async () => { await button('Back to village'); });
    await close();
    await step('shop', async () => { await button('Shop'); });
    const shopTabs = await page.getByRole('tab').allTextContents();
    for (const tab of shopTabs.filter(t => !['Farm Store', 'My wardrobe'].includes(t.trim()))) {
      await step(`shop-${tab.trim().toLowerCase().replace(/\W+/g, '-')}`, async () => { await page.getByRole('tab', { name: tab.trim(), exact: true }).click(); });
    }
    await step('shop-wardrobe', async () => { await page.getByRole('tab', { name: 'My wardrobe', exact: true }).click(); });
    await step('shop-items', async () => { await page.getByRole('tab', { name: 'Shop items', exact: true }).click(); });
    await step('shop-pets-shelter', async () => { await page.getByRole('tab', { name: 'Farm Store', exact: true }).click(); });
    await step('shop-treasury', async () => { await page.locator('summary').filter({ hasText: 'Treasury' }).click(); await page.getByRole('region', { name: 'Treasury', exact: true }).scrollIntoViewIfNeeded(); });
    await close();
    await step('competition-create', async () => { await button('Compete'); await page.locator('.arena-create-banner').click(); });
    for (const mode of ['winner_take_all', 'proportional', 'ranked']) await step(`payout-${mode}`, async () => { await page.locator('label').filter({hasText:/^Payout mode/}).locator('select').selectOption(mode); });
    await step('payout-invalid-split', async () => { await page.getByLabel('Ranked percentages').fill('60/30/20'); await expect(page.getByRole('button', {name:'Create competition with these terms',exact:true})).toBeDisabled(); });
    await step('payout-valid-split', async () => { await page.getByLabel('Ranked percentages').fill('60/30/10'); });
    await close();
    await step('colosseum-current', async () => { await button('Compete'); });
    for (const filter of ['Open', 'Current', 'Mine', 'Past']) {
      await step(`colosseum-${filter.toLowerCase()}`, async () => { await page.getByRole('navigation', { name: 'Competition list filters' }).getByRole('button', { name: filter, exact: true }).click(); });
      const banner = page.locator('.arena-banner').first();
      if (await banner.isVisible()) await step(`competition-${filter.toLowerCase()}`, async () => { await banner.click(); });
    }
    await close();
    for (const [name, label] of [['mayor-plaza', 'Mayor'], ['gazette', 'Read the Gazette at the plaza notice board'], ['inbox', 'Inbox'], ['settings', 'Open Settings'], ['ai-at-work', 'AI at work'], ['village-panel', 'Village']] as const) {
      await step(name, async () => { await button(label); });
      if (name === 'settings') {
        const dialog = page.getByRole('dialog');
        await step('settings-bottom', async () => { await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; }); });
      }
      await close();
    }
    const reopen = page.getByRole('button', {name:'Reopen dashboard',exact:true});
    if(await reopen.isVisible()) await reopen.click();
    const feed = page.getByRole('region', { name: 'Around the village', exact: true });
    const targets = await feed.locator('article button').allTextContents();
    for (let i = 0; i < targets.length; i++) {
      await step(`activity-target-${i + 1}`, async () => { await feed.locator('article button').nth(i).click(); });
      await close();
    }
    await step('walking', async () => { await page.locator('body').click({ position: { x: 5, y: 450 } }); await page.keyboard.down('w'); await page.waitForTimeout(1200); await page.keyboard.up('w'); });
    await step('reload-mid-walk', async () => { await page.keyboard.down('d'); await page.waitForTimeout(300); await page.reload({ waitUntil: 'domcontentloaded' }); await page.keyboard.up('d'); await page.waitForTimeout(5000); });
    await step('lab-town', async () => { await page.goto('/lab', { waitUntil: 'domcontentloaded' }); });
    for (const [value, count] of ['10', '25', '50', '100'].entries()) {
      await step(`lab-town-${count}`, async () => { await page.getByRole('slider', { name: 'Population' }).fill(String(value)); });
    }
    // Lab uses a separate in-memory sandbox (source verified). These controls never mutate live state.
    await step('lab-disasters', async () => { await page.getByRole('button', { name: /Disasters & repair/ }).click(); });
    for (const kind of ['scorch', 'outbreak', 'blackout', 'blight']) {
      await step(`lab-${kind}`, async () => { await button(kind); });
      for (let i = 1; i <= 4; i++) {
        await button('Simulate check-ins +3');
        events.push({ surface: `lab-${kind}`, kind: 'repair-step', step: i, status: await page.locator('.lab-status').innerText() });
      }
      await step(`lab-${kind}-repaired`, async () => { await button('Repair'); });
    }
    await step('lab-mayor-example', async () => {
      await button('scorch');
      // One click per viewport, two total in the broad run. POST remains blocked.
      await button('Ask the Mayor');
      await expect(page.getByRole('region', {name:'Repair tasks',exact:true})).toBeVisible();
      await page.locator('summary').filter({hasText:'Why the Mayor chose these'}).click();
    });
    await step('lab-mayor-tasks-complete', async () => {
      for (let n=0; n<10; n++) {
        const available = page.locator('button:not(:disabled)').filter({hasText:/^Simulate /});
        if (!await available.count()) break;
        await available.first().click();
      }
      await button('Repair');
    });
    await button('Clear');
    await step('lab-futures', async () => { await page.getByRole('button', { name: /Village futures/ }).click(); });
    for (let level = 2; level <= 6; level++) await step(`lab-level-${level}`, async () => { await button('Next level'); });
    await step('lab-autoplay', async () => { await button('Autoplay'); await page.waitForTimeout(5000); await button('Pause'); });
    for (const [name, label] of [['onboarding', 'Your first day'], ['avatar-studio', 'Avatar studio']] as const) {
      await step(`lab-${name}`, async () => { await page.getByRole('button', { name: new RegExp(label) }).click(); });
      // Deployed scenes may be newer than this worktree. Walk only explicit local next-step controls.
      for (let n = 1; n <= 12; n++) {
        const next = page.getByRole('button', { name: /^(Next|Continue|Next step|Begin|Start demo)$/ }).first();
        if (!await next.isVisible() || !await next.isEnabled()) break;
        await step(`lab-${name}-step-${n}`, async () => { await next.click(); });
      }
      if (name === 'onboarding') {
        await step('lab-join-step-1', async () => { await button('Join a village'); });
        for(let n=2;n<=3;n++) await step(`lab-join-step-${n}`, async () => { await button('Next'); });
      } else {
        await step('lab-object-step-1', async () => { await page.getByRole('button', {name:/Object.*mesh/}).click(); });
        for(let n=2;n<=4;n++) await step(`lab-object-step-${n}`, async () => { await button('Next'); });
        await step('lab-object-wireframe', async () => { await page.getByLabel('Wireframe',{exact:true}).check(); });
        await step('lab-object-normals', async () => { await page.getByLabel('Surface normals',{exact:true}).check(); });
      }
    }
    } else {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.locator('.topbar').waitFor({ timeout: 30000 });
      await close();
      await step('live-alert-state', async () => {
        const alerts = page.getByRole('button', {name:/^Alerts/});
        if (await alerts.count()) await alerts.click();
      });
      if (await page.getByRole('article', {name:'Village disaster',exact:true}).count()) {
        await step('live-repair-details', async () => {
          const why=page.locator('summary').filter({hasText:'Why the Mayor chose these'});
          if(await why.count()) await why.click();
        });
        await step('live-repair-picker', async () => { await page.getByRole('button',{name:/Help repair/}).click(); });
      }
      await close();
      if (info.project.name === 'mobile') {
        await step('navigation-before-scroll', async () => {
          events.push({ surface, kind: 'navigation-geometry', rows: await page.locator('.topbar-right, .action-dock').evaluateAll(rows => rows.map(el => ({ className: el.className, width: el.clientWidth, scrollWidth: el.scrollWidth, scrollLeft: el.scrollLeft, buttons: [...el.querySelectorAll('button')].map(b => ({ label: b.getAttribute('aria-label') || b.textContent, left: b.getBoundingClientRect().left, right: b.getBoundingClientRect().right })) }))) });
        });
        await step('navigation-after-scroll', async () => {
          await page.locator('.topbar-right').hover(); await page.mouse.wheel(450, 0);
          await page.locator('.action-dock').hover(); await page.mouse.wheel(450, 0);
          await page.waitForTimeout(400);
        });
      }
      await step('shop-footer', async () => {
        await button('Shop');
        await page.locator('summary').filter({ hasText: 'Photo gifts' }).scrollIntoViewIfNeeded();
        events.push({ surface, kind: 'treasury-count', count: await page.getByText(/Treasury/).count() });
      });
      await step('treasury-config', async () => { await page.locator('summary').filter({hasText:'Treasury'}).click(); await page.getByRole('region',{name:'Treasury',exact:true}).scrollIntoViewIfNeeded(); });
      await close();
      await step('payout-form', async () => { await button('Compete'); await page.locator('.arena-create-banner').click(); await page.getByLabel('Coin entry (use coins or SOL)',{exact:true}).fill('100'); });
      for (const mode of ['winner_take_all','proportional','ranked']) await step(`payout-${mode}`,async()=>{await page.locator('label').filter({hasText:/^Payout mode/}).locator('select').selectOption(mode);});
      await step('payout-invalid-split',async()=>{await page.getByLabel('Ranked percentages').fill('60/30/20');await expect(page.getByRole('button',{name:'Create competition with these terms',exact:true})).toBeDisabled();});
      await step('payout-valid-split',async()=>{await page.getByLabel('Ranked percentages').fill('60/30/10');});
      await close();
      await button('Shop');
      await step('shop-bottoms-recheck', async () => { await page.getByRole('tab', { name: 'Bottoms', exact: true }).click({ timeout: 20000 }); });
      await close();
      if (info.project.name === 'mobile') {
        await step('arena-terms-overlap', async () => { await button('Compete'); await page.getByRole('navigation', { name: 'Competition list filters' }).getByRole('button', { name: 'Open', exact: true }).click(); await page.locator('.arena-banner').first().click(); });
        await step('arena-filter-after-detail', async () => { await page.getByRole('navigation', { name: 'Competition list filters' }).getByRole('button', { name: 'Current', exact: true }).click(); });
        await step('arena-return-to-list', async () => { await button('View competitions'); });
        for (const filter of ['Current', 'Mine', 'Past']) await step(`arena-list-${filter.toLowerCase()}`, async () => { await page.getByRole('navigation', { name: 'Competition list filters' }).getByRole('button', { name: filter, exact: true }).click(); });
        await close();
      }
      await step('study-streak', async () => { await button('Compete'); await page.getByRole('navigation', { name: 'Competition list filters' }).getByRole('button', { name: 'Current', exact: true }).click(); await page.locator('.arena-banner').filter({ hasText: 'Study streak' }).click(); });
      await close();
      await step('mayor-plaza', async () => { await button('Mayor'); });
      await close();
      await step('profile-accomplishments', async () => { await button('My profile'); await page.getByRole('tab', { name: 'Accomplishments', exact: true }).click(); });
      await close();
      await step('house-floor-2', async () => { await button('My profile'); await page.getByRole('tab', { name: 'House', exact: true }).click(); await button('Go inside'); await page.getByRole('tab', { name: 'Floor 2', exact: true }).click(); });
      await step('house-ground', async () => { await page.getByRole('tab', { name: 'Ground floor', exact: true }).click(); });
      await close();
      await step('hall-floor-2', async () => { await button('Community Hall'); await page.getByRole('tab', { name: 'Floor 2', exact: true }).click(); });
      await close();
      await step('dashboard-expand', async () => { const expand=page.getByRole('button',{name:'Reopen dashboard',exact:true}); if(await expand.isVisible()) await expand.click(); });
      await step('expanded-feed', async () => { await button('Pop out Around the village'); });
      await close();
      const minimize = page.getByRole('button', { name: 'Minimize Around the village', exact: true });
      if (await minimize.isVisible()) await minimize.click();
      await step('activity-event-target', async () => { await page.getByRole('region', { name: 'Around the village', exact: true }).locator('article button').filter({ hasText: 'A new event from the Mayor' }).first().click(); await page.waitForTimeout(5000); });
      await close();
      if(info.project.name === 'mobile') {
        await step('gazette-expanded-dashboard', async()=>{await button('Read the Gazette at the plaza notice board');});
        await close();
      }
      await step('gazette-via-keyboard', async () => { await page.evaluate(() => (document.activeElement as HTMLElement)?.blur()); await page.keyboard.press('g'); });
      await close();
      if (info.project.name === 'mobile') {
        await step('gazette-after-collapse', async () => { const collapse = page.getByRole('button', { name: 'Collapse dashboard', exact: true }); if (await collapse.isVisible()) await collapse.click(); await page.getByRole('button', { name: 'Read the Gazette at the plaza notice board', exact: true }).click(); });
        await close();
      }
      await step('lab-sign-before', async () => { await page.goto('/lab#town', { waitUntil: 'domcontentloaded' }); await page.getByRole('slider', { name: 'Population' }).fill('0'); });
      await step('lab-sign-after', async () => { await page.getByRole('button', { name: 'Read the Gazette at the plaza notice board', exact: true }).click(); });
      await step('lab-100-labels', async()=>{await page.getByRole('slider',{name:'Population'}).fill('3');await page.waitForTimeout(5000);});
      await step('lab-100-gazette-hit',async()=>{await button('Read the Gazette at the plaza notice board');});
      await step('lab-clear', async () => { await page.getByRole('button', { name: /Disasters & repair/ }).click(); await button('blight'); await button('Clear'); });
      await step('lab-reload-resets', async () => { await button('blackout'); await button('Simulate check-ins +3'); await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.locator('.lab-status')).toContainText('The village is thriving.'); });
    }
  } finally {
    writeFileSync(resolve(dir, 'observations.json'), JSON.stringify({ capturedAt: new Date().toISOString(), snapshots, events, blocked }, null, 2));
  }
  expect.soft(events.filter(e => e.kind === 'navigation-failure'), 'Every requested surface must be reachable').toEqual([]);
  expect(blocked, 'App attempted non-GET requests; all were blocked before dispatch').toEqual([]);
});
