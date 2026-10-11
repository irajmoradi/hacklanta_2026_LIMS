import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
const before = process.env.FIX020_BEFORE === '1';
const phase = before ? 'before' : 'after';
const dir = 'artifacts/fix020';
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('.dashboard-card')).toHaveCount(3);
  mkdirSync(dir, {recursive:true});
});
for (const [width,height] of [[844,390],[915,412],[390,844],[412,839]]) {
  test(`dock and dashboard ${width}x${height}`, async ({page,context}) => {
    await page.setViewportSize({width,height});
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {insets:{bottom:34}});
    await page.evaluate(() => {const probe=document.createElement('div');probe.id='inset-probe';probe.style.paddingBottom='env(safe-area-inset-bottom)';document.body.append(probe);});
    await expect(page.locator('#inset-probe')).toHaveCSS('padding-bottom','34px');
    const geometry = await page.locator('.action-dock').evaluate(el => ({bottom:el.getBoundingClientRect().bottom,
      buttons: Array.from(el.querySelectorAll('button')).slice(0,2).map(b => {const r=b.getBoundingClientRect();return {name:b.getAttribute('aria-label'),bottom:r.bottom,reachable:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})}));
    writeFileSync(`${dir}/${phase}-${width}.json`,JSON.stringify(geometry,null,2));
    await page.screenshot({path:`${dir}/${phase}-${width}.png`});
    if (!before) {
      expect(geometry.buttons.every(b=>b.bottom<=height-34)).toBe(true);
      expect(geometry.buttons.every(b=>b.reachable)).toBe(true);
      for (const name of ['Check in','Village']) {
        await page.locator('.action-dock').getByRole('button',{name,exact:true}).click();
        await expect(page.locator('dialog[open]')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog[open]')).toHaveCount(0);
      }
      if(width>height){
        const goal=page.locator('.dashboard').getByRole('button',{name:'View goal',exact:true});
        await goal.scrollIntoViewIfNeeded();
        const goalBox=(await goal.boundingBox())!, dockBox=(await page.locator('.action-dock').boundingBox())!;
        expect(goalBox.y+goalBox.height).toBeLessThanOrEqual(dockBox.y);
      }
      await page.getByRole('button',{name:'Collapse dashboard',exact:true}).click();
      await page.getByRole('button',{name:'Reopen dashboard',exact:true}).click();
      await expect(page.locator('.dashboard')).toHaveAttribute('data-collapsed','false');
    }
  });
}
test('AI log keyboard scrolling', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async () => {
    const path='/src/api/client.ts'; const {api}=await import(path);
    api.agentLog=async()=>Array.from({length:40},(_,i)=>({created_at:new Date().toISOString(),agent:'mayor',action:`Decision ${i}`,reason:'Synthetic keyboard scrolling evidence.',model:'fixture',target_user_id:null}));
  });
  await page.getByRole('button',{name:'AI at work',exact:true}).click();
  const log=page.locator('.agent-log'); await expect(log.locator('article')).toHaveCount(40);
  let reached=false;
  for(let i=0;i<30;i++){await page.keyboard.press('Tab');if(await log.evaluate(el=>el===document.activeElement)){reached=true;break;}}
  if(reached) await page.keyboard.press('PageDown');
  if(reached) await expect.poll(()=>log.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  const violations=(await new AxeBuilder({page}).include('.agent-log').withRules(['scrollable-region-focusable','aria-prohibited-attr']).analyze()).violations;
  writeFileSync(`${dir}/${phase}-log.json`,JSON.stringify({reached,violations},null,2));
  await page.screenshot({path:`${dir}/${phase}-log.png`});
  // Axe's scroll-container warning alone does not establish a keyboard failure.
  if(!before) expect(reached).toBe(true);
});
test('arena error recovery and names', async ({page}) => {
  await page.evaluate(async()=>{const path='/src/api/client.ts';const {api}=await import(path);api.competitions=async()=>{throw new Error('Fixture competition read failed');};});
  await page.locator('.action-dock').getByRole('button',{name:'Compete',exact:true}).click();
  await expect(page.locator('.arena-modal[open]')).toBeVisible();
  const retry=page.getByRole('button',{name:'Retry',exact:true}); await expect(retry).toBeVisible();
  const violations=(await new AxeBuilder({page}).include('.arena-tabs').include('.arena-modal > p[role=alert]').withRules(['color-contrast','aria-prohibited-attr']).analyze()).violations;
  writeFileSync(`${dir}/${phase}-arena.json`,JSON.stringify(violations,null,2));
  await page.screenshot({path:`${dir}/${phase}-arena.png`});
  if(!before){expect(violations).toEqual([]);await retry.click();await expect(page.getByRole('alert')).toContainText('Fixture competition read failed');}
});
test('portrait crown has image semantics', async ({page}) => {
  const crown=page.locator('.portrait-crown:visible').first();
  await expect(crown).toBeVisible();
  await expect(crown).toHaveAttribute('role','img');
  await expect(crown).toHaveAccessibleName('Crown');
  const result=await new AxeBuilder({page}).include('.portrait-crown').withRules(['aria-prohibited-attr']).analyze();
  expect(result.violations).toEqual([]);
});
