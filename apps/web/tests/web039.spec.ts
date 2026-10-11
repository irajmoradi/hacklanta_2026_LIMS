import { test, expect, type Locator, type Page } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

async function scrollHeader(page: Page, surface: Locator, body = surface) {
  const header = surface.locator(':scope > .modal-header');
  await expect(header).toBeVisible();
  // Exercise long-content behavior even for short/empty seeded inboxes and panels.
  await body.evaluate(el => {
    const tail = document.createElement('div'); tail.dataset.scrollFixture = 'true';
    tail.style.minHeight = '1200px'; tail.setAttribute('aria-hidden', 'true'); el.append(tail);
    el.scrollTop = 0;
  });
  await expect(header).toHaveAttribute('data-scrolled', 'false');
  await expect(header).toHaveCSS('box-shadow', 'none');
  const initial = (await header.boundingBox())!;
  for (const offset of [20, 40, 41, 80, 600]) {
    await body.evaluate((el, y) => { el.scrollTop = y; }, offset);
    await expect(header).toHaveAttribute('data-scrolled', 'true');
    await expect(header).toHaveAttribute('data-compact', String(offset > 40));
    const box = (await header.boundingBox())!;
    expect(Math.abs(box.y - initial.y)).toBeLessThanOrEqual(2);
    const title = (await header.locator('h2').boundingBox())!;
    expect(title.y).toBeGreaterThanOrEqual(0);
    expect(title.y + title.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    const button = header.getByRole('button').first();
    await expect(button).toBeEnabled();
    // Hit testing before click prevents Playwright auto-scroll from hiding a regression.
    expect(await button.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })).toBe(true);
  }
  expect((await header.boundingBox())!.height).toBeLessThan(initial.height);
  await body.evaluate(el => { el.scrollTop = 0; });
  await expect(header).toHaveAttribute('data-compact', 'false');
  await expect(header).toHaveCSS('box-shadow', 'none');
  await body.evaluate(el => { el.querySelector('[data-scroll-fixture]')?.remove(); el.scrollTop = el.scrollHeight; });
  await expect(header).toHaveAttribute('data-compact', String(await body.evaluate(el => el.scrollTop > 40)));
}

