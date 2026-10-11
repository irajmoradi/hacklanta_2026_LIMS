import { test, expect, type Page } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
const own=(page:Page)=>page.locator('[data-player="true"]');
async function position(page:Page){return own(page).evaluate(el=>[Number((el as HTMLElement).dataset.x),Number((el as HTMLElement).dataset.z)]);}
async function start(page:Page){
  page.on('pageerror',error=>console.log('PAGE ERROR',error.message));
  await page.goto('/');await expect(own(page)).toBeVisible();await expect(own(page)).toHaveAttribute('data-x',/.+/);
  await page.getByRole('button',{name:'Dismiss walking hint'}).click();
  await page.getByRole('button',{name:'Collapse dashboard'}).click();
  // Deterministic availability without invoking any generation API.
  await page.evaluate(async()=>{
    const {api}=await import('/src/api/client.ts' as string);const get=api.village.bind(api);
    api.village=async(id:string)=>{const v=await get(id);return {...v,active_events:[],world:{...v.world,unlocked:[...(v.world?.unlocked??[]),'ferris_wheel'],level:99}};};
  });
}
async function hold(page:Page){
  await own(page).click({trial:true});
  const box=await own(page).boundingBox();expect(box).toBeTruthy();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();
  await expect(own(page).getByTestId('activity-badge')).toHaveText('Carrying');
}
test('keyboard moves only current seat, wave, follow, modal and input guards, resume',async({page})=>{
  await start(page);
  const before=await position(page);
  await page.keyboard.down('s');await page.waitForTimeout(900);await page.keyboard.up('s');
  const after=await position(page);expect(Math.hypot(after[0]-before[0],after[1]-before[1])).toBeGreaterThan(.5);
  await expect(own(page)).toHaveAttribute('data-controlled','true');
  await page.keyboard.press('Shift+c');await expect(own(page)).toHaveAttribute('data-follow','false');
  await page.keyboard.press('Space');await expect(own(page).getByTestId('activity-badge')).toHaveText('Waving');
  await page.screenshot({path:'artifacts/web019/keyboard-wave.png'});
  await page.getByRole('button',{name:'Open Settings',exact:true}).click();
  const still=await position(page);await page.keyboard.down('s');await page.waitForTimeout(400);await page.keyboard.up('s');
  expect(await position(page)).toEqual(still);
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByLabel('Play as').focus();await page.keyboard.press('w');expect(await position(page)).toEqual(still);
  await page.getByLabel('Play as').evaluate(el=>(el as HTMLElement).blur());
  await page.keyboard.press('f');await expect(own(page)).toHaveAttribute('data-controlled','true');
  // Fast-forward the monotonic inactivity deadline, leaving the renderer clock intact.
  await page.evaluate(()=>{const real=performance.now.bind(performance);performance.now=()=>real()+21000;});
  await expect(own(page)).toHaveAttribute('data-controlled','false');
});
test('hold own villager, drag onto wheel, parent to cabin and ride; cancel and touch pickup',async({page,context})=>{
  await start(page);
  // Wait for the normal refresh to apply the locally unlocked fixture world.
  await page.waitForTimeout(16000);
  await hold(page);
  const target=page.locator('[data-drop-target="ferris_wheel"]');await expect(target).toBeVisible();
  await page.screenshot({path:'artifacts/web019/drop-highlights.png'});
  const b=(await target.boundingBox())!;
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2+10,{steps:15});await page.mouse.up();
  await expect(own(page).getByTestId('activity-badge')).toHaveText('Riding Ferris wheel');
  await expect(own(page)).toHaveAttribute('data-parent',/^ride-cabin:/);
  const inspect=()=>page.evaluate(async()=>{const {inspectPlayer}=await import('/tests/web019Scene.ts' as string);return inspectPlayer('00000000-0000-4000-8000-000000000001');});
  const riding=await inspect();await page.waitForTimeout(2500);
  expect((await inspect()).world).not.toEqual(riding.world);
  await page.mouse.move(760,450);for(let i=0;i<12;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(40);}await page.waitForTimeout(1000);
  await page.screenshot({path:'artifacts/web019/ferris-ride.png'});
  await page.evaluate(async()=>{const {advanceRide}=await import('/tests/web019Scene.ts' as string);advanceRide(105);});
  await expect(own(page).getByTestId('activity-badge')).not.toHaveText('Riding Ferris wheel');
  await page.getByRole('button',{name:'Reset camera'}).click();await page.waitForTimeout(1000);
  await page.keyboard.press('Space');
  const origin=await position(page);await hold(page);await page.mouse.move(5,5);await page.mouse.up();
  expect(await position(page)).toEqual(origin);
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const label=(await own(page).boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:label.x+label.width/2,y:label.y+label.height/2,id:1}]});
  await expect(own(page).getByTestId('activity-badge')).toHaveText('Carrying');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(page.locator('[data-drop-target]')).toHaveCount(0);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  // Changing seats cancels ownership even when the old avatar was parented to a cabin.
  await hold(page);
  const again=(await page.locator('[data-drop-target="ferris_wheel"]').boundingBox())!;
  await page.mouse.move(again.x+again.width/2,again.y+again.height/2+10,{steps:10});await page.mouse.up();
  await expect(own(page).getByTestId('activity-badge')).toHaveText('Riding Ferris wheel');
  await page.getByLabel('Play as').selectOption({label:'Lance'});
  await expect(page.getByTestId('villager-Iraj')).not.toHaveAttribute('data-parent',/^ride-cabin:/);
  await page.getByLabel('Play as').selectOption({label:'Iraj'});
  await expect(own(page)).not.toHaveAttribute('data-parent',/^ride-cabin:/);
  await expect(own(page)).toHaveAttribute('data-controlled','false');
});
test('offline geometry still supports controls and other villagers cannot be picked up',async({page})=>{
  await page.route('**/models/**',route=>route.abort());await start(page);
  const other=page.getByTestId('villager-Mario');const b=(await other.boundingBox())!;
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(350);
  await expect(page.locator('[data-drop-target]')).toHaveCount(0);await page.mouse.up();
  const close=page.getByRole('button',{name:'Close profile'});if(await close.isVisible())await close.click();
  await page.keyboard.down('ArrowDown');await page.waitForTimeout(500);await page.keyboard.up('ArrowDown');
  await expect(own(page)).toHaveAttribute('data-controlled','true');
  await page.screenshot({path:'artifacts/web019/offline-controls.png'});
});

