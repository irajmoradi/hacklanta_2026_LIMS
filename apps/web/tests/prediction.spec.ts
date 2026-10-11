import {test,expect} from '@playwright/test';

test('WASD and emote render on input frame with server echoes held',async({page},info)=>{
  await page.route('**/*.glb',route=>route.fulfill({status:404,body:''}));
  await page.addInitScript(()=>{
    const u='13370000-0000-4000-8000-000000000001';
    localStorage.setItem('village:seat:live',u);localStorage.setItem(`village:last:${u}`,'13370000-0000-4000-8000-000000000000');
    localStorage.setItem(`village:face-badge:${u}`,'seen');localStorage.setItem(`village:guide:v1:${u}`,'seen');
  });
  await page.goto('/');
  const actor=page.locator('[data-player="true"]');
  await expect(actor).toHaveAttribute('data-mode',/home|walking|attraction|seated/,{timeout:60000});
  const close=page.getByRole('button',{name:/^(Close|Not now|Maybe later)$/});if(await close.first().isVisible())await close.first().click();
  // Hold all authoritative application for this check. The actual renderer and
  // keyboard controller still run; no echo can accidentally satisfy prediction.
  const proof=await page.evaluate(async()=>{
    const {townLive}=await import('/src/api/townLive.ts' as string);
    const world=townLive.world, apply=world.apply, publish=townLive.publish;
    world.apply=()=>true;
    // Keep the movement/stop packet pending: a new emote must supersede it even
    // on a fast frame or while the transport's 100ms send budget is exhausted.
    townLive.publish=()=>false;
    const el=document.querySelector<HTMLElement>('[data-player="true"]')!;
    const initial={x:Number(el.dataset.x),z:Number(el.dataset.z)};
    const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    // R3F's callback is registered before this test callback, so inspect the
    // completed input frame rather than waiting for a transport response.
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyS',bubbles:true}));
    await frame();
    const moved=Math.hypot(Number(el.dataset.x)-initial.x,Number(el.dataset.z)-initial.z);
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyS',bubbles:true}));
    await frame();
    const stopped=el.dataset.mode;
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Digit1',bubbles:true}));
    await frame();
    const emote=el.dataset.mode;
    world.apply=apply;
    townLive.publish=publish;
    return {moved,stopped,emote};
  });
  expect(proof.moved).toBeGreaterThan(0);
  expect(proof.stopped).toBe('idle');
  expect(proof.emote).toBe('emote');
  await page.screenshot({path:info.outputPath('predicted-avatar.png')});
});
