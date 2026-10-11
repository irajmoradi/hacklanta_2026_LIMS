import {test, expect} from '@playwright/test';
import {useDemoSeat} from './demoSeat';
useDemoSeat();
for (const width of [1280,390]) for (const night of [false,true]) test(`walking ${night?'night':'day'} ${width}`, async ({page}) => {
  await page.setViewportSize({width,height:844});
  await page.addInitScript(() => localStorage.setItem('village:walk-hint','1'));
  await page.route('**/src/api/world.ts', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace('time_of_day: "Afternoon"', `time_of_day: "${night?'night':'day'}"`);
    expect(source).toContain(`time_of_day: "${night?'night':'day'}"`);
    await route.fulfill({response, body:source});
  });
  // Exercise the guaranteed zero-asset path as well as the shipped GLB.
  if(width===390) await page.route('**/models/*.glb*',route=>route.abort());
  await page.goto('/');
  const owner = page.locator('.villager-label[data-player="true"]');
  await expect(owner).toBeAttached();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.evaluate(async()=> (await import(/* @vite-ignore */ String('/tests/web045Scene.ts'))).zoomWalking());
  await page.keyboard.down('KeyS');
  await expect(owner).toHaveAttribute('data-moving','true');
  await expect(owner.locator('.activity-badge')).toBeHidden();
  await expect(owner.locator('.portrait')).toBeHidden();
  await expect(owner).toHaveCSS('opacity','0.38');
  await expect.poll(()=>page.evaluate(async()=> (await import(/* @vite-ignore */ String('/tests/web045Scene.ts'))).focusState().ring)).toBe(true);
  await expect.poll(()=>page.evaluate(async()=> (await import(/* @vite-ignore */ String('/tests/web045Scene.ts'))).focusState().glow.includes(.32))).toBe(true);
  await page.waitForTimeout(800);
  await expect(owner).toHaveAttribute('data-moving','true');
  await page.screenshot({path:`artifacts/web045/walking-${night?'night':'day'}-${width}.png`});
  const clear = await owner.evaluate(el => {
    const measured = JSON.parse((el as HTMLElement).dataset.avatarBounds!);
    const scene = document.querySelector('.scene')!.getBoundingClientRect();
    return el.getBoundingClientRect().bottom < measured.top+scene.top;
  });
  expect(clear).toBe(true);
  await page.keyboard.up('KeyS');
  await expect(owner).toHaveAttribute('data-moving','false');
  await expect(owner).toHaveCSS('opacity','1');
  // A real neighbor may be outside TownLabel's mobile viewport and culled.
  // Put a copy in the visible overlay host so this tests overlap suppression,
  // independently of the NPC schedule and camera-follow animation.
  const original = page.locator('.villager-label:not([data-player="true"])').first();
  const sourceDisplay = await original.evaluate(el => {
    const scene = document.querySelector<HTMLElement>('.scene')!;
    const probe = el.cloneNode(true) as HTMLElement;
    probe.dataset.testid = 'overlap-probe';
    scene.appendChild(probe);
    let box = JSON.parse(document.querySelector<HTMLElement>('.villager-label[data-player="true"]')!.dataset.avatarBounds!);
    probe.getBoundingClientRect = () => {
      const owner = document.querySelector<HTMLElement>('.villager-label[data-player="true"]')!;
      if (owner.dataset.avatarBounds) box = JSON.parse(owner.dataset.avatarBounds);
      const bounds = scene.getBoundingClientRect();
      // Fill the vertical placement range: decluttering cannot merely shift the
      // probe clear of the avatar. Read live bounds as the follow camera settles.
      const left = box.left+bounds.left, top = bounds.top+8;
      const right = box.right+bounds.left, bottom = bounds.bottom-8;
      return {left,right,top,bottom,width:right-left,height:bottom-top,x:left,y:top,toJSON(){return this;}};
    };
    return el.parentElement?.style.display;
  });
  await test.info().attach('original-neighbor-display', {body:JSON.stringify({sourceDisplay}), contentType:'application/json'});
  const neighbor = page.getByTestId('overlap-probe');
  await expect(neighbor).toHaveAttribute('data-avatar-overlap','true');
  await expect(neighbor).toHaveCSS('opacity','0');
  await expect(neighbor).toHaveCSS('pointer-events','none');
  await page.evaluate(async()=> (await import(/* @vite-ignore */ String('/tests/web045Scene.ts'))).focusState(true));
  await expect(owner).toHaveAttribute('data-walk-focus','false');
  await expect(owner.locator('.activity-badge')).toBeVisible();
  await expect.poll(()=>page.evaluate(async()=> (await import(/* @vite-ignore */ String('/tests/web045Scene.ts'))).focusState().ring)).toBe(false);
  await expect(neighbor).toHaveAttribute('data-avatar-overlap','false');
  const restored = await page.evaluate(async()=> (await import(/* @vite-ignore */ String('/tests/web045Scene.ts'))).focusState());
  expect(restored.glow).not.toContain(.32);
  expect(restored.glow).not.toContain(.08);
  await neighbor.evaluate(el => el.remove());
});
