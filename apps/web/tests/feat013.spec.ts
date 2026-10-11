import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

test('walk in, buy at checkout, visit for-sale pets, return to town',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  const canvas=page.locator('.shop-room canvas');
  await expect(canvas).toHaveAttribute('data-shop-warmed','true');
  // Measure the pre-warmed entrance after the town's initial model downloads settle.
  await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  await expect(page.getByTestId('shop-interior')).toHaveAttribute('data-department','general');
  await expect(page.getByTestId('shop-interior')).toHaveAttribute('data-shopper','00000000-0000-4000-8000-000000000001');
  await expect(canvas).toHaveAttribute('data-entered','true');
  const transitionMs=Number(await canvas.getAttribute('data-transition-ms'));
  expect(transitionMs).toBeLessThanOrEqual(400);
  await expect(page.locator('.shop-intro .balance')).toContainText('coins');
  await expect(page.locator('[data-item-id="hat_beanie"]')).toContainText('30 coins');
  await page.locator('[data-item-id="hat_beanie"]').getByRole('button',{name:'Buy Cozy Beanie',exact:true}).click();
  await expect(page.locator('.village-toast[data-kind=success]').first()).toBeVisible();
  await expect(page.locator('.village-toast[data-kind=success]').first()).toContainText('Cozy Beanie');
  await expect(canvas).toHaveAttribute('data-checkout-bag','true');
  await expect(page.locator('[data-item-id="hat_beanie"]')).toContainText('Owned');
  await expect(page.getByTestId('shop-balance')).toHaveText('390');
  await expect(page.getByTestId('my-xp')).toHaveText('420');
  await mkdir('artifacts/feat013',{recursive:true});
  await page.screenshot({path:'artifacts/feat013/boutique.png'});
  await expect(page.locator('.village-toast[data-kind=success]').first()).toHaveCount(0);
  const boutiqueTriangles=Number(await canvas.getAttribute('data-total-triangles'));
  const boutiqueTiming=await page.evaluate(async()=>{
    const frames:number[]=[];let previous=performance.now();
    await new Promise<void>(resolve=>{const sample=(now:number)=>{frames.push(now-previous);previous=now;if(frames.length<120)requestAnimationFrame(sample);else resolve();};requestAnimationFrame(sample);});
    frames.shift();frames.sort((a,b)=>a-b);return {medianMs:frames[Math.floor(frames.length/2)],p95Ms:frames[Math.floor(frames.length*.95)]};
  });
  await expect.poll(async()=>page.evaluate(async()=>{
    const {fittedMannequins}=await import('/tests/web019Scene.ts' as string);
    return fittedMannequins();
  })).toBe(4);
  const firstSet=JSON.parse((await canvas.getAttribute('data-displays'))!) as string[];
  expect(firstSet.filter(n=>n.startsWith('mannequin:'))).toHaveLength(4);
  await page.getByRole('tab',{name:'Farm Store',exact:true}).click();
  await expect(page.getByTestId('shop-interior')).toHaveAttribute('data-department','farm');
  for(const id of ['pet_cat_tabby','pet_cat_black','pet_cat_calico','pet_pug','pet_husky','pet_bunny','pet_hamster']) await expect(page.locator(`[data-item-id="${id}"]`)).toHaveCount(1);
  await expect.poll(async()=>JSON.parse((await canvas.getAttribute('data-displays'))!)).toContain('for-sale:pet_pug');
  await expect(canvas).toHaveAttribute('data-displays',/for-sale:pet_cat_calico/);
  await expect(canvas).toHaveAttribute('data-displays',/for-sale:pet_husky/);
  await expect(canvas).toHaveAttribute('data-displays',/for-sale:pet_bunny/);
  await page.getByRole('button',{name:'Buy Tabby Cat',exact:true}).click();
  await expect(page.locator('.village-toast[data-kind=success]').first()).toBeVisible();
  await expect(page.locator('[data-item-id="pet_cat_tabby"]')).toContainText('Equipped');
  await page.waitForTimeout(1600);
  await page.locator('.shop-overlay').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:'artifacts/feat013/farm.png'});
  const stats=await canvas.evaluate(async canvas=>{
    const el=canvas as HTMLCanvasElement,gl=el.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');
    const frames:number[]=[];let previous=performance.now();
    await new Promise<void>(resolve=>{const sample=(now:number)=>{frames.push(now-previous);previous=now;if(frames.length<120)requestAnimationFrame(sample);else resolve();};requestAnimationFrame(sample);});
    frames.shift();frames.sort((a,b)=>a-b);
    return {triangles:Number(el.dataset.totalTriangles),drawCalls:Number(el.dataset.drawCalls),renderer:ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)):'unknown',medianMs:frames[Math.floor(frames.length/2)],p95Ms:frames[Math.floor(frames.length*.95)]};
  });
  await writeFile('artifacts/feat013/performance.json',JSON.stringify({transitionMs,boutiqueTriangles,boutiqueTiming,...stats},null,2));
  expect(boutiqueTriangles).toBeLessThanOrEqual(15000);expect(stats.triangles).toBeLessThanOrEqual(15000);
  await page.keyboard.press('Escape');await expect(page.getByTestId('shop-interior')).not.toBeVisible();
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  await page.getByRole('button',{name:'Back to town',exact:true}).click();
  await expect(page.getByTestId('village-scene')).toBeVisible();expect(errors).toEqual([]);
});

test('featured mannequins rotate through current shop outfits',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Shop',exact:true}).click();
  const canvas=page.locator('.shop-room canvas');await expect(canvas).toHaveAttribute('data-displays',/mannequin:shirt_hoodie/);
  const initial = await canvas.getAttribute('data-displays');
  await expect.poll(() => canvas.getAttribute('data-displays'), {timeout:25000}).not.toBe(initial);
  const featured = JSON.parse((await canvas.getAttribute('data-displays'))!) as string[];
  expect(featured.filter(id => id.startsWith('mannequin:'))).toHaveLength(4);
  expect(Number(await canvas.getAttribute('data-total-triangles'))).toBeLessThanOrEqual(15000);
});

test('mobile, reduced motion and missing models retain both shops and checkout',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/models/*.glb*',route=>route.fulfill({status:404,body:''}));
  await page.goto('/');await page.getByRole('button',{name:'Shop',exact:true}).click();
  await expect(page.locator('.shop-room canvas')).toHaveAttribute('data-entered','true');
  await page.locator('[data-item-id="hat_beanie"]').getByRole('button',{name:'Buy Cozy Beanie',exact:true}).click();
  await expect(page.locator('.village-toast[data-kind=success]').first()).toBeVisible();
  await page.getByRole('tab',{name:'Farm Store',exact:true}).click();
  await expect(page.getByRole('button',{name:'Buy Tabby Cat',exact:true})).toBeEnabled();
  await page.screenshot({path:'artifacts/feat013/farm-mobile-fallback.png'});
  await page.keyboard.press('Escape');await expect(page.getByTestId('shop-interior')).not.toBeVisible();
});
