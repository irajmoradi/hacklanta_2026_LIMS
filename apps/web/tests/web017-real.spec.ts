import { expect, test } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';

// Requires scripts/web017_preview.py: real FastAPI + disposable PostgreSQL schema.
test('real API activity persistence, nametags and shelter overview', async ({page, request}) => {
  await request.patch('http://127.0.0.1:8027/api/me', {headers:{'X-Demo-User':'13370000-0000-4000-8000-000000000001'}, data:{idle_activity:'gardening'}});
  await page.addInitScript(()=> { Date.now=()=>1800000000000; });
  await page.goto('/');
  await expect(page.getByText('Connected',{exact:true})).toBeVisible();
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Settings',exact:true});
  await expect(settings.getByLabel('Idle activity')).toHaveValue('gardening');
  await settings.getByLabel('Idle activity').selectOption('reading');
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/me')&&r.request().method()==='PATCH');
  await settings.getByRole('button',{name:'Save settings'}).click();
  expect((await saved).status()).toBe(200);
  await expect(settings.getByText('Settings saved.',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/web017/settings-real.png'});
  await page.reload();
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await expect(page.getByLabel('Idle activity')).toHaveValue('reading');
  await page.getByRole('button',{name:'Close profile'}).click();
  await page.getByRole('button',{name:'Reset camera'}).click();
  await expect(page.getByTestId('villager-Iraj').getByTestId('activity-badge')).toContainText('Reading',{timeout:90000});
  await page.screenshot({path:'test-results/web017/town-real.png'});
  const shelter=await page.evaluate(async()=> {
    const {registry}=await import('/src/scene/registry.ts' as string);
    const {createTown}=await import('/src/scene/layout/town.ts' as string);
    const town=createTown(1337,registry,[0,1,2,3,4]);
    return {center:town.lots.find((l:any)=>l.entry?.id==='pet_shelter').center,width:town.width,depth:town.depth};
  });
  const box=(await page.locator('.scene canvas').boundingBox())!;
  const camera=new OrthographicCamera(-box.width/2,box.width/2,box.height/2,-box.height/2,.1,600);
  camera.position.set(52,64,76); camera.lookAt(0,0,0);
  camera.zoom=Math.max(1.5,Math.min(box.height/Math.min(shelter.depth*.55*.9,85),box.width/Math.min(shelter.width*.55*1.12,120)));
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const point=new Vector3(shelter.center[0]*.55,0,(shelter.center[1]+3.8)*.55).project(camera);
  // Bring the yard clear of the left HUD before zooming in.
  const x=box.x+(point.x+1)*box.width/2,y=box.y+(1-point.y)*box.height/2;
  await page.mouse.move(800,450); await page.mouse.down();
  await page.mouse.move(800+720-x,450+520-y,{steps:12}); await page.mouse.up();
  await page.waitForTimeout(600);
  await page.mouse.move(720,520);
  for(let i=0;i<28;i++) { await page.mouse.wheel(0,-150); await page.waitForTimeout(50); }
  await page.waitForTimeout(1000);
  await page.screenshot({path:'test-results/web017/shelter-real.png'});
});
