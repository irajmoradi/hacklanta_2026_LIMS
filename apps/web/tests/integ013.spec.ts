import {test, expect} from '@playwright/test';
import {useDemoSeat} from './demoSeat';
useDemoSeat();

test('copy pass preserves current widgets, profile, and form controls', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.welcome')).toContainText('Your friends.');
  await expect(page.locator('.dashboard-card')).toHaveCount(3);
  await expect(page.locator('[data-widget=corner] h2')).toHaveText('Your corner');
  await page.getByRole('button', {name:'Check in', exact:true}).last().click();
  await page.getByRole('button', {name:/Daily note/}).click();
  await expect(page.getByPlaceholder('Today I…')).toBeVisible();
  await expect(page.locator('dialog[open]')).toContainText('Post an update for your neighbors.');
  await page.getByRole('button', {name:'Close dialog', exact:true}).click();
  await page.getByRole('button', {name:'My goal', exact:true}).last().click();
  await expect(page.getByLabel('What counts as done?')).toBeVisible();
  await page.getByRole('button', {name:'Close dialog', exact:true}).click();
  await page.getByRole('button', {name:'Mayor', exact:true}).click();
  await page.getByRole('button', {name:/Make a prayer/}).click();
  await expect(page.getByRole('button', {name:'Send wish', exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Close dialog', exact:true}).click();
  await page.getByRole('button', {name:'My profile', exact:true}).click();
  await expect(page.locator('.profile-overview')).toBeVisible();
  await page.screenshot({path:'tests/artifacts/integ013/profile-copy.png'});
});
