import { expect, test, type Page } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
async function choose(page: Page, activity: string) {
  await page.getByRole('button',{name:'Open Settings',exact:true}).click();
  await page.getByLabel('Idle activity').selectOption(activity);
  await page.getByRole('button',{name:'Save settings'}).click();
  await expect(page.getByText('Settings saved.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Dismiss Settings saved.',exact:true}).click();
  await expect(page.getByText('Settings saved.',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Close dialog'}).click();
}

for (const fallback of [false,true]) test(`gaming and workouts (${fallback ? 'fallback' : 'models'})`, async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', {get:()=>2}));
  if (fallback) await page.route('**/models/*.glb*',r=>r.fulfill({status:404,body:''}));
  await page.goto('/');
  const me = page.getByTestId('villager-Iraj');
  await expect(me).toBeVisible();
  await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const get = api.village.bind(api);
    api.village = async (id: string) => {const v=await get(id);return {...v,active_events:[],world:{...v.world,weather:'clear',time_of_day:22}};};
    Date.now = () => 1800000000000;
  });
  await page.getByRole('button',{name:'Open Settings',exact:true}).click();
  await page.getByLabel('Idle activity').selectOption('gaming');
  await page.getByRole('button',{name:'Save settings'}).click();
  await expect(page.getByText('Settings saved.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Dismiss Settings saved.',exact:true}).click();
  await expect(page.getByText('Settings saved.',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Close dialog'}).click();
  await expect(me.getByTestId('activity-badge')).toContainText('Gaming');
  await expect(me).toHaveAttribute('data-avatar-hidden','true');
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.waitForTimeout(2500);
  await page.getByRole('button',{name:'Close profile'}).click();
  await page.mouse.move(720,520); for (let i=0;i<30;i++) { await page.mouse.wheel(0,-150); await page.waitForTimeout(30); } await page.waitForTimeout(1500);
  await page.screenshot({path:`test-results/web024/gaming-${fallback?'fallback':'models'}.png`});
  await choose(page,'home');
  await expect(me).toHaveAttribute('data-avatar-hidden','false');
  await expect(me.getByTestId('activity-badge')).toContainText('Chilling at Home');
  await choose(page,'working_out');
  await page.mouse.move(0,0);
  await expect(me.getByTestId('activity-badge')).toContainText('Working out',{timeout:180000});
  await expect(page.getByTestId('fitness-corner')).toBeAttached();
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.waitForTimeout(3000);
  await page.getByRole('button',{name:'Close profile'}).click();
  await page.waitForTimeout(1000);
  await page.screenshot({path:`test-results/web024/workout-${fallback?'fallback':'models'}.png`});
});

for (const goal of [null,'done']) test(`goal hint (${goal ?? 'missing'}) and Settings shortcuts`, async ({page}) => {
  await page.goto('/'); await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await page.evaluate(async (goal) => {
    const {api} = await import('/src/api/client.ts' as string);
    const get = api.profile.bind(api);
    api.profile = async (...args: any[]) => {const p=await get(...args);return {...p,goal:goal ? {...p.goal,status:goal} : null};};
    const request = api.request.bind(api);
    api.request = async (method: string,path: string,...rest: any[]) => path.endsWith('/villagergrams/options') ? {members:[]} : request(method,path,...rest);
  },goal);
  await choose(page,'gaming');
  await page.getByRole('button',{name:'Check in',exact:true}).click();
  await expect(page.getByRole('button',{name:/Goal progress/})).toBeDisabled();
  await expect(page.getByText('Set an active weekly goal to share goal progress.',{exact:false})).toBeVisible();
  await page.screenshot({path:`test-results/web024/goal-${goal ?? 'missing'}.png`});
  await page.getByRole('button',{name:goal ? /Go beyond/ : 'Set a weekly goal'}).click();
  await expect(page.getByRole('dialog',{name:'My goal',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  await page.getByText('Photo gifts & villager-grams',{exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Open Settings',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toBeVisible();
});
