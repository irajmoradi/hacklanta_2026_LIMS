import {test, expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {useDemoSeat} from './demoSeat';
useDemoSeat();

test('QA15-02 expanded dashboard opens Gazette and restores scene access', async ({page},info) => {
  await page.goto('/');
  await expect(page.locator('.topbar')).toBeVisible();
  const reopen=page.getByRole('button',{name:'Reopen dashboard',exact:true});
  if(await reopen.isVisible()) await reopen.click();
  await expect(page.locator('.dashboard')).toHaveAttribute('data-collapsed','false');
  await page.locator('.dashboard-heading').getByRole('button',{name:'Gazette',exact:true}).click();
  await expect(page.getByRole('dialog').filter({hasText:'The Village Gazette'})).toBeVisible();
  await expect(page.locator('.dashboard')).toHaveAttribute('data-collapsed','true');
  await expect(page.locator('dialog[open] .gazette-paper')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCSS('opacity','1');
  const dir=`tests/screenshots/WEB-059/${info.project.name}`;mkdirSync(dir,{recursive:true});
  await page.screenshot({path:`${dir}/gazette.png`,timeout:45000,animations:'disabled'});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Read the Gazette at the plaza notice board',exact:true}).click();
  await expect(page.getByRole('dialog').filter({hasText:'The Village Gazette'})).toBeVisible();
});

test('QA15-01 public attraction labels do not overlap at 100 neighbors', async ({page},info) => {
  await page.goto('/lab');
  await page.getByRole('slider',{name:'Population'}).fill('3');
  await expect(page.getByTestId('study-spot')).toBeAttached();
  await expect(page.getByTestId('fitness-corner')).toBeAttached();
  await page.waitForTimeout(5000);
  for(let sample=0;sample<3;sample++) {
    const labels=page.locator('.scene-label:visible:not(.villager-label)');
    expect(await labels.count()).toBeGreaterThan(1);
    expect(await labels.evaluateAll(nodes=>{
      const boxes=nodes.map(node=>node.getBoundingClientRect());
      return boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top));
    })).toBe(false);
    await page.waitForTimeout(500);
  }
  await page.getByRole('button',{name:'Read the Gazette at the plaza notice board',exact:true}).click({trial:true});
  const dir=`tests/screenshots/WEB-059/${info.project.name}`;mkdirSync(dir,{recursive:true});
  await page.screenshot({path:`${dir}/town-100.png`,timeout:45000});
});

test('QA15-05 illustrated head notice fits its panel and offers no rotation', async ({page},info) => {
  await page.goto('/lab');
  await page.getByRole('button',{name:/Avatar studio/}).click();
  for(let i=0;i<4;i++) await page.getByRole('button',{name:'Next',exact:true}).click();
  const fallback=page.locator('.lab-head-fallback');
  await expect(fallback).toContainText('no cached package available');
  await expect(page.locator('.lab-demo')).not.toContainText(/Drag to rotate/);
  expect(await fallback.locator('p').evaluate(node=>{
    const text=node.getBoundingClientRect(), panel=node.closest('.lab-stage')!.getBoundingClientRect();
    const range=document.createRange();range.selectNodeContents(node);
    return node.scrollWidth<=node.clientWidth && [...range.getClientRects()].every(r=>r.left>=panel.left && r.right<=panel.right && r.bottom<=panel.bottom) && text.bottom<=panel.bottom;
  })).toBe(true);
  const dir=`tests/screenshots/WEB-059/${info.project.name}`;mkdirSync(dir,{recursive:true});
  await fallback.scrollIntoViewIfNeeded();
  await page.screenshot({path:`${dir}/head-fallback.png`,timeout:45000});
});
