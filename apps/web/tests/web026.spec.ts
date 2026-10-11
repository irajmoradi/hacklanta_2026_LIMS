import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

for (const width of [1366, 390]) {
  test(`settings save, keyboard, layout and accessibility at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:900});
    await page.goto('/');
    const opener = page.getByRole('button',{name:'Open Settings',exact:true});
    await expect(opener).toBeVisible();
    const inbox = await page.getByRole('button',{name:/^Inbox/}).boundingBox();
    const settings = await opener.boundingBox();
    expect(settings!.x).toBeGreaterThanOrEqual(inbox!.x + inbox!.width);
    expect(Math.abs(settings!.y - inbox!.y)).toBeLessThan(3);
    await page.screenshot({path:`test-results/web026/topbar-${width}.png`});
    await opener.click();
    const dialog = page.getByRole('dialog',{name:'Settings',exact:true});
    await expect(dialog.getByLabel('Display name')).not.toHaveValue('');
    await expect(dialog.getByRole('button',{name:'Save settings'})).toHaveCount(0);
    await page.screenshot({path:`test-results/web026/settings-${width}.png`});
    const permission = dialog.getByRole('switch',{name:'Friends may use my avatar and AI voice for Villager-grams',exact:true});
    const original = await permission.isChecked();
    await permission.focus(); await permission.press('Space');
    await expect(permission).toBeChecked({checked:!original});
    await expect(dialog.getByText('Unsaved changes')).toBeVisible();
    await page.screenshot({path:`test-results/web026/dirty-${width}.png`});
    await dialog.getByRole('button',{name:'Save settings'}).click();
    await expect(dialog.getByText('Settings saved.',{exact:true})).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Save settings'})).toHaveCount(0);
    await dialog.getByRole('button',{name:'Close dialog'}).click();
    await expect(opener).toBeFocused(); await opener.click();
    await expect(dialog.getByRole('switch',{name:'Friends may use my avatar and AI voice for Villager-grams',exact:true})).toBeChecked({checked:!original});
    const sound = dialog.getByRole('switch',{name:'Sound on',exact:true});
    const wasOn = await sound.isChecked(); await sound.click();
    await expect(sound).toBeChecked({checked:!wasOn});
    const volume = dialog.getByRole('slider',{name:'Sound volume'});
    await volume.fill('0.5'); await volume.focus(); await volume.press('ArrowRight');
    await expect(volume).toHaveValue('0.55');
    const reduced = dialog.getByRole('switch',{name:'Reduced sound'}); await reduced.check();
    await expect(dialog.getByRole('button',{name:'Save settings'})).toHaveCount(0);
    await page.screenshot({path:`test-results/web026/sound-${width}.png`});
    const danger = dialog.getByRole('button',{name:'Delete my account',exact:true});
    await danger.scrollIntoViewIfNeeded(); await expect(danger).toBeDisabled();
    await dialog.getByLabel('Type DELETE to confirm').fill('delete'); await expect(danger).toBeDisabled();
    await dialog.getByLabel('Type DELETE to confirm').fill('DELETE'); await expect(danger).toBeEnabled();
    await page.screenshot({path:`test-results/web026/danger-${width}.png`});
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const results = await new AxeBuilder({page}).include('.settings-panel').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await dialog.getByRole('button',{name:'Close dialog'}).click(); await opener.click();
    await expect(dialog.getByRole('slider',{name:'Sound volume'})).toHaveValue('0.55');
    await expect(dialog.getByRole('switch',{name:'Reduced sound'})).toBeChecked();
  });
}

test('failed profile save keeps the draft and permits retry; reverting clears dirty state', async ({page}) => {
  await page.goto('/'); await page.getByRole('button',{name:'Open Settings'}).click();
  const name = page.getByLabel('Display name'); const original = await name.inputValue();
  await name.fill('A new name'); await name.fill(original);
  await expect(page.getByText('Unsaved changes')).toHaveCount(0);
  await page.evaluate(async () => {
    const {api} = await import('/src/api/client.ts' as string); const save = api.updateSettings.bind(api); let calls = 0;
    api.updateSettings = async (input: any) => { if (++calls === 1) throw new Error('Try saving again'); return save(input); };
  });
  await name.fill('Cozy neighbor'); await page.getByRole('button',{name:'Save settings'}).click();
  await expect(page.getByRole('alert')).toContainText('Try saving again');
  await expect(name).toHaveValue('Cozy neighbor'); await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.getByRole('button',{name:'Save settings'}).click(); await expect(page.getByText('Settings saved.',{exact:true})).toBeVisible();
});

test('empty Villager-gram choices lead to Settings without buying or sending', async ({page}) => {
  await page.goto('/'); await page.getByRole('button',{name:'Shop',exact:true}).click();
  await expect(page.locator('.gram-empty')).toBeVisible();
  await page.locator('.gram-empty').getByRole('button',{name:'Open Settings'}).click();
  await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toBeVisible();
});
