import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('square town keeps all 25/50/100 real houses, frames the town, and zooms to a street', async ({page}) => {
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {if (new URL(r.url()).pathname.startsWith('/api/')) requests.push(r.url());});
  await mkdir('tests/screenshots/WEB-057', {recursive:true});
  await page.goto('/lab');
  const metrics = [];
  const inspect = () => page.evaluate(async () => {
    // @ts-expect-error Vite serves the test helper directly.
    const tools = await import('/tests/lab057-tools.ts'); return tools.inspectTown();
  });
  for (const [slider, count] of [[1,25], [2,50], [3,100]]) {
    await page.getByRole('slider', {name:'Population'}).fill(String(slider));
    await expect(page.getByTestId('lab-fps')).toContainText(`${count} neighbors`);
    await page.mouse.move(10,10);
    await expect.poll(async () => (await inspect()).houses.filter((h: {detailed:boolean}) => h.detailed).length, {timeout:60000}).toBe(count);
    await page.waitForTimeout(8000);
    const town = await inspect();
    expect(town.houses).toHaveLength(count);
    expect(town.houses.every((h: {inFrame:boolean}) => h.inFrame)).toBe(true);
    await expect(page.locator('.house-nameplate')).toHaveCount(0);
    await expect(page.locator('.villager-label')).toHaveCount(0);
    const fps = [];
    for (let i=0;i<5;i++) {await page.waitForTimeout(1100); fps.push(await page.getByTestId('lab-fps').innerText());}
    metrics.push({count, ...town, fps});
    await page.screenshot({path:`tests/screenshots/WEB-057/town-${count}.png`, fullPage:true});
  }
  await writeFile('tests/screenshots/WEB-057/metrics.json', JSON.stringify(metrics,null,2));
  const before = await inspect();
  const point = await page.evaluate(async () => {
    // @ts-expect-error Vite serves the test helper directly.
    return (await import('/tests/lab057-tools.ts')).homeScreenPoint();
  });
  await page.mouse.move(point.x,point.y);
  // OrbitControls treats each wheel event as one step, independent of delta magnitude.
  for (let i=0;i<55;i++) {await page.mouse.wheel(0,-120); await page.waitForTimeout(30);}
  await page.waitForTimeout(2500);
  expect((await inspect()).zoom).toBeGreaterThan(before.zoom * 1.5);
  expect((await inspect()).houses.every((h: {detailed:boolean}) => h.detailed)).toBe(true);
  await page.screenshot({path:'tests/screenshots/WEB-057/street-100.png', fullPage:true});
  await page.getByRole('button', {name:'Reset camera'}).click();
  await expect.poll(async () => (await inspect()).zoom).toBeCloseTo(before.zoom, 1);
  await writeFile('tests/screenshots/WEB-057/metrics.json', JSON.stringify(metrics,null,2));
  expect(errors).toEqual([]); expect(requests).toEqual([]);
});
