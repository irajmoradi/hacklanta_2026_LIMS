import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';
import {useDemoSeat} from './demoSeat';
useDemoSeat();
test.beforeEach(async({page})=>{
  // External font readiness must not stall screenshots in isolated CI.
  await page.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.abort());
});
async function ready(page:import('@playwright/test').Page){
  await page.goto('/');
  await expect(page.getByTestId('village-scene')).toHaveAttribute('data-ready','true');
  await page.evaluate(async()=>{ (await import('/tests/web040Scene.ts' as string)).lowerRenderCost(); });
}
for (const width of [1280,390]) test(`committed dialogue, focus, photo and send at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:844});
  if(width===390) await page.emulateMedia({reducedMotion:'reduce'});
  await ready(page);
  await page.getByRole('button',{name:'Check in',exact:true}).click();
  const scene=page.getByRole('dialog',{name:'A moment with your villager'});
  await expect(scene.getByRole('button',{name:/Daily note/})).toBeFocused();
  await expect(scene.locator('.scene-speech > span').first()).toHaveText('What did I do today?');
  await page.screenshot({path:`artifacts/web040/choices-${width}.png`});
  await page.keyboard.press('1');
  await expect(scene.getByRole('heading',{name:'Daily note',exact:true})).toBeVisible();
  await expect(scene.getByRole('button',{name:/Goal progress/})).toHaveCount(0);
  await expect(scene.getByRole('textbox')).toBeFocused();
  await expect(scene.getByRole('button',{name:'Share check-in',exact:true})).toBeDisabled();
  await expect(scene.getByText('Write a little note to share your check-in.')).toBeVisible();
  await scene.getByRole('textbox').fill('123456: A small step today.');
  await expect(scene.getByRole('heading',{name:'Daily note',exact:true})).toBeVisible();
  await expect(scene.locator('.checkin-letter')).toHaveCSS('opacity','1');
  await expect(scene.locator('.checkin-send')).toHaveCSS('background-color','rgb(36, 86, 78)');
  await page.screenshot({path:`artifacts/web040/note-${width}.png`});
  const accessibility=await new AxeBuilder({page}).include('.checkin-scene').analyze();
  expect(accessibility.violations).toEqual([]);
  await scene.getByRole('button',{name:'Close dialog',exact:true}).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(scene.getByRole('button',{name:'Share check-in',exact:true})).toBeFocused();
  for(let i=0;i<8;i++){
    await page.keyboard.press('Tab');
    expect(await scene.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  }
  if(width===390) expect(await scene.locator('.checkin-letter').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await scene.getByRole('button',{name:/choose again/}).click();
  await expect(scene.getByRole('button',{name:/Daily note/})).toBeFocused();
  await scene.getByRole('button',{name:/Goal progress/}).click();
  await expect(scene.getByRole('heading',{name:'Goal progress',exact:true})).toBeVisible();
  await expect(scene.getByRole('button',{name:/Daily note/})).toHaveCount(0);
  await scene.getByRole('button',{name:/choose again/}).click();
  await page.keyboard.press('1');
  await expect(scene.getByRole('textbox')).toBeFocused();
  await scene.getByRole('button',{name:'Take a photo',exact:true}).click();
  const camera=page.getByRole('dialog',{name:'Take a photo',exact:true});
  await expect(camera).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(camera).toHaveCount(0);
  await expect(scene).toBeVisible();
  await scene.getByLabel('Upload evidence photo').setInputFiles({name:'wrong.txt',mimeType:'text/plain',buffer:Buffer.from('no')});
  await expect(scene.getByRole('alert')).toContainText('Choose a JPG');
  await scene.getByLabel('Upload evidence photo').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5FoAAAAASUVORK5CYII=','base64')});
  await scene.getByRole('textbox').fill('A photo from my day.');
  expect(await scene.locator('.scene-conversation').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await page.screenshot({path:`artifacts/web040/proof-${width}.png`});
  await scene.getByRole('button',{name:'Share check-in',exact:true}).click();
  await expect(scene.getByText('Shared with the village',{exact:true})).toBeVisible();
  await page.screenshot({path:`artifacts/web040/shared-${width}.png`});
  await expect(scene).toHaveCount(0);
  await page.getByRole('button',{name:'Check in',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(scene).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Check in',exact:true})).toBeFocused();
});

test('failed save keeps text, photo upload and idempotency key for retry',async({page})=>{
  await ready(page);
  await page.evaluate(async()=>{
    const {api}=await import('/src/api/client.ts' as string);
    const original=api.checkIn.bind(api);
    (window as any).__attempts=[];
    (window as any).__uploads=0;
    const evidence=api.evidence.bind(api);
    api.evidence=async(...args:any[])=>{ (window as any).__uploads++; return evidence(...args); };
    api.checkIn=async (...args:any[])=>{
      (window as any).__attempts.push(args);
      if((window as any).__attempts.length===1) throw new Error('Synthetic offline failure');
      return original(...args);
    };
  });
  await page.getByRole('button',{name:'Check in',exact:true}).click();
  await page.getByRole('button',{name:/Daily note/}).click();
  await page.getByRole('textbox').fill('Keep this note for retry.');
  await page.getByLabel('Upload evidence photo').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5FoAAAAASUVORK5CYII=','base64')});
  await page.getByRole('button',{name:'Share check-in',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic offline failure');
  await expect(page.getByRole('textbox')).toHaveValue('Keep this note for retry.');
  await page.getByRole('button',{name:'Retry check-in',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const attempts=await page.evaluate(()=>(window as any).__attempts);
  expect(await page.evaluate(()=>(window as any).__uploads)).toBe(1);
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
});

test('stretch branch retains its tier, Go beyond and Mayor navigation',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await ready(page);
  await page.getByRole('button',{name:'My goal',exact:true}).click();
  await page.getByRole('button',{name:'Mark goal done',exact:true}).click();
  await page.getByLabel('Stretch target (optional)').fill('One more lap');
  await page.getByRole('button',{name:/Go beyond/}).click();
  await expect(page.getByLabel('Goal journey')).toContainText('Stretch 1: One more lap');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Check in',exact:true}).click();
  await page.getByRole('button',{name:/Goal progress/}).click();
  await expect(page.getByRole('dialog')).toContainText('Stretch 1: One more lap');
  await page.getByRole('textbox').fill('Made it around the lake.');
  await page.getByRole('button',{name:'Share check-in',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved=await page.evaluate(async()=>{
    const {api}=await import('/src/api/client.ts' as string);
    const {villages}=await api.me();
    return (await api.profile(villages[0].id,api.user)).check_ins[0];
  });
  expect(saved.kind).toBe('progress');
  expect(saved.stretch_tier).toBe(1);
  await page.getByRole('button',{name:'My goal',exact:true}).click();
  await page.getByRole('button',{name:/Finish stretch 1/}).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Check in',exact:true}).click();
  await expect(page.getByRole('button',{name:/Goal progress/})).toBeDisabled();
  await expect(page.getByText('Set an active weekly goal to share goal progress.')).toBeVisible();
  await page.getByRole('button',{name:/Go beyond/}).click();
  await expect(page.getByRole('dialog',{name:'My goal',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Mayor',exact:true}).click();
  const mayor=page.getByRole('dialog',{name:'A visit to the Mayor'});
  for(let n=0;n<6;n++){
    await mayor.locator('.mayor-menu>button').nth(n).click();
    await expect(mayor.getByRole('button',{name:/Back/,exact:false})).toBeVisible();
    await mayor.getByRole('button',{name:/Back/,exact:false}).click();
    await expect(mayor.locator('.mayor-menu>button')).toHaveCount(6);
  }
  await page.keyboard.press('Escape');
  await expect(mayor).toHaveCount(0);
});
