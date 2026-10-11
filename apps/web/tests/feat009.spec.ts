import { useDemoSeat } from './demoSeat';
useDemoSeat();
import { expect, test } from '@playwright/test';

for (const fallback of [false, true]) test(`Studying seats friends together (${fallback ? 'offline models' : 'GLB'})`, async ({page}) => {
  test.setTimeout(240000);
  if (fallback) await page.route('**/models/*.glb*', route => route.fulfill({status:404,body:''}));
  await page.goto('/');
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const get = api.village.bind(api);
    api.village = async (id: string) => {
      const v = await get(id);
      return {...v, active_events:[], world:{...v.world,weather:'clear',time_of_day:12},
        villagers:v.villagers.map((p: any) => p.house_slot === 1 ? {...p,idle_activity:'studying'} : p)};
    };
    Date.now = () => 1800000000000;
  });
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('tab',{name:'Outfit',exact:true}).click();
  await page.getByRole('button',{name:'Customize my avatar',exact:true}).click();
  await page.getByLabel('Idle activity').selectOption('studying');
  await expect(page.getByLabel('Idle activity')).toBeEnabled();
  await page.getByRole('button',{name:'Close profile'}).click();
  await page.mouse.move(0,0);
  const me = page.getByTestId('villager-Iraj');
  await expect(me.getByTestId('activity-badge')).toContainText('Studying',{timeout:180000});
  await expect(me).toHaveAttribute('data-study-seat','0');
  await expect(page.locator('[data-study-seat="1"]')).toHaveCount(1,{timeout:180000});
  await expect(page.getByTestId('study-spot')).toBeAttached();
  // Real browser captures of both lighting modes, focused using the existing profile camera.
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('tab',{name:'Outfit',exact:true}).click();
  await page.getByRole('button',{name:'Customize my avatar',exact:true}).click();
  await page.waitForTimeout(1500);
  await page.screenshot({path:`test-results/feat009/day-${fallback?'fallback':'glb'}.png`});
  await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const get = api.village.bind(api);
    api.village = async (id: string) => {const v=await get(id);return {...v,world:{...v.world,time_of_day:22}};};
    await api.updateSettings({idle_activity:'studying'});
  });
  // Saving through the picker refreshes the village with the night world.
  await page.getByLabel('Idle activity').selectOption('home');
  await expect(page.getByLabel('Idle activity')).toBeEnabled();
  await page.getByLabel('Idle activity').selectOption('studying');
  await expect(page.getByLabel('Idle activity')).toBeEnabled();
  await page.waitForTimeout(1500);
  await page.screenshot({path:`test-results/feat009/night-${fallback?'fallback':'glb'}.png`});
});
