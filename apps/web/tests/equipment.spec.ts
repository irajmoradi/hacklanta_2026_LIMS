import { useDemoSeat } from './demoSeat';
useDemoSeat();
import { expect, test } from '@playwright/test';

test('WEB-010 shop and wardrobe replace slots on the actual villager; sample is explicit', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const iraj = page.getByTestId('villager-Iraj'), lance = page.getByTestId('villager-Lance');
  await expect(iraj).toHaveAttribute('data-cosmetics', /hat_headphones/);
  await expect(iraj).toHaveAttribute('data-cosmetics', /glasses_round/);
  await expect(lance).toHaveAttribute('data-cosmetics', /hat_festival/);
  await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string);
    const original = api.voice.bind(api); (window as any).voiceCalls = [];
    api.voice = (...args: any[]) => { (window as any).voiceCalls.push(args); return original(...args); };
  });
  await page.getByRole('button', {name:'Shop', exact:true}).click();
  await page.getByRole('button', {name:'Buy Village Cap', exact:true}).click();
  await expect(page.getByTestId('shop-balance')).toHaveText('395');
  await expect(iraj).toHaveAttribute('data-cosmetics', /hat_cap/);
  await expect(iraj).not.toHaveAttribute('data-cosmetics', /hat_headphones/);
  await expect(iraj).toHaveAttribute('data-cosmetics', /glasses_round/);
  await expect(lance).not.toHaveAttribute('data-cosmetics', /hat_cap/);
  const rendered = await page.evaluate(async () => {
    const {_roots} = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string);
    const scene = _roots.get(document.querySelector('canvas')).store.getState().scene;
    const owner = scene.getObjectByName('villager:00000000-0000-4000-8000-000000000001');
    const cap = owner.getObjectByName('cosmetic:hat_cap');
    let drawable = 0;
    cap.traverse((node: any) => { if (node.isMesh && node.visible && (!Array.isArray(node.material) || node.geometry.groups.length)) drawable++; });
    return {drawable, parent: cap.parent.name, neighborCap: !!scene.getObjectByName('villager:00000000-0000-4000-8000-000000000002').getObjectByName('cosmetic:hat_cap')};
  });
  expect(rendered.drawable).toBeGreaterThan(0); expect(rendered.parent).toBe('Head'); expect(rendered.neighborCap).toBe(false);
  await page.getByRole('button', {name:'Equip Headphones', exact:true}).click();
  await expect(iraj).toHaveAttribute('data-cosmetics', /hat_headphones/);
  await page.getByRole('button', {name:'Unequip Round Glasses', exact:true}).click();
  await expect(iraj).not.toHaveAttribute('data-cosmetics', /glasses_round/);
  await page.getByText('Voice styles', {exact:true}).click();
  await page.getByLabel('Talking style', {exact:true}).selectOption('');
  await page.getByLabel('Talking style', {exact:true}).selectOption('voice_hype_coach');
  expect(await page.evaluate(() => (window as any).voiceCalls)).toEqual([]);
  await page.getByRole('button', {name:'Preview sample line'}).click();
  await expect(page.getByText(/No voice provider called/)).toBeVisible();
  const calls = await page.evaluate(() => (window as any).voiceCalls);
  expect(calls).toHaveLength(1); expect(calls[0][2]).toBe('11111111-1111-4111-8111-111111111111');
  await page.getByRole('button', {name:'Close dialog'}).click();
  await page.getByRole('button', {name:'My profile', exact:true}).click();
  await page.getByRole('tab', {name:'Outfit'}).click();
  await expect(page.getByRole('img', {name:/Villager turntable for Iraj/})).toBeVisible();
  await page.getByRole('button', {name:'Round Glasses', exact:true}).first().click();
  await page.getByRole('button', {name:'Equip Round Glasses', exact:true}).click();
  await expect(iraj).toHaveAttribute('data-cosmetics', /glasses_round/);
  await page.locator('.showcase-preview').evaluate(el => el.scrollIntoView({block:'start'}));
  await page.screenshot({path:'test-results/web010-wardrobe-mock.png'});
  await page.getByRole('button', {name:'Close profile'}).click();
  await page.screenshot({path:'test-results/web010-plaza-mock.png'});
  expect(errors).toEqual([]);
});

test('WEB-010 keeps cosmetics and wardrobe usable with every model offline', async ({page}) => {
  await page.route('**/models/**', route => route.fulfill({status:404, body:''}));
  await page.goto('/');
  await expect(page.getByTestId('villager-Iraj')).toHaveAttribute('data-cosmetics', /hat_headphones/);
  await page.getByRole('button', {name:'Shop', exact:true}).click();
  await page.getByRole('button', {name:'Buy Village Cap', exact:true}).click();
  await expect(page.getByTestId('villager-Iraj')).toHaveAttribute('data-cosmetics', /hat_cap/);
  await page.screenshot({path:'test-results/web010-offline-mock.png'});
});
