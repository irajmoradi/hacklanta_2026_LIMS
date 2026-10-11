import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
for (const width of [1280,390]) test(`shop layouts at ${width}px`, async ({page})=>{
  await page.setViewportSize({width,height:width===390?844:900});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  // Exercise the fixture fallback at mobile width with no generated/model assets.
  if(width===390) await page.route('**/models/*.glb',r=>r.fulfill({status:404,body:''}));
  await page.goto('/');await page.getByRole('button',{name:'Shop',exact:true}).click();
  const canvas=page.locator('.shop-room canvas');
  await expect(canvas).toHaveAttribute('data-entered','true');
  await expect.poll(()=>page.evaluate(async()=> (await import('/tests/web041Scene.ts' as string)).layout())).toMatchObject({door:[-5,0,2.35],rackClear:true,shopperInside:true});
  await mkdir('artifacts/web041',{recursive:true});
  await page.screenshot({path:`artifacts/web041/clothing-${width}.png`});
  await page.getByRole('tab',{name:'Farm Store',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-entered','true');
  await expect.poll(()=>page.evaluate(async()=> (await import('/tests/web041Scene.ts' as string)).cameraPosition())).toEqual([0,7.7,11]);
  const board=page.getByTestId('pet-counter-prices');
  await expect(board).toBeVisible();
  const range=await page.evaluate(async()=>{
    const {api}=await import('/src/api/client.ts' as string);
    const me=await api.me();const shop=await api.shop(me.villages[0].id);
    const values=shop.items.filter((i:{kind:string})=>i.kind==='pet').map((i:{price_coins:number})=>i.price_coins);
    return [Math.min(...values),Math.max(...values)];
  });
  for(const price of range) await expect(board).toContainText(`${price} coins`);
  await expect(board.locator('[data-currency="coins"]')).toHaveCount(range[0]===range[1]?1:2);
  await expect(board).toBeInViewport({ratio:1});
  await page.screenshot({path:`artifacts/web041/pets-${width}.png`});
  await page.keyboard.press('Escape');await expect(page.getByTestId('shop-interior')).not.toBeVisible();
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  await expect(page.getByTestId('shop-interior')).toBeVisible();
  expect(errors).toEqual([]);
});
