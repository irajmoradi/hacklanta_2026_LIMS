import { expect, test } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

test('cap opening fit agrees in town, Outfit, Wardrobe, mannequins and colosseum', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('villager-Iraj')).toHaveAttribute('data-cosmetics', /hat_headphones/);
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByRole('button', { name: 'Buy Village Cap', exact: true }).click();
  await expect(page.getByTestId('villager-Iraj')).toHaveAttribute('data-cosmetics', /hat_cap/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'My profile', exact: true }).click();
  await page.getByRole('tab', { name: 'Outfit', exact: true }).click();
  const preview = page.getByRole('img', { name: /^Villager turntable for Iraj/ });
  await preview.scrollIntoViewIfNeeded();
  await expect(preview.locator('canvas')).toHaveAttribute('data-rendered', 'true');
  const attachments = () => page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    const canvases = [document.querySelector('main canvas'), document.querySelector('.showcase-preview canvas'), document.querySelector('.wardrobe-preview canvas')].filter(Boolean);
    return canvases.map(canvas => {
      const scene = _roots.get(canvas).store.getState().scene;
      return ['hat_cap', 'glasses_round'].map(id => {
        const item = scene.getObjectByName(`cosmetic:${id}`);
        return { id, parent: item?.parent.name, scale: item?.scale.toArray(), position:item?.position.toArray(), rotation:item?.rotation.toArray().slice(0,3) };
      });
    });
  });
  await expect.poll(async () => (await attachments()).filter(items => items.every(item => item.parent === 'Head')).length).toBe(2);
  const views = await attachments();
  for (const view of views) for (const item of view) expect(item.scale.every((n: number) => Number.isFinite(n) && n > 0)).toBe(true);
  await preview.screenshot({ path: 'artifacts/fix012/showcase_base.png' });
  await page.screenshot({ path: 'artifacts/fix012/town_showcase.png' });
  await page.evaluate(async () => (await import('/tests/fix008-wardrobe.tsx' as string)).mountWardrobe());
  const wardrobe = page.getByRole('img', { name: /^Interactive outfit preview for Iraj/ });
  await expect(wardrobe.locator('canvas')).toHaveAttribute('data-rendered', 'true');
  await expect.poll(async () => (await attachments()).filter(items => items.every(item => item.parent === 'Head')).length).toBe(3);
  const allViews = await attachments();
  for (const view of allViews) for (const [index, item] of view.entries()) {
    for(const field of ['scale','position','rotation'] as const) item[field].forEach((value: number, axis: number) => expect(value).toBeCloseTo(views[0][index][field][axis], 5));
  }
  await wardrobe.screenshot({ path: 'artifacts/fix012/wardrobe_base.png' });
  await page.evaluate(async () => (await import('/tests/fix012-venues.tsx' as string)).mountVenues());
  const venues = () => page.evaluate(async () => {
    const {_roots} = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    return ['#fit-mannequins canvas','#fit-arena canvas'].map(selector=>{
      const canvas=document.querySelector(selector), scene=canvas&&_roots.get(canvas)?.store.getState().scene;
      const items: any[]=[];
      scene?.traverse((o:any)=>{if(o.name==='cosmetic:hat_cap')items.push({parent:o.parent.name,scale:o.scale.toArray(),position:o.position.toArray(),rotation:o.rotation.toArray().slice(0,3)});});
      return items;
    });
  });
  await expect.poll(async()=> (await venues()).map(items=>items.length),{timeout:30000}).toEqual([4,1]);
  for(const items of await venues())for(const item of items) {
    expect(item.parent).toBe('Head');
    for(const field of ['scale','position','rotation'] as const)item[field].forEach((v:number,i:number)=>expect(v).toBeCloseTo(views[0][0][field][i],5));
  }
  await page.locator('#fit-mannequins').screenshot({path:'artifacts/fix012/mannequins.png'});
  await page.locator('#fit-arena').screenshot({path:'artifacts/fix012/colosseum.png'});
  expect(errors).toEqual([]);
});

test('zero assets keeps fixture cosmetics available', async ({ page }) => {
  await page.route('**/models/**', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.getByTestId('villager-Iraj')).toHaveAttribute('data-cosmetics', /hat_headphones/);
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByRole('button', { name: 'Buy Village Cap', exact: true }).click();
  await expect(page.getByTestId('villager-Iraj')).toHaveAttribute('data-cosmetics', /hat_cap/);
});
