import { expect, test } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat(true);

test('first-run guide, friends actions and accomplishment navigation', async ({page}, info) => {
  test.setTimeout(120000);
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  const guide = page.getByRole('dialog',{name:'What can I do here?'});
  await expect(guide).toBeVisible();
  await expect(guide.locator('.guide-card')).toHaveCount(9);
  await page.screenshot({animations:'disabled',path:`artifacts/web046/${info.project.name}-guide.png`});
  await guide.getByRole('button',{name:'Take me to Friends',exact:true}).click();
  const friends=page.getByRole('dialog',{name:'Friends',exact:true});
  await expect(friends.locator('.friend-card')).toHaveCount(4);
  const card=friends.getByRole('article',{name:'Lance',exact:true});
  await expect(card).toContainText('day streak');
  await card.getByRole('button',{name:'Cheer',exact:true}).click();
  await expect(card.getByRole('status')).toHaveText('Cheer sent!');
  if (await card.getByRole('button',{name:'Send a wave',exact:true}).isVisible()) {
    await card.getByRole('button',{name:'Send a wave',exact:true}).click();
    await expect(card.getByRole('status')).toHaveText('Wave sent!');
  }
  await page.screenshot({animations:'disabled',path:`artifacts/web046/${info.project.name}-friends.png`});
  await card.getByRole('button',{name:'See their accomplishments'}).click();
  await expect(page.getByRole('tab',{name:'Accomplishments',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tab',{name:'Accomplishments',exact:true})).toBeInViewport();
  await page.getByRole('tab',{name:'Accomplishments',exact:true}).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab',{name:'Activity',exact:true})).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab',{name:'Overview',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'Accomplishments',exact:true})).toBeFocused();
  await expect(page.locator('.profile-panel')).toBeInViewport();
  await expect(page.getByRole('tabpanel')).toBeInViewport();
  await page.screenshot({animations:'disabled',path:`artifacts/web046/${info.project.name}-accomplishments.png`});
  await page.getByRole('button',{name:'Close profile',exact:true}).click();
  await page.locator('body').click({position:{x:2,y:2}});
  await page.keyboard.press('b');
  await expect(friends).toBeVisible();
  await friends.getByRole('article',{name:'Lance',exact:true}).getByRole('button',{name:'Message',exact:true}).click();
  await expect(page.getByLabel('Your message', {exact:true})).toBeVisible();
  await page.getByLabel('Your message', {exact:true}).fill('Great work today!');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.getByText('Great work today!',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'What can I do here?',exact:true}).click();
  await guide.getByRole('button',{name:'Take me to Friends',exact:true}).click();
  await friends.getByRole('article',{name:'Lance',exact:true}).getByRole('button',{name:'Visit house'}).click();
  await expect(page.getByRole('tab',{name:'House',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'Close profile',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'My profile',exact:true})).toBeVisible();
  await expect(guide).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('challenge opens create and refreshed activity offers a single cheer', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Take me to Friends',exact:true}).click();
  await page.getByRole('article',{name:'Lance',exact:true}).getByRole('button',{name:'Challenge',exact:true}).click();
  await expect(page.locator('input[value="Challenge with Lance"]')).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Friendly mode',exact:false})).toBeChecked();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Close competitions',exact:true}).click();
  await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const original = api.feed.bind(api);
    api.feed = async (vid: string) => [{id:'web046-fresh',user_id:'00000000-0000-4000-8000-000000000002',type:'checkin',text:'A new update',created_at:new Date().toISOString(),payload:{}}, ...await original(vid)];
  });
  await expect(page.getByRole('button',{name:'Cheer',exact:true})).toBeVisible({timeout:25000});
  await page.getByRole('button',{name:'Cheer',exact:true}).click();
  await expect(page.getByText('Cheer sent!',{exact:true})).toBeVisible();
});

test('partial friend failure retries; tour covers each place; library leads to settings', async ({page}) => {
  await page.goto('/');
  const guide=page.getByRole('dialog',{name:'What can I do here?'});
  await expect(guide).toBeVisible();
  await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const original = api.profile.bind(api);
    (window as any).__web046RestoreProfile = () => {api.profile = original;};
    api.profile = async (vid:string, uid:string) => {
      if (uid.endsWith('002')) throw new Error('Synthetic offline friend');
      return original(vid,uid);
    };
  });
  await guide.getByRole('button',{name:'Take me to Friends',exact:true}).click();
  const friends=page.getByRole('dialog',{name:'Friends',exact:true});
  await expect(friends.getByRole('alert')).toContainText('Some friend updates could not load');
  await expect(friends.locator('.friend-card')).toHaveCount(3);
  await page.evaluate(() => {
    const restore = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('button')?.textContent?.trim() !== 'Retry friends') return;
      document.removeEventListener('click', restore, true);
      (window as any).__web046RestoreProfile();
    };
    document.addEventListener('click', restore, true);
  });
  await friends.getByRole('button',{name:'Retry friends'}).click();
  await expect(friends.locator('.friend-card')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'What can I do here?',exact:true}).click();
  await guide.getByRole('button',{name:'Start the tour'}).click();
  const tour=page.getByRole('region',{name:'Village tour'});
  for (const title of ['Check in','Goals','Friends','Accomplishments','Shop','Houses','Mayor','Colosseum','Library']) {
    await expect(tour.getByRole('heading',{name:title,exact:true})).toBeVisible();
    if (title !== 'Library') await tour.getByRole('button',{name:'Next',exact:true}).click();
  }
  await tour.getByRole('button',{name:'Take me there'}).click();
  await expect(page.getByRole('combobox',{name:'Idle activity'})).toBeVisible();
});
