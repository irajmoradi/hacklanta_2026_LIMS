import { useDemoSeat } from './demoSeat';
useDemoSeat();
import { expect, test, type Page } from '@playwright/test';

async function houses(page: Page) {
  return page.locator('.house-nameplate').evaluateAll(nodes => nodes.slice(0,2).map(el => {
    const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
  }));
}
const separation = (p: Awaited<ReturnType<typeof houses>>) => Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);

test('own card and Settings save idle activity; disabled pet hint and live badge', async ({page}) => {
  await page.goto('/');
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  // Disable event overrides only in this mock scenario; pin the schedule in its activity phase.
  await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const get = api.village.bind(api);
    api.village = async (id: string) => ({...await get(id), active_events: []});
    Date.now = () => 1800000000000;
  });
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('tab',{name:'Outfit',exact:true}).click();
  await page.getByRole('button',{name:'Customize my avatar',exact:true}).click();
  await expect(page.getByLabel('Idle activity')).toHaveValue('home');
  await expect(page.getByLabel('Idle activity').locator('option[value="walk_pet"]')).toHaveJSProperty('disabled',true);
  await expect(page.getByText('Equip a pet in your wardrobe to choose Walking Pet.')).toBeVisible();
  await page.getByLabel('Idle activity').selectOption('reading');
  await expect(page.getByLabel('Idle activity')).toBeEnabled();
  await page.getByRole('button',{name:'Open Settings',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Settings',exact:true});
  await expect(settings.getByLabel('Idle activity')).toHaveValue('reading');
  await settings.getByLabel('Idle activity').selectOption('dancing');
  await settings.getByRole('button',{name:'Save settings'}).click();
  await expect(settings.getByText('Settings saved.',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/web017/settings-mock.png'});
  await page.getByRole('button',{name:'Close dialog'}).click();
  await expect(settings).toHaveCount(0);
  await expect(page.getByLabel('Idle activity')).toHaveValue('dancing');
  await page.getByRole('button',{name:'Close profile'}).click();
  await expect(page.getByTestId('villager-Iraj').getByTestId('activity-badge')).toContainText('Walking');
  await page.getByLabel('Play as').selectOption({label:'Lance'});
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('tab',{name:'Outfit',exact:true}).click();
  await page.getByRole('button',{name:'Customize my avatar',exact:true}).click();
  await expect(page.getByLabel('Idle activity').locator('option[value="walk_pet"]')).toHaveJSProperty('disabled',false);
  await page.getByLabel('Idle activity').selectOption('walk_pet');
  await expect(page.getByLabel('Idle activity')).toBeEnabled();
  await page.getByRole('button',{name:'Close profile'}).click();
});

test('left drag pans, wheel zooms, right drag rotates, reset and label hit testing', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.house-nameplate')).toHaveCount(5);
  const canvas=page.locator('.scene canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(800);
  await expect.poll(()=>page.locator('.scene').evaluate(scene=> {
    const houses=Array.from(scene.querySelectorAll('.house-nameplate'),el=>el.getBoundingClientRect());
    const people=Array.from(scene.querySelectorAll('.villager-label'),el=>el.getBoundingClientRect());
    return people.reduce((count,a,i)=>count+[...houses,...people.slice(0,i)].filter(b=>a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top).length,0);
  })).toBe(0);
  const before=await houses(page);
  await page.mouse.move(780,350); await page.mouse.down();
  await page.mouse.move(900,400,{steps:12}); await page.mouse.up();
  await page.waitForTimeout(600);
  const pan=await houses(page);
  expect(Math.hypot(pan[0].x-before[0].x,pan[0].y-before[0].y)).toBeGreaterThan(15);
  expect(separation(pan)).toBeCloseTo(separation(before),0);
  await expect(page.locator('.profile-panel')).toHaveCount(0);
  await page.mouse.move(800,400); for(let i=0;i<5;i++) { await page.mouse.wheel(0,-150); await page.waitForTimeout(70); }
  await expect.poll(async()=>separation(await houses(page))).toBeGreaterThan(separation(pan)*1.1);
  const zoom=await houses(page);
  await page.mouse.move(800,400); await page.mouse.down({button:'right'});
  await page.mouse.move(950,400,{steps:12}); await page.mouse.up({button:'right'});
  await page.waitForTimeout(600);
  const rotated=await houses(page);
  const slope=(p: typeof rotated)=>Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x);
  expect(Math.abs(slope(rotated)-slope(zoom))).toBeGreaterThan(.05);
  await page.getByRole('button',{name:'Reset camera'}).click();
  await expect.poll(async()=>Math.abs((await houses(page))[0].x-before[0].x)).toBeLessThan(2);
  // Move a real HTML label into clear space, as in the FIX-003 regression tests.
  const label=page.getByTestId('villager-Mario');
  await label.evaluate(el=> { const r=el.getBoundingClientRect(); el.style.position='relative'; el.style.left=`${650-r.x}px`; el.style.top=`${350-r.y}px`; });
  const box=(await label.boundingBox())!;
  await page.mouse.move(box.x+10,box.y+10); await page.mouse.down();
  await page.mouse.move(box.x+20,box.y+14,{steps:5}); await page.mouse.up();
  await expect(page.locator('.profile-panel')).toHaveCount(0);
  await label.click();
  await expect(page.locator('.profile-name h2')).toHaveText('Mario');
  await page.getByRole('button',{name:'Close profile'}).click();
  await page.screenshot({path:'test-results/web017/map-mock.png'});
});

test('touch pinch zoom and two-finger rotation preserve click selection', async ({page,context}) => {
  await page.goto('/');
  await expect(page.locator('.house-nameplate')).toHaveCount(5);
  await page.waitForTimeout(800);
  const before=await houses(page), cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const send=async(type:'touchStart'|'touchMove'|'touchEnd',points:{x:number;y:number;id:number}[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  await send('touchStart',[{x:720,y:360,id:1},{x:800,y:360,id:2}]);
  for(let i=1;i<=8;i++) await send('touchMove',[{x:720-i*5,y:360+i*2,id:1},{x:800+i*5,y:360-i*2,id:2}]);
  await send('touchEnd',[]);
  await expect.poll(async()=>separation(await houses(page))).toBeGreaterThan(separation(before)*1.1);
  const zoom=await houses(page);
  await send('touchStart',[{x:720,y:360,id:1},{x:800,y:360,id:2}]);
  for(let i=1;i<=8;i++) await send('touchMove',[{x:720+i*12,y:360,id:1},{x:800+i*12,y:360,id:2}]);
  await send('touchEnd',[]);
  const angle=(p:typeof zoom)=>Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x);
  await expect.poll(async()=>Math.abs(angle(await houses(page))-angle(zoom))).toBeGreaterThan(.05);
  await expect(page.locator('.profile-panel')).toHaveCount(0);
  await page.getByRole('button',{name:'Reset camera'}).click();
  await expect.poll(async()=>Math.abs((await houses(page))[0].x-before[0].x)).toBeLessThan(2);
});

test('zoom and repeated panning stop at town limits', async ({page}) => {
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.locator('.house-nameplate')).toHaveCount(5);
  const canvas=page.locator('.scene canvas');
  const wheel=async(delta:number,count:number)=>canvas.evaluate(async (el,{delta,count})=> {
    for(let i=0;i<count;i++) {
      el.dispatchEvent(new WheelEvent('wheel',{deltaY:delta,clientX:800,clientY:400,bubbles:true,cancelable:true}));
      await new Promise(requestAnimationFrame); // OrbitControls applies wheel deltas on a render frame.
    }
  },{delta,count});
  await wheel(-100,120); await page.waitForTimeout(500);
  const cameraState=()=>page.evaluate(async()=>{const {cameraState}=await import('/tests/web019Scene.ts' as string);return cameraState();});
  const maximum=(await cameraState()).zoom;
  await wheel(-100,20); await page.waitForTimeout(500);
  expect((await cameraState()).zoom).toBeCloseTo(maximum,3);
  await wheel(100,180); await page.waitForTimeout(500);
  const minimum=(await cameraState()).zoom;
  expect(minimum).toBeLessThan(maximum/2);
  await wheel(100,20); await page.waitForTimeout(500);
  expect((await cameraState()).zoom).toBeCloseTo(minimum,3);
  const drag=async()=> { await page.mouse.move(800,350); await page.mouse.down(); await page.mouse.move(1100,600,{steps:8}); await page.mouse.up(); await page.waitForTimeout(500); };
  for(let i=0;i<15;i++) await drag();
  const edge=(await cameraState()).target;
  await drag();
  await expect.poll(async()=>{const target=(await cameraState()).target;return Math.hypot(target[0]-edge[0],target[2]-edge[2]);}).toBeLessThan(.1);
  await expect(page.locator('.profile-panel')).toHaveCount(0);
});

test('opening a profile still focuses its avatar when the canvas resizes', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  await page.getByRole('button',{name:'Visit Mario',exact:true}).click();
  await expect(page.locator('.profile-name h2')).toHaveText('Mario');
  await expect.poll(async()=> {
    const person=(await page.getByTestId('villager-Mario').boundingBox())!;
    const canvas=(await page.locator('.scene canvas').boundingBox())!;
    return Math.abs(person.x+person.width/2-canvas.x-canvas.width/2);
  }).toBeLessThan(35);
});
