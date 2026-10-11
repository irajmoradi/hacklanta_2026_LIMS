import { expect, test } from '@playwright/test';

test('generated head cosmetics in real mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  const inspect = () => page.evaluate(async () => (await import('/tests/fix004-inspect.ts' as string)).inspect());
  await expect.poll(async () => (await inspect())[0]?.filter((h: any) => h.generated).length, { timeout: 60000 }).toBe(5);
  const town = (await inspect())[0];
  for (const head of town.filter((h: any) => h.generated)) {
    expect(head.insideCosmetic).toBe(false);
    expect(head.hiddenPreset).toBe(true);
  }
  const iraj = town.find((h: any) => h.cosmetics.some((c: any) => c.name === 'cosmetic:glasses_round'));
  expect(iraj.generated).toBe(true);
  expect(Math.abs(iraj.cosmetics.find((c: any) => c.name === 'cosmetic:glasses_round').eyeError)).toBeLessThan(0.001);
  expect(iraj.cosmetics.find((c: any) => c.name === 'cosmetic:hat_headphones').meshes).toContain('headband');
  await page.screenshot({ path: 'test-results/fix004/town-real.png' });

  async function capture(name: string, surface: string) {
    const preview = page.getByRole('img', { name: `Rotating outfit preview for ${name}` });
    await preview.scrollIntoViewIfNeeded();
    const expectedCosmetic = name === 'Iraj' ? 'cosmetic:hat_headphones' : 'cosmetic:hat_crown';
    await expect.poll(async () => (await inspect()).at(-1)?.some((h: any) => h.generated && !h.insideCosmetic && h.cosmetics.some((c: any) => c.name === expectedCosmetic)), { timeout: 60000 }).toBe(true);
    const heads = (await inspect()).at(-1);
    expect(heads.filter((h: any) => h.generated)).toHaveLength(1);
    expect(heads.find((h: any) => h.generated).hiddenPreset).toBe(true);
    if (name === 'Iraj') {
      const cosmetics = heads.find((h: any) => h.generated).cosmetics;
      expect(Math.abs(cosmetics.find((c: any) => c.name === 'cosmetic:glasses_round').eyeError)).toBeLessThan(0.001);
      expect(cosmetics.find((c: any) => c.name === expectedCosmetic).meshes).toContain('ear_cushion');
    }
    for (const side of [false, true]) {
      await preview.locator('canvas').evaluate(async (canvas, side) => (await import('/tests/fix004-inspect.ts' as string)).view(canvas, side), side);
      await page.waitForTimeout(400);
      await preview.screenshot({ path: `test-results/fix004/${name.toLowerCase()}-${surface}-${side ? 'side' : 'front'}.png` });
    }
  }
  await page.getByRole('button', { name: 'My profile', exact: true }).click();
  await capture('Iraj', 'outfit');
  await page.getByRole('tab', { name: 'Wardrobe', exact: true }).click();
  await capture('Iraj', 'wardrobe');
  await page.getByRole('button', { name: 'Close profile' }).click();
  await page.getByTestId('villager-Stefanny').click();
  await capture('Stefanny', 'outfit');
});
