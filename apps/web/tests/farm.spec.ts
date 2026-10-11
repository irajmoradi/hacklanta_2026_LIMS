import { useDemoSeat } from './demoSeat';
useDemoSeat();
import {expect,test} from '@playwright/test';

for(const offline of [false,true])test(`farm purchase creates a paddock with chicken (models offline: ${offline})`,async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  if(offline)await page.route('**/models/**',r=>r.fulfill({status:404,body:''}));
  await page.goto('/');
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  // Earn enough village XP through the mock API; no model or voice services.
  await page.evaluate(async()=>{
    const {api}=await import('/src/api/client.ts' as string);
    const village=await api.village('11111111-1111-4111-8111-111111111111');
    const profile=await api.profile(village.id,api.user);
    for(let i=0;i<25;i++)await api.checkIn(village.id,{kind:'progress',goal_id:profile.goal.id,body:'Farm test progress',idempotency_key:`farm-${i}`});
  });
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  await page.getByRole('tab',{name:'Farm Store',exact:true}).click();
  await page.getByRole('button',{name:'Buy Chicken',exact:true}).click();
  await expect(page.getByRole('region',{name:'Paddock offer'})).toBeVisible();
  await page.screenshot({path:`test-results/farm-offer-${offline?'offline':'models'}.png`});
  await page.getByRole('button',{name:'Add paddock and buy Chicken',exact:true}).click();
  await expect(page.locator('[data-item-id="chicken"]')).toContainText('Equipped');
  await page.getByRole('button',{name:'Buy Duckling',exact:true}).click();
  await expect(page.locator('[data-item-id="duckling"]')).toContainText('Equipped');
  await expect(page.getByText(/New building unlocked:/)).not.toBeVisible({timeout:15000});
  await page.screenshot({path:`test-results/farm-shop-${offline?'offline':'models'}.png`});
  await page.getByRole('button',{name:'Close dialog'}).click();
  const sceneState=await page.evaluate(async()=>{
    const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    const {scene}=_roots.get(document.querySelector('canvas')).store.getState();
    const paddock=scene.getObjectByName('paddock:00000000-0000-4000-8000-000000000001');
    const pigeons=scene.getObjectByName('fountain-pigeons');
    return {paddock:!!paddock,chicken:!!paddock?.getObjectByName('farm-animal:chicken'),duckling:!!paddock?.getObjectByName('farm-animal:duckling'),count:pigeons?.getObjectByName('pigeon-bodies').count,shadows:pigeons?.getObjectByName('pigeon-bodies').castShadow};
  });
  expect(sceneState).toEqual({paddock:true,chicken:true,duckling:true,count:8,shadows:false});
  // A visitor crossing the first bird's path makes it flutter, then return.
  await page.evaluate(async()=>{
    const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    const {scene}=_roots.get(document.querySelector('canvas')).store.getState();
    const flock=scene.getObjectByName('fountain-pigeons'),matrix=flock.getObjectByName('pigeon-bodies').instanceMatrix.array;
    const visitor=flock.clone(false);visitor.name='villager:farm-test';visitor.position.set(matrix[12],0,matrix[14]);flock.localToWorld(visitor.position);scene.add(visitor);
  });
  const flightHeight=()=>page.evaluate(async()=>{
    const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    return _roots.get(document.querySelector('canvas')).store.getState().scene.getObjectByName('pigeon-bodies').instanceMatrix.array[13];
  });
  await expect.poll(flightHeight).toBeGreaterThan(.2);
  await page.evaluate(async()=>{const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);const {scene}=_roots.get(document.querySelector('canvas')).store.getState();scene.remove(scene.getObjectByName('villager:farm-test'));});
  await expect.poll(flightHeight).toBeLessThan(.1);
  await page.screenshot({path:`test-results/farm-village-${offline?'offline':'models'}.png`});
  for(const [name,file] of [['home:00000000-0000-4000-8000-000000000001','paddock'],['fountain-pigeons','pigeons'],['unlocked:farm_store','barn']]){
    await page.evaluate(async name=>{
      const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
      const {scene,camera,controls}=_roots.get(document.querySelector('canvas')).store.getState();
      const object=scene.getObjectByName(name),center=object.position.clone();object.getWorldPosition(center);
      controls.target.copy(center);camera.position.set(center.x+9,center.y+12,center.z+16);camera.zoom=38;camera.updateProjectionMatrix();controls.update();
    },name);
    await page.waitForTimeout(500);
    await page.screenshot({path:`test-results/farm-${file}-${offline?'offline':'models'}.png`});
  }
  expect(errors).toEqual([]);
});
