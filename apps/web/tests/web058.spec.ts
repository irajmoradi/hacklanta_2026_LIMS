import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

async function close(page: Page) {
  for (let i=0;i<3;i++) {await page.keyboard.press('Escape'); await page.waitForTimeout(150);}
}

test('QA-014 regressions: navigation, arena filters, Gazette sign and selected updates', async ({page}, info) => {
  const debug: string[] = [];
  page.on('request', request => {if(request.url().includes('/demo/debug')) debug.push(request.url());});
  await page.goto('/');
  await expect(page.locator('.topbar')).toBeVisible();
  await page.evaluate(async () => {
    const path='/src/api/client.ts';
    const {api}=await import(/* @vite-ignore */ path);
    if(api.mode !== 'mock') throw new Error('Fixture seeding requires mock mode');
    await api.request('POST','/villages/11111111-1111-4111-8111-111111111111/mayor/recap',{});
  });
  const phone = info.project.name === 'mobile';
  if(phone) await expect(page.locator('.dashboard')).toHaveAttribute('data-collapsed','true');
  for (const name of ['Open Settings','My profile','Compete','Mayor','Shop']) {
    const control = page.getByRole('button',{name,exact:true});
    await expect(control).toBeInViewport();
    await control.click({trial:true});
  }
  expect(debug).toEqual([]);
  const dir = `tests/screenshots/WEB-058/${info.project.name}`; mkdirSync(dir,{recursive:true});
  await page.screenshot({timeout:45000,path:`${dir}/navigation.png`});
  if (!phone) {
    await page.getByRole('button',{name:'My profile',exact:true}).click();
    await page.getByRole('tab',{name:'Accomplishments',exact:true}).click();
    const clear = await page.locator('.player-hint').evaluate(hint => {
      const a=hint.getBoundingClientRect();
      return [...document.querySelectorAll('.dashboard,.neighbors-strip,.social-entry-stack')].every(control=>{
        const b=control.getBoundingClientRect(); return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;
      });
    });
    expect(clear).toBe(true);
    await page.screenshot({timeout:45000,path:`${dir}/profile-accomplishments.png`});
    await page.getByRole('button',{name:'Close profile',exact:true}).click();
  }
  await page.getByRole('button',{name:'Compete',exact:true}).click();
  const filters = page.getByRole('navigation',{name:'Competition list filters'});
  await expect(filters).toBeVisible({timeout:60000});
  await filters.getByRole('button',{name:'Open',exact:true}).click();
  await page.locator('.arena-banner').first().click();
  await page.screenshot({timeout:45000,path:`${dir}/arena-detail.png`});
  for (const filter of ['Current','Mine','Past','Open']) {
    const button=filters.getByRole('button',{name:filter,exact:true});
    await button.click(); await expect(button).toHaveAttribute('aria-pressed','true');
  }
  await close(page);
  const collapse = page.getByRole('button',{name:'Collapse dashboard',exact:true});
  if(await collapse.isVisible()) await collapse.click();
  const gazette = page.getByRole('button',{name:'Read the Gazette at the plaza notice board',exact:true});
  await expect(gazette).toBeVisible({timeout:30000});
  await gazette.click();
  await expect(page.getByRole('dialog').filter({hasText:'The Village Gazette'})).toBeVisible();
  await page.screenshot({timeout:45000,path:`${dir}/gazette.png`});
  await close(page);
  await page.getByRole('button',{name:'Reopen dashboard',exact:true}).click();
  const feed = page.getByRole('region',{name:'Around the village',exact:true});
  const event=feed.locator('article button').filter({hasText:'A new event from the Mayor'}).first();
  await expect(event).toBeVisible(); await event.click();
  await expect(page.getByRole('dialog').locator('[data-activity-id]')).toBeVisible();
  await expect(page.getByRole('group',{name:'Dialogue choices'})).toHaveCount(0);
  await page.screenshot({timeout:45000,path:`${dir}/selected-update.png`});
});

test('QA14-05 Lab signs remain independently clickable at 10 and 100 neighbors', async ({page},info) => {
  await page.goto('/lab');
  for (const [value,count] of [[0,10],[3,100]]) {
    await page.getByRole('slider',{name:'Population'}).fill(String(value));
    const sign=page.getByRole('button',{name:'Read the Gazette at the plaza notice board',exact:true});
    await expect(sign).toBeVisible({timeout:30000});
    await sign.click({trial:true});
    const overlap = await page.locator('button.scene-label:visible').evaluateAll(signs => {
      const boxes=signs.map(sign=>sign.getBoundingClientRect());
      return boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));
    });
    expect(overlap).toBe(false);
    const dir=`tests/screenshots/WEB-058/${info.project.name}`;mkdirSync(dir,{recursive:true});
    await page.screenshot({timeout:45000,path:`${dir}/lab-${count}.png`});
  }
});
