import { expect, test, type Page } from '@playwright/test';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID, DEMO_VILLAGE_ID } from '../src/api/fixtures';

const VID = '13370000-0000-4000-8000-000000000000';
async function setup(page: Page, options: {conflict?:boolean; balance?:number; competition?:boolean} = {}) {
  page.on('pageerror', error => console.error('BROWSER', error.message));
  page.on('console', message => {if (message.type() === 'error') console.error('CONSOLE',message.text());});
  const backend = new MockApi();
  let hold = false, writes = 0, held = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  if (options.competition) await backend.request('POST', `/villages/${DEMO_VILLAGE_ID}/competitions`, DEMO_USER_ID,
    {title:'Contrast regression', terms:'Synthetic test competition.', friendly:false, auditor_id:DEMO_USER_ID, entry_lamports:0});
  await page.addInitScript(uid => {localStorage.setItem('village:seat:live', uid); localStorage.setItem('village:guest:live', uid);}, DEMO_USER_ID);
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url());
    const path = (url.pathname.slice(4) + url.search).replaceAll(VID, DEMO_VILLAGE_ID);
    if (hold && req.method() === 'GET' && path === `/villages/${DEMO_VILLAGE_ID}`) {held++; await gate;}
    if (path === '/demo/seat') return route.fulfill({json:{conflict:!!options.conflict}});
    if (path === '/demo/debug') return route.fulfill({json:{enabled:false}});
    try {
      const result = await backend.request<any>(req.method(), path, DEMO_USER_ID, req.postData() ? JSON.parse(req.postData()!.replaceAll(VID, DEMO_VILLAGE_ID)) : undefined);
      if (options.balance !== undefined && path.endsWith('/shop')) result.balance = options.balance;
      if (['POST','PATCH'].includes(req.method()) && !path.includes('/presence')) writes++;
      await route.fulfill({contentType:'application/json', body:JSON.stringify(result).replaceAll(DEMO_VILLAGE_ID, VID)});
    } catch (error) {
      await route.fulfill({status:(error as {status?:number}).status ?? 500, json:{detail:String(error)}});
    }
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:'My profile'})).toBeVisible();
  return {block:() => {hold=true;}, release:() => {hold=false; release();}, writes:() => writes, held:() => held};
}

test('mobile shared-seat chip stays inside the header', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await setup(page, {conflict:true});
  const chip = page.getByRole('status',{name:/Another tester chose Iraj/});
  await expect(chip).toBeVisible();
  const bounds = await chip.boundingBox(), header = await page.locator('.topbar').boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(header!.y + header!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/integ008/mobile-seat.png',fullPage:true});
});

test('photo token uses shop shortage and prerequisite reasons', async ({page}) => {
  await setup(page, {balance:10});
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  const creator = page.getByRole('region',{name:'Make it real'});
  await expect(creator.getByRole('button',{name:/Buy photo token/})).toBeDisabled();
  await expect(creator.getByText('Need 15 more coins')).toBeVisible();
  await page.screenshot({path:'artifacts/integ008/photo-token.png',fullPage:true});
});

test('enabled management controls meet AA contrast', async ({page}) => {
  await setup(page, {competition:true});
  await page.getByRole('button',{name:'Compete',exact:true}).click();
  await page.getByRole('button',{name:/Contrast regression/}).click();
  await page.getByRole('button',{name:'Submit / manage competition'}).click();
  const settle = page.getByRole('button',{name:'Settle competition'});
  await expect(settle).toBeEnabled();
  for (const button of await page.locator('.arena-manage button:enabled').all()) {
    const contrast = await button.evaluate(el => {
      const css = getComputedStyle(el);
      function luminance(color: string) {
        const channels = color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(c => {const s=c/255; return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
        return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
      }
      let parent: Element | null = el;
      while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
      const a=luminance(css.color), b=luminance(getComputedStyle(parent!).backgroundColor);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
  await settle.scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/integ008/arena-contrast.png',fullPage:true});
});

test('shop purchase updates ownership and releases controls before refresh', async ({page}) => {
  const network = await setup(page);
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  const buy = page.getByRole('button',{name:/^Buy /}).filter({hasText:/coins$/}).first();
  await expect(buy).toBeEnabled();
  const name = (await buy.getAttribute('aria-label'))!.replace(/^Buy /,'');
  const id = await buy.evaluate(el => el.closest('[data-item-id]')!.getAttribute('data-item-id'));
  const card = page.locator(`.shop-item[data-item-id="${id}"]`);
  network.block();
  try {
    await buy.click();
    await expect.poll(network.held).toBeGreaterThan(0);
    await expect(card.getByRole('button',{name:`Unequip ${name}`,exact:true})).toBeEnabled({timeout:1500});
    await expect(card.getByRole('button',{name:`Buy ${name}`,exact:true})).toBeDisabled();
  } finally {network.release();}
});

for (const action of ['checkin','goal','house','idle'] as const) {
  test(`${action} acknowledges acceptance while village refresh is blocked`, async ({page}) => {
    const network = await setup(page);
    try {
      if (action === 'checkin') {
        await page.getByRole('button',{name:'Check in',exact:true}).click();
        await page.locator('#checkin-body').fill('Synthetic accepted check-in');
      } else if (action === 'goal') {
        await page.getByRole('button',{name:'My goal',exact:true}).click();
      } else {
        await page.getByRole('button',{name:'My profile'}).click();
        if (action === 'house') {await page.getByRole('tab',{name:'House',exact:true}).click(); await page.getByRole('button',{name:'Edit my house'}).click();}
        if (action === 'idle') {await page.getByRole('tab',{name:'Outfit',exact:true}).click(); await page.getByRole('button',{name:'Customize my avatar'}).click();}
      }
      const before = network.writes();
      network.block();
      if (action === 'checkin') await page.getByRole('button',{name:'Share check-in'}).click();
      if (action === 'goal') await page.getByRole('button',{name:'Save my goal'}).click();
      if (action === 'house') await page.getByRole('button',{name:'Save house'}).click();
      if (action === 'idle') await page.getByRole('combobox',{name:'Idle activity',exact:true}).selectOption('reading');
      await expect.poll(network.writes).toBeGreaterThan(before);
      await expect.poll(network.held).toBeGreaterThan(0);
      if (action === 'checkin' || action === 'goal') await expect(page.locator('dialog[open]')).toHaveCount(0, {timeout:1500});
      if (action === 'house') {
        await expect(page.getByRole('button',{name:'Save house'})).toBeEnabled({timeout:1500});
        await expect(page.getByText('House saved. Welcome home!')).toBeVisible();
      }
      if (action === 'idle') {
        await expect(page.getByRole('combobox',{name:'Idle activity',exact:true})).toBeEnabled({timeout:1500});
        await expect(page.getByRole('combobox',{name:'Idle activity',exact:true})).toHaveValue('reading');
      }
    } finally {network.release();}
  });
}
