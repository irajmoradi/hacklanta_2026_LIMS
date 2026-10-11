import { expect, test } from '@playwright/test';
import { homeFeed } from '../src/components/homeFeed';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

test('repeated decisions leave room for friend activity', () => {
  const event = {id:'1', type:'agent_decision', user_id:null, text:'[AI Mayor] none: All caught up', payload:{}, created_at:'2026-10-10'};
  const friend = {...event, id:'friend', type:'checkin', text:'Maya checked in'};
  expect(homeFeed([event, {...event,id:'2'}, friend]).map(i => i.id)).toEqual(['1','friend']);
  expect(homeFeed([event, {...event,id:'3',user_id:'Maya'}, friend])).toHaveLength(3);
});

test('phone people, header, native focus containment, nested dialog and resize', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const people = page.locator('.neighbors-strip button');
  await expect(people).toHaveCount(5);
  for (const person of await people.all()) {
    const name = (await person.getAttribute('aria-label'))!.replace('Visit ', '');
    await person.click();
    await expect(page.locator('.profile-name h2')).toHaveText(name);
    await page.getByRole('button',{name:'Close profile'}).click();
  }
  for (const selector of ['.brand','.village-identity','.tour-start','.ai-entry','.inbox-entry','.user-picker','.sound-toggle']) {
    const control = page.locator('.topbar').locator(selector);
    if (!await control.isVisible()) continue; // The demo seat switch replaces the legacy picker.
    await control.scrollIntoViewIfNeeded();
    const box = (await control.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y+box.height).toBeLessThanOrEqual(204);
    expect(box.x+box.width).toBeLessThanOrEqual(390);
  }
  const opener = page.getByRole('button',{name:'My profile',exact:true});
  await opener.click();
  await expect(page.locator('dialog.profile-panel')).toBeVisible();
  await page.getByRole('button',{name:'Close profile'}).focus();
  await page.keyboard.press('Shift+Tab');
  // Native Chromium dialogs may tab through browser chrome (activeElement=body),
  // but background page controls must stay inert while the dialog is in the top layer.
  expect(await page.locator('dialog.profile-panel').evaluate(el => el.matches(':modal'))).toBe(true);
  expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('.profile-panel'))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Close profile'})).toBeFocused();
  await page.getByRole('button',{name:'Profile settings',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.profile-panel')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.setViewportSize({width:1366,height:768});
  await expect(page.locator('aside.profile-panel')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('dialog.profile-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.profile-panel')).toHaveCount(0);
});

test('profile tabs rove and associate panels; tour links to a destination', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('tab',{name:'Overview',exact:true}).focus();
  for (const [key, name] of [['ArrowRight','Accomplishments'],['ArrowRight','Outfit'],['End','Activity'],['Home','Overview'],['ArrowLeft','Activity']]) {
    await page.keyboard.press(key);
    const tab = page.getByRole('tab',{name,exact:true});
    await expect(tab).toBeFocused();
    await expect(tab).toHaveAttribute('aria-selected','true');
    await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby',(await tab.getAttribute('id'))!);
  }
  await page.getByRole('button',{name:'Close profile'}).click();
  await page.getByRole('button',{name:'Tour',exact:false}).click();
  await page.getByRole('button',{name:'Next',exact:true}).click();
  const tour = page.getByRole('region',{name:'Village tour'});
  await expect(tour).toContainText('Goals');
  await tour.getByRole('button',{name:'Take me there'}).click();
  await expect(tour).not.toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('laptop dock clears both cards and challenge terms avoid fake ranges', async ({page}) => {
  await page.setViewportSize({width:1366,height:768});
  await page.goto('/');
  await expect(page.locator('.action-dock')).toBeVisible();
  const dock = (await page.locator('.action-dock').boundingBox())!;
  for (const selector of ['.dashboard','.neighbors-strip']) {
    const card = (await page.locator(selector).boundingBox())!;
    expect(card.y+card.height).toBeLessThan(dock.y);
  }
  await page.getByRole('button',{name:'Mayor',exact:true}).click();
  await expect(page.locator('.event-terms')).not.toContainText(['Not supplied']);
  for (const text of await page.locator('.event-terms dd').allTextContents()) expect(text).not.toMatch(/(\d+)–\1 XP/);
});
