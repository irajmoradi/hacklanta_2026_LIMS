import {test, expect} from '@playwright/test';
import {useDemoSeat} from './demoSeat';
useDemoSeat();
for (const [width,height] of [[390,844],[1280,720],[1600,1000]]) test(`custom icons and HUD ${width}`, async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({width,height}); await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/'); await expect(page.locator('.dashboard-card')).toHaveCount(3);
  await expect(page.locator('.inbox-entry [data-icon=bell]')).toHaveCount(1);
  await expect(page.locator('.activity-badge .village-icon').first()).toBeAttached();
  const selectors = ['.welcome','.dashboard','.action-dock','.neighbors-strip','.camera-hint'];
  const boxes = [];
  for (const selector of selectors) if (await page.locator(selector).isVisible()) boxes.push({selector,box:(await page.locator(selector).boundingBox())!});
  for (let i=0;i<boxes.length;i++) {
    const {box:a,selector}=boxes[i]; expect(a.x).toBeGreaterThanOrEqual(0); expect(a.y+a.height).toBeLessThanOrEqual(height);
    for (const {box:b,selector:other} of boxes.slice(i+1)) expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${selector} overlaps ${other}`).toBe(true);
  }
  await page.screenshot({animations:'disabled',path:`artifacts/web037/dashboard-${width}.png`});
  for (const [id,icon] of Object.entries({feed:'chat',corner:'sprout',goal:'flag'})) {
    const card=page.locator(`[data-widget=${id}]`); await card.scrollIntoViewIfNeeded();
    await expect(card.locator('h2 .village-icon')).toHaveAttribute('data-icon',icon);
    await expect(card.locator('.widget-badge')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
    await expect(card.locator('h2')).toHaveCSS('font-weight','500');
    await expect(card.locator('h2')).toHaveCSS('font-variant','normal');
    await card.getByRole('button',{name:/^Pop out/}).click();
    await expect(page.locator('.widget-popout h2 .village-icon')).toHaveAttribute('data-icon',icon);
    await page.screenshot({animations:'disabled',path:`artifacts/web037/${id}-${width}.png`});
    await page.locator('.widget-popout').getByRole('button',{name:/^Minimize/}).click();
    await expect(page.locator('.widget-popout')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
