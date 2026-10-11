import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';

test.beforeAll(()=>execFileSync('../api/.venv/bin/python',['../api/tests/seed_interior_walk.py']));

const owner='13370000-0000-4000-8000-000000000001';
const visitor='13370000-0000-4000-8000-000000000002';
test('two independent visitors see walking, stairs, late join and departure',async({browser})=>{
  const a=await browser.newContext({baseURL:'http://127.0.0.1:5188',viewport:{width:1440,height:1000},recordVideo:{dir:'tests/artifacts/feat022'}});
  const b=await browser.newContext({baseURL:'http://127.0.0.1:5188',viewport:{width:1440,height:1000}});
  const page=await a.newPage(), peer=await b.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));peer.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(`/interior-preview.html?hall=1&seat=${owner}`);
    await expect(page.getByRole('status')).toContainText('changes saved');
    const room=page.getByLabel('Walk around the room',{exact:true});
    await room.focus();await page.keyboard.down('w');await page.waitForTimeout(450);await page.keyboard.up('w');
    await peer.goto(`/interior-preview.html?hall=1&seat=${visitor}`);
    await expect(peer.getByRole('status')).toContainText('changes saved');
    const remote=peer.getByTestId(`interior-avatar-${owner}`);
    await expect(remote).toBeVisible();
    await expect.poll(async()=>Number(await remote.getAttribute('data-z'))).toBeLessThan(3);
    await room.focus();await page.keyboard.down('a');
    await expect(remote).toHaveAttribute('data-moving','true');
    await page.keyboard.up('a');
    await page.getByRole('button',{name:'Upstairs',exact:true}).click();
    await expect(page.getByRole('tab',{name:'Floor 2',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(remote).toHaveCount(0);
    await expect(peer.locator('.interior-peer').filter({hasText:'Floor 2'})).toHaveCount(1);
    await peer.getByRole('tab',{name:'Floor 2',exact:true}).click();
    await expect(remote).toBeVisible();
    await expect(remote).toHaveAttribute('data-floor','1');
    await expect(peer.locator('.interior-peer').filter({hasText:'Lance'})).toContainText('Floor 2');
    // Walk away from the shared entrance by clicking the actual room floor.
    const canvas=peer.getByLabel('Walk around the room',{exact:true}).locator('canvas');
    const box=(await canvas.boundingBox())!;
    await canvas.click({position:{x:box.width*.55,y:box.height*.55}});
    const visitorAvatar=peer.getByTestId(`interior-avatar-${visitor}`);
    await expect.poll(async()=>Number(await visitorAvatar.getAttribute('data-z'))).toBeLessThan(2.5);
    await expect(visitorAvatar).toHaveAttribute('data-moving','false');
    await expect(page.getByTestId(`interior-avatar-${visitor}`)).toHaveAttribute('data-moving','false');
    await page.screenshot({path:'tests/artifacts/feat022/upstairs.png'});
    await peer.screenshot({path:'tests/artifacts/feat022/peer-upstairs.png'});
    await page.getByRole('button',{name:'Decorate',exact:true}).click();
    const self=page.getByTestId(`interior-avatar-${owner}`), before=await self.getAttribute('data-x');
    await room.focus();await page.keyboard.down('d');await page.waitForTimeout(300);await page.keyboard.up('d');
    expect(await self.getAttribute('data-x')).toBe(before);
    await page.getByRole('button',{name:'Finish decorating',exact:true}).click();
    await page.getByRole('button',{name:'Downstairs',exact:true}).click();
    await expect(page.getByRole('tab',{name:'Ground floor',exact:true})).toHaveAttribute('aria-selected','true');
    await page.getByRole('button',{name:'Back to village'}).click();
    await expect(peer.locator('.interior-peer').filter({hasText:'Iraj'})).toHaveCount(0);
    await peer.route('**/models/*.glb',route=>route.fulfill({status:404,body:''}));
    await peer.goto(`/interior-preview.html?seat=${visitor}`);
    await expect(peer.getByRole('status')).toContainText('changes saved');
    await expect(peer.getByRole('button',{name:'Decorate',exact:true})).toHaveCount(0);
    await expect(peer.getByTestId(`interior-avatar-${visitor}`)).toBeVisible();
    await peer.getByLabel('Walk around the room',{exact:true}).focus();
    await peer.keyboard.down('ArrowUp');await peer.waitForTimeout(400);await peer.keyboard.up('ArrowUp');
    await expect.poll(async()=>Number(await peer.getByTestId(`interior-avatar-${visitor}`).getAttribute('data-z'))).toBeLessThan(3);
    await peer.setViewportSize({width:390,height:844});
    await peer.screenshot({path:'tests/artifacts/feat022/visitor-mobile.png'});
    expect(errors).toEqual([]);
  } finally {await a.close();await b.close();}
});

test('E uses nearby stairs and a three-storey home has both directions on its middle floor',async({page})=>{
  await page.goto(`/interior-preview.html?seat=${visitor}`);
  await expect(page.getByRole('status')).toContainText('changes saved');
  const avatar=page.getByTestId(`interior-avatar-${visitor}`);
  await page.getByLabel('Walk around the room',{exact:true}).focus();
  await page.keyboard.down('d');
  await expect.poll(async()=>Number(await avatar.getAttribute('data-x')),{intervals:[40]}).toBeGreaterThan(2.05);
  await page.keyboard.up('d');await page.keyboard.press('e');
  await expect(page.getByRole('tab',{name:'Floor 2',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('button',{name:'Upstairs',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Downstairs',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Upstairs',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Floor 3',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('button',{name:'Upstairs',exact:true})).toHaveCount(0);
  await page.screenshot({path:'tests/artifacts/feat022/home-floor3.png'});
  await page.getByRole('button',{name:'Downstairs',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Floor 2',exact:true})).toHaveAttribute('aria-selected','true');
});