test('body pickup and ground drop route, temporary activities and seat changes',async({page})=>{
  await start(page);
  // Move out from the house so the body has a clear, unobstructed hit target.
  await page.keyboard.down('s');await page.waitForTimeout(1400);await page.keyboard.up('s');await page.waitForTimeout(800);
  const inspect=()=>page.evaluate(async()=>{const {inspectPlayer}=await import('/tests/web019Scene.ts' as string);return inspectPlayer('00000000-0000-4000-8000-000000000001');});
  await page.keyboard.press('Shift+c');await page.evaluate(async()=>{const {viewPlayerFromAbove}=await import('/tests/web019Scene.ts' as string);viewPlayerFromAbove('00000000-0000-4000-8000-000000000001');});await page.waitForTimeout(500);
  const body=(await inspect()).screen;await page.mouse.move(body.x,body.y);await page.mouse.down();
  await expect(own(page).getByTestId('activity-badge')).toHaveText('Carrying');
  const ground=await page.evaluate(async()=>{const {projectGround}=await import('/tests/web019Scene.ts' as string);return projectGround(0,-32);});
  await page.mouse.move(ground.x,ground.y,{steps:12});await page.mouse.up();
  await expect(own(page).getByTestId('activity-badge')).toHaveText('Walking');
  const walkingStart=await position(page);await page.waitForTimeout(500);expect(await position(page)).not.toEqual(walkingStart);
  await hold(page);
  const home=page.locator('[data-drop-target="home"]'), b=(await home.boundingBox())!;
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2+12,{steps:10});await page.mouse.up();
  await expect(own(page).getByTestId('activity-badge')).toHaveText('Go inside');
  await expect(page.locator('.interior-dialog')).toBeVisible();
  await page.getByRole('button',{name:'Back to village',exact:true}).click();
  await page.evaluate(()=>{const real=performance.now.bind(performance);performance.now=()=>real()+121000;});
  await expect(own(page)).toHaveAttribute('data-controlled','false');
  await page.getByLabel('Play as').selectOption({label:'Lance'});
  await expect(own(page)).toHaveAttribute('data-testid','villager-Lance');
  await page.getByLabel('Play as').evaluate(el=>(el as HTMLElement).blur());
  const before=await position(page);await page.keyboard.down('ArrowDown');await page.waitForTimeout(700);await page.keyboard.up('ArrowDown');
  expect(await position(page)).not.toEqual(before);
  await expect(page.getByTestId('villager-Iraj')).toHaveAttribute('data-controlled','false');
});

test('new civic drop targets preserve activities and fullscreen controls',async({page})=>{
  await start(page);
  await page.waitForTimeout(16000);
  for(const [id,label] of [['study_nook','Study'],['shop','Visit clothing shop'],['farm_store','Visit farm store'],['fitness_corner','Work out']]) {
    await hold(page);
    const target=page.locator(`[data-drop-target="${id}"]`);
    await expect(target).toBeVisible();
    const point=await page.evaluate(async id=>{const {projectBuildingGround}=await import('/tests/web019Scene.ts' as string);return projectBuildingGround(id);},id);
    await page.mouse.move(point.x,point.y,{steps:12});await page.mouse.up();
    if(id==='shop' || id==='farm_store') {
      await expect(page.getByTestId('shop-interior')).toBeVisible();
      await expect(page.getByTestId('shop-interior')).toHaveAttribute('data-department',id==='shop'?'general':'farm');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('shop-interior')).not.toBeVisible();
    }
    await expect(own(page).getByTestId('activity-badge')).toHaveText(label);
    await page.screenshot({path:`artifacts/integ011/drop-${id}.png`});
    await page.keyboard.press('Shift+c');
    await page.getByRole('button',{name:'Reset camera'}).click();await page.waitForTimeout(500);
    // Leave the dropped activity and keep the overview fixed for the next pickup.
    await page.keyboard.press('Space');
    if(await own(page).getAttribute('data-follow')==='true')await page.keyboard.press('Shift+c');
  }
  await page.keyboard.press('f');await expect(page.locator('.app')).toHaveClass(/clean-view/);
  await page.keyboard.press('Escape');await expect(page.locator('.app')).not.toHaveClass(/clean-view/);
  await page.keyboard.press('Shift+c');await expect(own(page)).toHaveAttribute('data-follow','true');
});