for (const width of [1280, 390]) {
  test(`expanded portrait header without GPU assets ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Keep header/control coverage independent of GPU-generated head assets.
    // No new Vite dependencies: importing the Three fixture on demand can trigger
    // optimizer reloads and erase the patched profile before it opens.
    await page.route('**/packages/lam-renderer/src/index.ts*', route => route.fulfill({contentType:'application/javascript', body:`
      export async function mountLamHead(host) {
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
        canvas.style.cssText='width:100%;height:100%';host.append(canvas);
        const ctx=canvas.getContext('2d');ctx.fillStyle='#ddac70';ctx.beginPath();ctx.ellipse(128,128,65,90,0,0,Math.PI*2);ctx.fill();
        return {setAudio(){},setExpr(){},state(){return 'Idle';},dispose(){canvas.remove();}};
      }` }));
    await page.route('**/api/assets/header-test.zip*', route => route.fulfill({ status: 404, body: '' }));
    await page.goto('/');
    await expect(page.locator('.dashboard-card').first()).toBeVisible();
    await page.evaluate(async () => {
      const source = '/src/api/client.ts';
      const { api } = await import(source);
      if (api.mode !== 'mock') throw new Error('This fixture is offline only');
      const profile = api.profile.bind(api);
      api.profile = async (vid: string, uid: string) => {
        const result = await profile(vid, uid);
        result.villager.avatar.portrait = { kind: 'lam_head', asset_url: null, head_package_url: '/api/assets/header-test.zip' };
        return result;
      };
    });
    await page.getByRole('button', { name: 'My profile', exact: true }).click();
    const opener = page.getByRole('button', { name: 'Open big head view' }).first();
    await page.locator('.lam-head').filter({has:opener}).hover();
    await opener.click();
    const stage = page.locator('.head-stage');
    await scrollHeader(page, stage);
    await page.screenshot({ path: `artifacts/web039/portrait-${width}.png`, animations: 'disabled' });
    await stage.getByRole('button', { name: 'Close big head view' }).click();
    await expect(stage).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await page.keyboard.press('Escape');
    await expect(stage).toBeHidden();
    await expect(page.locator('.profile-panel')).toBeVisible();
  });

  test(`sticky modal headers ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.dashboard-card').first()).toBeVisible();
    for (const [key, title] of [
      ['g', 'The Village Gazette'], ['Alt+w', 'Weekly review'],
      ['v', 'Village growth'], ['Alt+a', 'Accomplishments'], ['i', 'My goal'],
    ]) {
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await page.keyboard.press(key);
      const dialog = page.getByRole('dialog', { name: title, exact: true });
      await scrollHeader(page, dialog);
      await page.screenshot({ path: `artifacts/web039/${key.replace('Alt+', '')}-${width}.png`, animations: 'disabled' });
      await dialog.locator(':scope > .modal-header').getByRole('button').click();
      await expect(dialog).toBeHidden();
    }
    // WEB-040/048 replaced scrolling cinematic modals with fixed fullscreen
    // scenes and an independently scrolling conversation. Test that contract.
    for (const [key,title] of [['m','A visit to the Mayor'],['Alt+c','A moment with your villager']]) {
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await page.keyboard.press(key);
      const scene=page.getByRole('dialog',{name:title,exact:true});
      const close=scene.getByRole('button',{name:'Close dialog',exact:true});
      await expect(close).toBeVisible();
      if(key==='m') await scene.getByRole('button',{name:/What's new/}).click();
      const conversation=scene.locator(key==='m'?'.mayor-content':'.scene-conversation');
      await expect(conversation).toBeVisible();
      const initial=(await close.boundingBox())!;
      await conversation.evaluate(el => {
        const tail=document.createElement('div');tail.style.minHeight='1200px';tail.setAttribute('aria-hidden','true');el.append(tail);el.scrollTop=600;
      });
      expect(await conversation.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
      expect(Math.abs((await close.boundingBox())!.y-initial.y)).toBeLessThanOrEqual(2);
      expect(await close.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
      await close.click();await expect(scene).toBeHidden();
    }
    for (const [trigger, title] of [[/Open Settings/, 'Settings'], [/^Inbox/, 'Messages']]) {
      const opener = page.getByRole('button', { name: trigger });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: title as string, exact: true });
      await scrollHeader(page, dialog);
      await page.screenshot({ path: `artifacts/web039/${title}-${width}.png`, animations: 'disabled' });
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    }
    await page.getByRole('button', { name: 'My profile', exact: true }).click();
    const profile = page.locator('.profile-panel');
    await expect(profile.getByRole('tabpanel')).toBeVisible();
    // Current profiles scroll the outer sheet; tab content deliberately uses
    // overflow:visible so the larger head studio cannot hide the tabs.
    await scrollHeader(page, profile);
    await page.screenshot({ path: `artifacts/web039/profile-${width}.png`, animations: 'disabled' });
    await profile.getByRole('tab', { name: 'Rewards', exact: true }).click();
    await expect.poll(() => profile.getByRole('tabpanel').evaluate(el => el.scrollTop)).toBe(0);
    // The larger head studio can scroll the outer profile to reveal its tabs.
    await expect.poll(() => profile.evaluate(el =>
      el.querySelector(':scope > .modal-header')?.getAttribute('data-compact') === String(el.scrollTop > 40)
    )).toBe(true);
    await profile.getByRole('button', { name: 'Close profile' }).click();
    await expect(page.getByRole('button', { name: 'My profile', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Shop', exact: true }).click();
    const shop = page.locator('.walk-shop');
    await scrollHeader(page, shop, shop.locator('.shop-overlay'));
    await page.screenshot({ path: `artifacts/web039/shop-${width}.png`, animations: 'disabled' });
    await shop.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(shop).toBeHidden();
  });

  test(`sticky Compete panels ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // A participant can inspect the floor on mobile; the auditor's booth covers it.
    await page.addInitScript(() => localStorage.setItem('village:seat:mock', '00000000-0000-4000-8000-000000000002'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Compete', exact: true }).click();
    const arena = page.locator('.arena-modal');
    await expect(arena).toBeVisible();
    await page.getByRole('button', { name: /\+ Create/ }).click();
    const create = page.getByRole('form', { name: 'Create competition' });
    await scrollHeader(page, create);
    await page.screenshot({ path: `artifacts/web039/create-${width}.png`, animations: 'disabled' });
    await create.getByRole('button', { name: 'Close create competition' }).click();
    await expect(create).toBeHidden();
    await page.getByRole('button', { name: /The seven-day sprint/ }).click();
    await page.getByRole('button', { name: 'Current', exact: true }).click();
    if (width > 550) {
      await scrollHeader(page, page.getByRole('complementary', { name: 'Leaderboard' }));
      await page.getByRole('button', { name: 'Progress of Lance' }).click();
    } else await page.getByRole('button', { name: 'Inspect Lance', exact: true }).click();
    const evidence = page.getByRole('complementary', { name: 'Participant evidence' });
    await scrollHeader(page, evidence);
    await page.screenshot({ path: `artifacts/web039/evidence-${width}.png`, animations: 'disabled' });
    await evidence.getByRole('button', { name: 'Close participant evidence' }).click();
    await page.getByRole('button', { name: 'Submit / manage competition' }).click();
    const controls = page.getByRole('complementary', { name: 'Competition controls' });
    await scrollHeader(page, controls);
    await page.screenshot({ path: `artifacts/web039/controls-${width}.png`, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(controls).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(arena).toBeHidden();
  });

  test(`terms, auditor, confirmation and popout headers ${width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Pop out Around the village' }).click();
    const popout = page.locator('.widget-popout');
    await scrollHeader(page, popout, popout.locator('.widget-detail'));
    await page.screenshot({ path: `artifacts/web039/popout-${width}.png`, animations: 'disabled' });
    await popout.getByRole('button', { name: 'Minimize Around the village' }).click();
    await expect(popout).toBeHidden();
    await page.getByRole('button', { name: 'Compete', exact: true }).click();
    const banners = page.getByRole('complementary', { name: 'Competition banners' });
    if (width > 550) await scrollHeader(page, banners, banners.locator('.arena-banner-list'));
    await banners.getByRole('button', { name: /The seven-day sprint/ }).click();
    await page.mouse.move(0, 0);
    const booth = page.getByRole('complementary', { name: 'Auditor booth' });
    await scrollHeader(page, booth);
    await page.screenshot({ path: `artifacts/web039/auditor-${width}.png`, animations: 'disabled' });
    await booth.getByRole('button', { name: 'Close auditor booth' }).click();
    await expect(booth).toBeHidden();
    await banners.getByRole('button', { name: 'Open', exact: true }).click();
    await banners.getByRole('button', { name: /The next chapter/ }).click();
    await page.mouse.move(0, 0);
    const terms = page.getByRole('complementary', { name: 'Competition terms' });
    await scrollHeader(page, terms);
    await page.screenshot({ path: `artifacts/web039/terms-${width}.png`, animations: 'disabled' });
    await terms.getByRole('button', { name: /^Join/ }).click();
    const confirmation = page.getByRole('alertdialog');
    await scrollHeader(page, confirmation);
    await page.screenshot({ path: `artifacts/web039/confirmation-${width}.png`, animations: 'disabled' });
    await confirmation.getByRole('button', { name: 'Close dialog' }).click();
    await expect(confirmation).toBeHidden();
    await terms.getByRole('button', { name: 'Close competition terms' }).click();
    await expect(terms).toBeHidden();
    await banners.getByRole('button', { name: 'Close competitions' }).click();
    await expect(page.locator('.arena-modal')).toBeHidden();
  });
}
