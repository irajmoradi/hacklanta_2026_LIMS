import { test, expect, type Page } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
const shots = 'tests/screenshots/FEAT-016';
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('village-scene')).toHaveAttribute('data-ready','true');
  // Allow the established town/arena idle prewarm to finish before measuring transitions.
  await page.waitForTimeout(4000);
}
test('check-in scene, daily note, cheer and return to town', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  // Load the rig inspector before the short cheer, so Vite compilation isn't in its timing window.
  await page.evaluate(async () => { (window as any).__scenePose = (await import('/tests/fix010Scene.ts' as string)).inspect; });
  await page.locator('body').click({position:{x:4,y:4}});
  await page.keyboard.press('c');
  const scene = page.getByRole('dialog', {name:'A moment with your villager'});
  await expect(scene).toBeVisible();
  await expect(scene.locator('.scene-speech')).toHaveAttribute('aria-label','What did I do today?');
  await expect(page.locator('#checkin-body')).toHaveCount(0);
  await page.waitForTimeout(600);
  await page.screenshot({path:`${shots}/checkin-desktop.png`});
  await page.keyboard.press('1');
  await page.locator('#checkin-body').fill('Today I made a little room for my village.');
  await page.screenshot({path:`${shots}/checkin-form.png`});
  await page.getByRole('button',{name:'Share check-in',exact:true}).click();
  await expect(page.getByTestId('scene-reward')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const pose = (window as any).__scenePose();
    return pose.hand[1] > pose.head[1] && pose.left[1] > pose.head[1];
  }), {timeout:1200,intervals:[50]}).toBe(true);
  await page.screenshot({path:`${shots}/checkin-cheer.png`});
  await expect(scene).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Check in',exact:true})).toBeVisible();
  const saved = await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const {villages} = await api.me();
    return (await api.profile(villages[0].id,api.user)).check_ins;
  });
  expect(saved.filter((c: {body:string}) => c.body === 'Today I made a little room for my village.')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('missing models and inactive goals retain an accessible check-in flow', async ({page}) => {
  await page.route('**/models/*.glb*',route => route.fulfill({status:404,body:''}));
  await ready(page);
  // Mutate only the in-memory mock fixture, then let the existing refresh see it.
  await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const {villages} = await api.me();
    const profile = await api.profile(villages[0].id,api.user);
    await api.goalStatus(villages[0].id,profile.goal.id,'done');
  });
  await page.waitForTimeout(16000);
  await page.getByRole('button',{name:'Check in',exact:true}).click();
  const scene = page.getByRole('dialog',{name:'A moment with your villager'});
  await expect(scene.getByRole('button',{name:/Goal progress/})).toBeDisabled();
  await expect(scene.getByText('Set an active weekly goal to share goal progress.')).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.locator('#checkin-body')).toHaveCount(0);
  await scene.getByRole('button',{name:/Daily note/}).click();
  await expect(page.locator('#checkin-body')).toBeVisible();
  await page.screenshot({path:`${shots}/missing-models.png`});
  await page.keyboard.press('Escape');
  await expect(scene).toHaveCount(0);
});

test('Mayor all six choices, back and Escape', async ({page}) => {
  await ready(page);
  await page.getByRole('button',{name:'Mayor',exact:true}).click();
  const scene = page.getByRole('dialog',{name:'A visit to the Mayor'});
  await expect(scene).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({path:`${shots}/mayor-desktop.png`});
  for (let choice=1; choice<=6; choice++) {
    await scene.locator('.mayor-menu button').nth(choice-1).focus();
    await page.keyboard.press(String(choice));
    if (choice === 1) await expect(scene.locator('.scene-speech')).toHaveAttribute('aria-label',/The weekly goals are in/);
    if (choice === 2) await expect(scene.getByRole('region', {name:'Village health dashboard'})).toBeVisible();
    if (choice === 3) {
      await expect(scene.getByLabel('Pray to the Mayor')).toBeVisible();
      await scene.getByLabel('Pray to the Mayor').fill('A little encouragement for the week.');
      await scene.getByRole('button',{name:'Send wish'}).click();
      await expect(scene.locator('.mayor-response')).toContainText('Request received');
    }
    if (choice === 4) await expect(scene.getByRole('button',{name:'Visit the Colosseum challenges'})).toBeVisible();
    if (choice === 5) await expect(scene.getByLabel('Your wish')).toBeVisible();
    if (choice === 6) await expect(scene.locator('.mayor-rumour')).toContainText('noticeboard');
    await expect(scene.locator('.scene-speech > span').first()).toHaveText(await scene.locator('.scene-speech').getAttribute('aria-label') ?? '');
    await page.screenshot({path:`${shots}/mayor-choice-${choice}.png`});
    await scene.getByRole('button',{name:'← Back',exact:true}).click();
    await expect(scene.locator('.mayor-menu button')).toHaveCount(6);
  }
  await page.keyboard.press('Escape');
  await expect(scene).toHaveCount(0);
});

test('mobile reduced motion, proof, goal selection and keyboard isolation', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await page.emulateMedia({reducedMotion:'reduce'});
  await ready(page);
  await page.getByRole('button',{name:'Check in',exact:true}).click();
  const scene = page.getByRole('dialog',{name:'A moment with your villager'});
  await page.screenshot({path:`${shots}/checkin-mobile.png`});
  const progress = scene.getByRole('button',{name:/Goal progress/});
  if (await progress.isDisabled()) await expect(scene.getByText('Set an active weekly goal')).toBeVisible();
  else {
    await progress.click();
    await expect(scene.getByRole('heading', {name:'Goal progress',exact:true})).toBeVisible();
    await scene.getByRole('button',{name:'← choose again',exact:true}).click();
  }
  await scene.getByRole('button',{name:/Daily note/}).click();
  await expect(scene.getByRole('textbox')).toBeFocused();
  await page.locator('#checkin-body').fill('123456');
  await expect(page.locator('#checkin-body')).toHaveValue('123456');
  await page.screenshot({path:`${shots}/proof-mobile.png`});
  await page.keyboard.press('Escape'); await expect(scene).toHaveCount(0);
  await page.getByRole('button',{name:'Mayor',exact:true}).click();
  await page.screenshot({path:`${shots}/mayor-mobile.png`});
  expect(await page.locator('.mayor-conversation').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
});
