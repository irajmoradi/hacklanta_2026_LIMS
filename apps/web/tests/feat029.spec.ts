import {expect, test} from '@playwright/test';
import {MockApi} from '../src/api/mock';
import {DEMO_USER_ID, DEMO_VILLAGE_ID} from '../src/api/fixtures';

test('demo default, sign in, claim, reload, settings sign out', async ({page}, info) => {
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  const mock = new MockApi();
  let claimed = false;
  const traffic: {path:string; bearer:boolean; demo:boolean}[] = [];
  await page.addInitScript(() => {
    localStorage.setItem('village:seat:live', '13370000-0000-4000-8000-000000000001');
    for (const n of [1,2]) localStorage.setItem(`village:guide:v1:13370000-0000-4000-8000-00000000000${n}`, 'seen');
  });
  await page.routeWebSocket(/\/api\//, ws => {ws.onMessage(() => {});});
  await page.route('**/api/**', async route => {
    if (!new URL(route.request().url()).pathname.startsWith('/api/')) return route.continue();
    const request = route.request(), path = new URL(request.url()).pathname.slice(4);
    const bearer = Boolean(request.headers().authorization);
    traffic.push({path,bearer,demo:Boolean(request.headers()['x-demo-user'])});
    let value: unknown;
    if (path === '/health') value = {ok:true};
    else if (path === '/auth/claim-seat') {
      expect(bearer).toBe(true);
      if (!request.postDataJSON().code.endsWith('.valid-code')) return route.fulfill({status:400,json:{detail:'Invalid or expired claim code'}});
      claimed = true; value = {user_id: DEMO_USER_ID.replace(/1$/, '2'), village_id:DEMO_VILLAGE_ID};
    } else if (path === '/me' && bearer && !claimed) value = {user:{id:'new-account',display_name:'New account'},villages:[]};
    else {
      try {
        const actor = bearer ? DEMO_USER_ID.replace(/1$/, '2') : DEMO_USER_ID;
        const input = request.postData() ? JSON.parse(request.postData()!.replaceAll('13370000','00000000')) : undefined;
        value = await mock.request(request.method(),path.replaceAll('13370000-0000-4000-8000-000000000000',DEMO_VILLAGE_ID).replaceAll('13370000','00000000')+new URL(request.url()).search,actor,input);
      } catch (e) {return route.fulfill({status:(e as {status?:number}).status || 404,json:{detail:'Synthetic unavailable'}});}
    }
    return route.fulfill({contentType:'application/json',body:JSON.stringify(value).replaceAll(DEMO_VILLAGE_ID,'13370000-0000-4000-8000-000000000000').replaceAll('00000000-0000-4000','13370000-0000-4000')});
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Testing as/})).toBeVisible();
  await page.screenshot({animations:'disabled',path:`tests/screenshots/feat029-${info.project.name}-demo.png`});
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Claim your villager'})).toBeVisible();
  await page.getByLabel('Claim code').fill(`${DEMO_VILLAGE_ID}.expired-code`);
  await page.getByRole('button',{name:'Claim villager',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Invalid or expired');
  await page.screenshot({animations:'disabled',path:`tests/screenshots/feat029-${info.project.name}-claim.png`});
  await page.getByLabel('Claim code').fill(`${DEMO_VILLAGE_ID}.valid-code`);
  await page.getByRole('button',{name:'Claim villager',exact:true}).click();
  await expect(page.getByLabel('Open Settings')).toBeVisible();
  await expect(page.getByRole('button',{name:/Testing as/})).not.toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Open Settings')).toBeVisible();
  await page.getByLabel('Open Settings').click();
  await expect(page.getByRole('dialog').getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
  await page.screenshot({animations:'disabled',path:`tests/screenshots/feat029-${info.project.name}-settings.png`});
  await page.getByRole('dialog').getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('button',{name:/Testing as/})).toBeVisible();
  expect(traffic.some(r => r.demo && !r.bearer)).toBe(true);
  expect(traffic.some(r => r.bearer)).toBe(true);
  expect(traffic.filter(r => r.bearer).every(r => !r.demo)).toBe(true);
  // A different, unlinked account can skip claims and use both onboarding paths.
  claimed = false;
  await page.evaluate(() => sessionStorage.setItem('test-auth-account', 'charlie'));
  await page.reload();
  await page.getByRole('button',{name:'No code? Create or join a village'}).click();
  await expect(page.getByLabel('Invite code')).toBeVisible();
  await page.getByRole('button',{name:'Create a new village'}).click();
  await expect(page.getByLabel('Village name')).toBeVisible();
  await expect(page.getByRole('button',{name:'Create village',exact:true})).toBeVisible();
});
