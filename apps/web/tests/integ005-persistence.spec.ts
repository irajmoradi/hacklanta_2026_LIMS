import { expect, test } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
test('saved architecture and materials persist across reloads and fresh browsers', async ({page, browser}) => {
  await page.goto('/');
  await expect(page.getByText('Connected',{exact:true})).toBeVisible();
  async function editor() {
    await page.getByRole('button',{name:'My profile',exact:true}).click();
    await page.getByRole('tab',{name:'House',exact:true}).click();
  }
  await editor();
  await page.getByRole('button',{name:'Cottage',exact:true}).click();
  const architecture=page.getByRole('group',{name:/Architecture/});
  await architecture.getByRole('button').nth(1).click();
  await page.getByLabel('wall material',{exact:true}).selectOption('brick');
  await page.getByLabel('roof material',{exact:true}).selectOption('metal');
  const model = await page.locator('.house-preview').getAttribute('data-model');
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/me') && r.request().method()==='PATCH');
  await page.getByRole('button',{name:'Save house',exact:true}).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole('status')).toContainText('House saved.');
  await page.reload();await editor();
  await expect(page.locator('.house-preview')).toHaveAttribute('data-model',model!);
  await expect(page.getByLabel('wall material',{exact:true})).toHaveValue('brick');
  await expect(page.getByLabel('roof material',{exact:true})).toHaveValue('metal');
  await page.setViewportSize({width:1280,height:1800});
  await page.locator('.house-editor').screenshot({path:'tests/screenshots/INTEG-005/house-real.png'});
  const fresh=await browser.newContext();
  try {
    await fresh.addInitScript(()=>localStorage.setItem('village:seat:live','13370000-0000-4000-8000-000000000002'));
    const other=await fresh.newPage();await other.goto(page.url());
    const home=other.getByRole('button',{name:/Open Iraj.s house profile/});
    await expect(home).toHaveAttribute('data-house-model',model!);
    await home.click();
    await expect(other.locator('.profile-panel')).toBeVisible();
    await expect(other.getByRole('button',{name:'Save house',exact:true})).toHaveCount(0);
    await other.screenshot({path:'tests/screenshots/INTEG-005/house-neighbor.png'});
  } finally {await fresh.close();}
});
