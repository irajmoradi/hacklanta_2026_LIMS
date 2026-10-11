import { expect, test } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
for (const width of [1440,1280,390]) test(`header and members at ${width}px`, async ({page}) => {
 await page.setViewportSize({width,height:900}); await page.goto('/');
 await expect(page.getByRole('button',{name:'My profile',exact:true})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Play as'})).toHaveCount(0);
 await expect(page.locator('.mode-badge')).toHaveCount(0);
 const order = await page.locator('.topbar-right > button').evaluateAll(nodes => nodes.map(n => n.textContent || n.getAttribute('aria-label')));
 expect(order.join('|')).toMatch(/Testing as.*AI at work.*Help.*Inbox.*Settings/);
 const header = await page.locator('.topbar').boundingBox();
 const utilities = await page.locator('.topbar-utilities').boundingBox();
 expect(utilities!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
 if (width > 700) {
  const buttons = await page.locator('.topbar-right > button:not(.demo-debug-toggle)').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().x));
  expect(buttons).toEqual([...buttons].sort((a,b)=>a-b));
 }
 await page.screenshot({path:`artifacts/web051/${width}.png`});
 const sound=page.getByRole('button',{name:'Sound',exact:true});
 const pressed=await sound.getAttribute('aria-pressed'); await sound.click();
 await expect(sound).toHaveAttribute('aria-pressed',pressed==='true'?'false':'true');
 await page.reload(); await expect(sound).toHaveAttribute('aria-pressed',pressed==='true'?'false':'true');
 await page.getByRole('button',{name:/Testing as/}).click();
 await expect(page.getByRole('dialog',{name:'Who are you testing as?'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog',{name:'Who are you testing as?'})).toHaveCount(0);
 const strip=page.getByRole('button',{name:'Members, 5 neighbors'}); await strip.focus(); await page.keyboard.press('Enter');
 const members=page.getByRole('dialog',{name:'Members',exact:true}); await expect(members).toBeVisible();
 await expect(members.locator('li')).toHaveCount(5); await expect(members).toContainText('Level');
 await members.getByRole('button',{name:/Stefanny/}).click(); await expect(page.locator('.profile-panel')).toBeVisible();
 await page.reload();
 await page.getByRole('button',{name:'Create new village',exact:true}).click();
 await page.getByLabel('Village name',{exact:true}).fill(`WEB-051 ${width}`);
 await page.getByRole('button',{name:'Create village',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Create new village',exact:true})).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Village',exact:true}).locator('option:checked')).toHaveText(`WEB-051 ${width}`);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('conveyor, reduced motion and reconnect notifications',async ({page}) => {
 await page.goto('/'); await expect(page.getByRole('button',{name:'My profile',exact:true})).toBeVisible();
 await page.evaluate(async () => {
  const {api}=await import('/src/api/client.ts' as string);
  // The hover check needs the village, not the newly selected seat's first-visit guide.
  localStorage.setItem('village:guide:v1:00000000-0000-4000-8000-000000000002','seen');
  const request=api.request.bind(api);
  api.request=async (method:string,path:string,body:unknown) => {
   const result=await request(method,path,body);
   if(method==='GET' && /\/villages\/[^/]+$/.test(path)) {
    result.villagers.push({...result.villagers[0],user_id:'extra-member',display_name:'Extra neighbor'});
   }
   return result;
  };
 });
 // Switching seats refreshes the world through the existing mock API.
 await page.getByRole('button',{name:/Testing as/}).click();
 await page.getByRole('dialog',{name:'Who are you testing as?'}).getByRole('button',{name:/Lance/}).click();
 const strip=page.getByRole('button',{name:'Members, 6 neighbors'}); await expect(strip).toBeVisible();
 const belt=strip.locator('.neighbor-belt'); await expect(belt).toHaveCSS('animation-name','neighbors-conveyor');
 await strip.hover(); await expect(belt).toHaveCSS('animation-play-state','paused');
 await page.mouse.move(0,0); await strip.focus(); await expect(belt).toHaveCSS('animation-play-state','paused');
 await page.emulateMedia({reducedMotion:'reduce'}); await expect(belt).toHaveCSS('animation-name','none');
 await expect(strip.locator('.neighbor-more')).toHaveText('+1');
 await page.screenshot({path:'artifacts/web051/reduced-motion.png'});
 await page.evaluate(async () => {const {connection}=await import('/src/api/retry.ts' as string);connection.set(true);});
 await expect(page.getByText('Reconnecting…',{exact:true})).toBeVisible();
 await page.evaluate(async () => {const {connection}=await import('/src/api/retry.ts' as string);connection.set(false);});
 await expect(page.getByText('Reconnecting…',{exact:true})).toHaveCount(0);
});

test('creation errors retain the name and retry does not create twice', async ({page}) => {
 await page.goto('/'); await expect(page.getByRole('button',{name:'Create new village',exact:true})).toBeVisible();
 await page.evaluate(async () => {
  const {api}=await import('/src/api/client.ts' as string);
  const create=api.createVillage.bind(api), me=api.me.bind(api);
  let creates=0, failMe=false;
  api.createVillage=async (name:string) => { creates++; if(creates===1) throw new Error('Please try creation again'); const result=await create(name); failMe=true; return result; };
  api.me=async () => {if(failMe){failMe=false;throw new Error('Please retry opening');} return me();};
  (window as any).creationCount=()=>creates;
 });
 await page.getByRole('button',{name:'Create new village',exact:true}).click();
 await page.getByLabel('Village name',{exact:true}).fill('Retry village');
 await page.getByRole('button',{name:'Create village',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Create new village',exact:true}).getByRole('alert')).toContainText('Please try creation again');
 await expect(page.getByLabel('Village name',{exact:true})).toHaveValue('Retry village');
 await page.getByRole('button',{name:'Create village',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Create new village',exact:true}).getByRole('alert')).toContainText('Please retry opening');
 await page.getByRole('button',{name:'Retry opening village',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Village',exact:true}).locator('option:checked')).toHaveText('Retry village');
 expect(await page.evaluate(()=>(window as any).creationCount())).toBe(2);
});
